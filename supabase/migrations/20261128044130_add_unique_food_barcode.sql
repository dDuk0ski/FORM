-- Ensure each non-null food barcode belongs to only one food.
CREATE UNIQUE INDEX foods_barcode_unique
ON public.foods (barcode)
WHERE barcode IS NOT NULL;