ALTER TABLE public.food_logs
ADD COLUMN serving_label VARCHAR,
ADD COLUMN serving_quantity DECIMAL,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;