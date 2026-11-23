-- Add food catalog reference and gram-based inventory to pantry items
ALTER TABLE public.pantry_items
ADD COLUMN food_id UUID REFERENCES public.foods(id),
ADD COLUMN grams DECIMAL;

-- Recipes
CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    servings INTEGER NOT NULL,
    steps JSONB NOT NULL,
    minutes INTEGER NOT NULL,
    seeded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT recipes_servings_check CHECK (servings > 0),
    CONSTRAINT recipes_minutes_check CHECK (minutes >= 0)
);

-- Recipe ingredients
CREATE TABLE public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES public.foods(id),
    grams DECIMAL NOT NULL,

    CONSTRAINT recipe_ingredients_grams_check CHECK (grams > 0),
    CONSTRAINT recipe_ingredients_unique UNIQUE (recipe_id, food_id)
);

-- Enable Row Level Security
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view recipes
CREATE POLICY "Authenticated users can view recipes"
ON public.recipes
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can view recipe ingredients
CREATE POLICY "Authenticated users can view recipe ingredients"
ON public.recipe_ingredients
FOR SELECT
TO authenticated
USING (true);

-- Grant read access to authenticated users
GRANT SELECT ON public.recipes TO authenticated;
GRANT SELECT ON public.recipe_ingredients TO authenticated;

-- Allow backend service to manage recipes
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.recipes, public.recipe_ingredients
TO service_role;

-- Cook a recipe, deduct pantry inventory, and log consumed ingredients
CREATE OR REPLACE FUNCTION public.cook_recipe(
    p_recipe_id UUID,
    p_servings INTEGER,
    p_meal VARCHAR DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_recipe RECORD;
    v_ingredient RECORD;
    v_pantry RECORD;
    v_required_grams NUMERIC;
    v_remaining_grams NUMERIC;
    v_available_grams NUMERIC;
    v_deduct_grams NUMERIC;
BEGIN
    -- Identify the authenticated user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Validate servings
    IF p_servings IS NULL OR p_servings <= 0 THEN
        RAISE EXCEPTION 'Servings must be greater than zero';
    END IF;

    -- Validate meal type
    IF p_meal IS NOT NULL AND p_meal NOT IN (
        'breakfast', 'lunch', 'dinner', 'snack'
    ) THEN
        RAISE EXCEPTION 'Invalid meal type';
    END IF;

    -- Retrieve recipe
    SELECT *
    INTO v_recipe
    FROM public.recipes
    WHERE id = p_recipe_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recipe not found';
    END IF;

    -- Process ingredients in consistent order
    FOR v_ingredient IN
        SELECT food_id, grams
        FROM public.recipe_ingredients
        WHERE recipe_id = p_recipe_id
        ORDER BY food_id
    LOOP
        -- Calculate required amount for requested servings
        v_required_grams :=
            v_ingredient.grams * p_servings / v_recipe.servings;

        v_available_grams := 0;

        -- Lock the user's matching pantry rows
        FOR v_pantry IN
            SELECT id, grams
            FROM public.pantry_items
            WHERE user_id = v_user_id
              AND food_id = v_ingredient.food_id
              AND grams IS NOT NULL
              AND grams > 0
            ORDER BY expiration_date ASC NULLS LAST, id
            FOR UPDATE
        LOOP
            v_available_grams :=
                v_available_grams + v_pantry.grams;
        END LOOP;

        -- Verify sufficient inventory
        IF v_available_grams < v_required_grams THEN
            RAISE EXCEPTION
                'Insufficient pantry stock for food %. Required: %g, available: %g',
                v_ingredient.food_id,
                v_required_grams,
                v_available_grams;
        END IF;

        -- Deduct across pantry rows, earliest expiration first
        v_remaining_grams := v_required_grams;

        FOR v_pantry IN
            SELECT id, grams
            FROM public.pantry_items
            WHERE user_id = v_user_id
              AND food_id = v_ingredient.food_id
              AND grams IS NOT NULL
              AND grams > 0
            ORDER BY expiration_date ASC NULLS LAST, id
            FOR UPDATE
        LOOP
            EXIT WHEN v_remaining_grams <= 0;

            v_deduct_grams :=
                LEAST(v_pantry.grams, v_remaining_grams);

            UPDATE public.pantry_items
            SET grams = grams - v_deduct_grams
            WHERE id = v_pantry.id
              AND user_id = v_user_id;

            v_remaining_grams :=
                v_remaining_grams - v_deduct_grams;
        END LOOP;

        -- Log consumed ingredient
        INSERT INTO public.food_logs (
            user_id,
            food_id,
            grams,
            meal,
            source
        )
        VALUES (
            v_user_id,
            v_ingredient.food_id,
            v_required_grams,
            p_meal,
            'recipe'
        );
    END LOOP;
END;
$$;

-- Restrict execution to authenticated users
REVOKE ALL ON FUNCTION public.cook_recipe(UUID, INTEGER, VARCHAR)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cook_recipe(UUID, INTEGER, VARCHAR)
TO authenticated;