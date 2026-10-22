ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view foods"
ON public.foods
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can view their own food logs"
ON public.food_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own food logs"
ON public.food_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food logs"
ON public.food_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food logs"
ON public.food_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);