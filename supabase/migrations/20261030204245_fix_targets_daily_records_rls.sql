-- Targets: users can view their own targets,
-- but only the model/service can write them.
DROP POLICY IF EXISTS "Users can create their own targets" ON public.targets;
DROP POLICY IF EXISTS "Users can update their own targets" ON public.targets;
DROP POLICY IF EXISTS "Users can delete their own targets" ON public.targets;

-- Daily records: model/service only.
DROP POLICY IF EXISTS "Users can view their own daily records" ON public.daily_records;

-- Remove the authenticated SELECT grant so daily_records
-- is truly inaccessible to normal authenticated users.
REVOKE SELECT ON public.daily_records FROM authenticated;