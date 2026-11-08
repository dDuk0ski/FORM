CREATE TABLE public.nutrients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    unit VARCHAR NOT NULL,
    ear DECIMAL,
    rda DECIMAL,
    upper_limit DECIMAL
);

CREATE TABLE public.food_nutrients (
    food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
    nutrient_id UUID NOT NULL REFERENCES public.nutrients(id) ON DELETE CASCADE,
    amount_per_100g DECIMAL,
    is_known BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (food_id, nutrient_id)
);