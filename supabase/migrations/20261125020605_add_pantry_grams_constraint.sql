ALTER TABLE public.pantry_items
ADD CONSTRAINT pantry_items_grams_nonnegative
CHECK (grams >= 0);