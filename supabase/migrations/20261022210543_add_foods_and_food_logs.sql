CREATE TABLE public.foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    brand VARCHAR,
    source VARCHAR NOT NULL,
    source_id VARCHAR,
    barcode VARCHAR,
    serving_g DECIMAL,
    density DECIMAL,
    data_tier VARCHAR NOT NULL
);

CREATE TABLE public.food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    meal VARCHAR,
    food_id UUID NOT NULL REFERENCES public.foods(id),
    grams DECIMAL NOT NULL,
    source VARCHAR NOT NULL
);