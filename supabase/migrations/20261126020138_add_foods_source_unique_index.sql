-- Prevent duplicate records from the same food data source.
CREATE UNIQUE INDEX foods_source_source_id_unique
ON public.foods (source, source_id)
WHERE source_id IS NOT NULL;