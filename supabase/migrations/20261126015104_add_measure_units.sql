-- Store USDA household measurement units.

CREATE TABLE public.measure_units (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE
);

-- Connect food portions to their measurement units.
ALTER TABLE public.food_portions
ADD CONSTRAINT food_portions_measure_unit_id_fkey
FOREIGN KEY (measure_unit_id)
REFERENCES public.measure_units(id);

-- Measurement units are reference data.
ALTER TABLE public.measure_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view measure units"
ON public.measure_units
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.measure_units TO authenticated;
GRANT SELECT ON public.measure_units TO service_role;