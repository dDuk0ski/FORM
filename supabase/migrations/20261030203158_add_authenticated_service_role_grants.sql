-- Authenticated users

GRANT SELECT, INSERT, UPDATE
ON public.profiles
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workouts
TO authenticated;

GRANT SELECT
ON public.exercises
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.workout_exercises
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.pantry_items
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.body_metrics
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.readiness_checkins
TO authenticated;

GRANT SELECT
ON public.nutrients
TO authenticated;

GRANT SELECT
ON public.food_nutrients
TO authenticated;

GRANT SELECT
ON public.targets
TO authenticated;