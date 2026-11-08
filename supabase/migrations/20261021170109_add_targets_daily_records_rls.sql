-- Enable Row Level Security
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;


-- Targets: users can manage their own targets
CREATE POLICY "Users can view their own targets"
ON public.targets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own targets"
ON public.targets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own targets"
ON public.targets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own targets"
ON public.targets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- Daily records: users can only view their own records
CREATE POLICY "Users can view their own daily records"
ON public.daily_records
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);