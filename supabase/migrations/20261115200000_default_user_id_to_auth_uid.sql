-- Tables the app writes to directly fill user_id from the signed-in user,
-- so the client never sends a user id. RLS still checks it matches.
ALTER TABLE public.food_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.body_metrics ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.readiness_checkins ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.pantry_items ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.workouts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.training_preferences ALTER COLUMN user_id SET DEFAULT auth.uid();
