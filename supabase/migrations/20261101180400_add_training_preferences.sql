-- Inputs to the workout generator, one row per user.
CREATE TABLE public.training_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    goal VARCHAR NOT NULL DEFAULT 'hypertrophy',
    experience VARCHAR NOT NULL DEFAULT 'intermediate',
    split VARCHAR NOT NULL DEFAULT 'upper_lower',
    days_per_week INTEGER NOT NULL DEFAULT 4,
    session_minutes INTEGER NOT NULL DEFAULT 60,
    equipment TEXT[] NOT NULL DEFAULT '{}',
    excluded_exercise_ids UUID[] NOT NULL DEFAULT '{}',
    excluded_muscles TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT training_preferences_goal_check
        CHECK (goal IN ('hypertrophy', 'strength', 'general_fitness')),
    CONSTRAINT training_preferences_experience_check
        CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT training_preferences_split_check
        CHECK (split IN ('full_body', 'upper_lower', 'push_pull_legs', 'ppl_upper_lower', 'bro_split')),
    CONSTRAINT training_preferences_days_check CHECK (days_per_week BETWEEN 1 AND 6),
    CONSTRAINT training_preferences_minutes_check CHECK (session_minutes BETWEEN 15 AND 180)
);

ALTER TABLE public.training_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training preferences"
ON public.training_preferences
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own training preferences"
ON public.training_preferences
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own training preferences"
ON public.training_preferences
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.training_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_preferences TO service_role;

-- Keep updated_at current on every change, not only on insert.
CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER training_preferences_set_updated_at
BEFORE UPDATE ON public.training_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
