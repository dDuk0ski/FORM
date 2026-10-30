ALTER TABLE public.nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view nutrients"
ON public.nutrients
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view food nutrients"
ON public.food_nutrients
FOR SELECT
TO authenticated
USING (true);