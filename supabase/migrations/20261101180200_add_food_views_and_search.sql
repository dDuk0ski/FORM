-- Stable key for nutrients, so views do not depend on display names.
ALTER TABLE public.nutrients
ADD COLUMN code VARCHAR UNIQUE;

-- Macros per 100 g for every food. Unknown values stay null.
CREATE VIEW public.food_macros
WITH (security_invoker = true)
AS
SELECT
    f.id AS food_id,
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'energy_kcal') AS kcal_per_100g,
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'protein') AS protein_g_per_100g,
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'carbohydrate') AS carb_g_per_100g,
    MAX(fn.amount_per_100g) FILTER (WHERE n.code = 'fat') AS fat_g_per_100g
FROM public.foods f
LEFT JOIN public.food_nutrients fn ON fn.food_id = f.id AND fn.is_known
LEFT JOIN public.nutrients n ON n.id = fn.nutrient_id
GROUP BY f.id;

-- One row per logged food with its macros, excluding soft-deleted logs.
-- local_date is the day in the user's timezone; filter on it for "today".
CREATE VIEW public.food_log_entries
WITH (security_invoker = true)
AS
SELECT
    l.id,
    l.user_id,
    l.logged_at,
    (l.logged_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::DATE AS local_date,
    l.meal,
    l.source,
    l.food_id,
    f.name AS food_name,
    f.brand,
    l.grams,
    l.serving_label,
    l.serving_quantity,
    l.grams / 100 * m.kcal_per_100g AS kcal,
    l.grams / 100 * m.protein_g_per_100g AS protein_g,
    l.grams / 100 * m.carb_g_per_100g AS carb_g,
    l.grams / 100 * m.fat_g_per_100g AS fat_g
FROM public.food_logs l
JOIN public.foods f ON f.id = l.food_id
JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.food_macros m ON m.food_id = l.food_id
WHERE l.deleted_at IS NULL;

-- Food search for the log screen. Prefix matches first, then shorter names.
-- Returns at most 25 rows whatever max_results is.
CREATE FUNCTION public.search_foods(query TEXT, max_results INTEGER DEFAULT 25)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    brand VARCHAR,
    serving_g DECIMAL,
    serving_label VARCHAR,
    kcal_per_100g DECIMAL,
    protein_g_per_100g DECIMAL,
    carb_g_per_100g DECIMAL,
    fat_g_per_100g DECIMAL
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        f.id, f.name, f.brand, f.serving_g, f.serving_label,
        m.kcal_per_100g, m.protein_g_per_100g, m.carb_g_per_100g, m.fat_g_per_100g
    FROM foods f
    LEFT JOIN food_macros m ON m.food_id = f.id
    WHERE f.name ILIKE '%' || query || '%'
    ORDER BY (f.name ILIKE query || '%') DESC, LENGTH(f.name), f.name
    LIMIT LEAST(GREATEST(max_results, 1), 25);
$$;

CREATE INDEX food_logs_user_logged_at_idx ON public.food_logs (user_id, logged_at);

GRANT SELECT ON public.food_macros TO authenticated, service_role;
GRANT SELECT ON public.food_log_entries TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.search_foods(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_foods(TEXT, INTEGER) TO authenticated, service_role;
