GRANT SELECT ON public.foods TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.food_logs
TO authenticated;