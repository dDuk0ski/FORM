-- Treat % and _ in a search as literal characters, not ILIKE wildcards,
-- so typing "%" doesn't match every food.
CREATE OR REPLACE FUNCTION public.search_foods(query TEXT, max_results INTEGER DEFAULT 25)
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
    FROM (
        SELECT REPLACE(REPLACE(REPLACE(query, '\', '\\'), '%', '\%'), '_', '\_') AS q
    ) s
    CROSS JOIN foods f
    LEFT JOIN food_macros m ON m.food_id = f.id
    WHERE f.name ILIKE '%' || s.q || '%'
       OR f.brand ILIKE '%' || s.q || '%'
    ORDER BY
        (f.name ILIKE s.q || '%') DESC,
        (f.name ILIKE '%' || s.q || '%') DESC,
        LENGTH(f.name),
        f.name
    LIMIT LEAST(GREATEST(max_results, 1), 25);
$$;
