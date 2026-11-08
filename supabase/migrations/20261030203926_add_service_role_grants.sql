GRANT SELECT, INSERT, UPDATE, DELETE
ON public.profiles
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workouts
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.exercises
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workout_exercises
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.pantry_items
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.body_metrics
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.readiness_checkins
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.foods
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.food_logs
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.nutrients
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.food_nutrients
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.targets
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.daily_records
TO service_role;