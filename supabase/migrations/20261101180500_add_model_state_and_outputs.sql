-- Per-user model state. A cache: it can always be rebuilt by replaying the raw logs.
-- Service only; the app never reads or writes it.
CREATE TABLE public.model_state (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    model VARCHAR NOT NULL,
    version VARCHAR NOT NULL,
    state JSONB NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, model)
);

-- What each model concluded for a user on a day, in the shared output format.
-- The daily and weekly reports read from here. Written by the service only.
CREATE TABLE public.model_outputs (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    model VARCHAR NOT NULL,
    date DATE NOT NULL,
    version VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    confidence DECIMAL,
    output JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, model, date),
    CONSTRAINT model_outputs_status_check CHECK (status IN ('ok', 'learning', 'insufficient_data')),
    CONSTRAINT model_outputs_confidence_check CHECK (confidence BETWEEN 0 AND 1)
);

ALTER TABLE public.model_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own model outputs"
ON public.model_outputs
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.model_outputs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_outputs TO service_role;
