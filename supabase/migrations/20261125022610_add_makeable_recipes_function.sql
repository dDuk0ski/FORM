CREATE OR REPLACE FUNCTION public.makeable_recipes()
RETURNS TABLE (
    recipe_id UUID,
    name VARCHAR,
    servings INTEGER,
    steps JSONB,
    minutes INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        r.id,
        r.name,
        r.servings,
        r.steps,
        r.minutes
    FROM public.recipes r
    WHERE
        -- Exclude recipes without ingredients
        EXISTS (
            SELECT 1
            FROM public.recipe_ingredients ri
            WHERE ri.recipe_id = r.id
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.recipe_ingredients ri
            WHERE ri.recipe_id = r.id
              AND ri.grams > COALESCE(
                  (
                      SELECT SUM(pi.grams)
                      FROM public.pantry_items pi
                      WHERE pi.user_id = auth.uid()
                        AND pi.food_id = ri.food_id
                        AND pi.grams > 0
                  ),
                  0
              )
        )
    ORDER BY r.name;
$$;

-- Restrict execution to authenticated users
REVOKE ALL ON FUNCTION public.makeable_recipes()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.makeable_recipes()
TO authenticated;