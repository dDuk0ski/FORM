-- Allowed values for profile fields. These match the energy model's inputs.
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_sex_check CHECK (sex IN ('male', 'female')),
ADD CONSTRAINT profiles_goal_check CHECK (goal IN ('lose', 'maintain', 'gain')),
ADD CONSTRAINT profiles_activity_level_check
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
ADD CONSTRAINT profiles_units_check CHECK (units IN ('metric', 'imperial')),
ADD CONSTRAINT profiles_height_cm_check CHECK (height_cm > 0);

-- Food logs: fixed meal and source values, positive amounts.
ALTER TABLE public.food_logs
ADD CONSTRAINT food_logs_meal_check CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
ADD CONSTRAINT food_logs_source_check CHECK (source IN ('manual', 'barcode', 'recipe', 'predicted')),
ADD CONSTRAINT food_logs_grams_check CHECK (grams > 0),
ADD CONSTRAINT food_logs_serving_quantity_check CHECK (serving_quantity > 0);

-- Unknown nutrient values are null with is_known = false, never zero.
ALTER TABLE public.food_nutrients
ADD CONSTRAINT food_nutrients_is_known_check
    CHECK (is_known = (amount_per_100g IS NOT NULL)),
ADD CONSTRAINT food_nutrients_amount_check CHECK (amount_per_100g >= 0);

ALTER TABLE public.body_metrics
ADD CONSTRAINT body_metrics_weight_kg_check CHECK (weight_kg > 0);
