-- Exercise catalog fields the workout generator selects on.
ALTER TABLE public.exercises
ADD COLUMN source VARCHAR,
ADD COLUMN source_id VARCHAR,
ADD COLUMN category VARCHAR,
ADD COLUMN equipment TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN primary_muscles TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN movement_pattern VARCHAR,
ADD COLUMN is_compound BOOLEAN,
ADD COLUMN is_unilateral BOOLEAN,
ADD COLUMN instructions TEXT,
ADD CONSTRAINT exercises_source_unique UNIQUE (source, source_id);

-- What the model prescribed for this exercise in this workout.
ALTER TABLE public.workout_exercises
ADD COLUMN position INTEGER,
ADD COLUMN prescribed_sets INTEGER,
ADD COLUMN prescribed_reps_min INTEGER,
ADD COLUMN prescribed_reps_max INTEGER,
ADD COLUMN prescribed_rir DECIMAL,
ADD COLUMN prescribed_weight_kg DECIMAL,
ADD COLUMN rest_seconds INTEGER,
ADD COLUMN progression_action VARCHAR,
ADD CONSTRAINT workout_exercises_reps_range_check
    CHECK (prescribed_reps_min <= prescribed_reps_max);

-- The original sets, reps and weight columns are replaced by the prescribed_* columns above
-- (the plan) and workout_sets below (what was done). Nothing reads them.
ALTER TABLE public.workout_exercises
DROP COLUMN sets,
DROP COLUMN reps,
DROP COLUMN weight;

-- What the user actually did, one row per set.
CREATE TABLE public.workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    weight_kg DECIMAL NOT NULL,
    reps INTEGER NOT NULL,
    rir DECIMAL,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT workout_sets_weight_kg_check CHECK (weight_kg >= 0),
    CONSTRAINT workout_sets_reps_check CHECK (reps >= 0),
    CONSTRAINT workout_sets_rir_check CHECK (rir BETWEEN 0 AND 10),
    CONSTRAINT workout_sets_set_index_check CHECK (set_index >= 1)
);

-- One live row per set number. Soft-deleted rows are left out, so a corrected set can reuse its number.
CREATE UNIQUE INDEX workout_sets_exercise_set_index_unique
ON public.workout_sets (workout_exercise_id, set_index)
WHERE deleted_at IS NULL;

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout sets"
ON public.workout_sets
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = (SELECT auth.uid())
));

CREATE POLICY "Users can add sets to own workouts"
ON public.workout_sets
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = (SELECT auth.uid())
));

CREATE POLICY "Users can update own workout sets"
ON public.workout_sets
FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = (SELECT auth.uid())
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_exercises we
    JOIN public.workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = (SELECT auth.uid())
));

-- No DELETE policy: corrections are soft deletes through deleted_at.

GRANT SELECT, INSERT, UPDATE ON public.workout_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO service_role;
