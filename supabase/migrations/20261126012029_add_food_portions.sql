
-- Store USDA household portion options for foods.

CREATE TABLE public.food_portions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id UUID NOT NULL
        REFERENCES public.foods(id) ON DELETE CASCADE,
    usda_portion_id BIGINT NOT NULL UNIQUE,
    seq_num INTEGER NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    measure_unit_id INTEGER NOT NULL,
    modifier VARCHAR NOT NULL,
    gram_weight NUMERIC NOT NULL CHECK (gram_weight > 0)
);

-- Efficiently retrieve portions for a selected food.
CREATE INDEX idx_food_portions_food_id
ON public.food_portions(food_id);

-- Reference data is readable by authenticated users.
ALTER TABLE public.food_portions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view food portions"
ON public.food_portions
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.food_portions TO authenticated;
GRANT SELECT ON public.food_portions TO service_role;
