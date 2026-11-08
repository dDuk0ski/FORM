ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own body metrics"
ON public.body_metrics
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own body metrics"
ON public.body_metrics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own body metrics"
ON public.body_metrics
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own body metrics"
ON public.body_metrics
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own readiness checkins"
ON public.readiness_checkins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own readiness checkins"
ON public.readiness_checkins
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own readiness checkins"
ON public.readiness_checkins
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own readiness checkins"
ON public.readiness_checkins
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);