-- FORM starter recipe catalog
-- Recipe instructions are stored as ordered JSONB arrays.
-- All recipes use real foods from the USDA food catalog.

INSERT INTO public.recipes (id, name, servings, steps, minutes, seeded)
VALUES

('00000000-0000-4000-8000-000000000001',
 'Blueberry Oatmeal', 2,
 '["Combine rolled oats and milk in a saucepan.", "Cook over medium heat until thickened.", "Top with blueberries and serve."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000002',
 'Banana Peanut Butter Oats', 2,
 '["Cook oats with milk until soft.", "Slice the banana.", "Stir in peanut butter and top with banana."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000003',
 'Veggie Omelet', 2,
 '["Whisk eggs together.", "Cook spinach and tomato in a skillet.", "Add eggs and cook until set.", "Fold and serve."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000004',
 'Egg and Avocado Toast', 2,
 '["Toast the bread.", "Cook or hard-boil the eggs.", "Mash avocado and spread over toast.", "Add sliced eggs."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000005',
 'Greek Yogurt Berry Bowl', 2,
 '["Add Greek yogurt to serving bowls.", "Top with blueberries and strawberries.", "Drizzle with honey."]',
 5, TRUE),

('00000000-0000-4000-8000-000000000006',
 'Chicken and Rice Bowl', 2,
 '["Prepare cooked white rice.", "Slice roasted chicken breast.", "Steam broccoli.", "Combine ingredients and serve."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000007',
 'Chicken Quinoa Bowl', 2,
 '["Prepare cooked quinoa.", "Slice roasted chicken breast.", "Chop tomato and spinach.", "Combine and serve."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000008',
 'Chicken Avocado Wrap', 2,
 '["Slice chicken breast and avocado.", "Place chicken, avocado, and romaine in tortillas.", "Roll tortillas tightly and serve."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000009',
 'Chicken Broccoli Bowl', 2,
 '["Prepare chicken breast.", "Steam broccoli until tender.", "Serve together with cooked brown rice."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000010',
 'Chicken Sweet Potato Plate', 2,
 '["Bake or reheat sweet potato.", "Slice roasted chicken breast.", "Steam broccoli.", "Plate and serve."]',
 25, TRUE),

('00000000-0000-4000-8000-000000000011',
 'Beef and Rice Bowl', 2,
 '["Warm cooked ground beef.", "Prepare cooked white rice.", "Cook onion until softened.", "Combine and serve."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000012',
 'Turkey Lettuce Bowls', 2,
 '["Warm cooked ground turkey with onion.", "Separate romaine lettuce leaves.", "Spoon turkey mixture into lettuce leaves."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000013',
 'Turkey Pasta', 2,
 '["Warm cooked ground turkey with chopped tomato.", "Prepare cooked pasta.", "Combine and serve."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000014',
 'Beef and Potato Skillet', 2,
 '["Dice baked potato.", "Warm ground beef in a skillet.", "Add potato and onion.", "Cook until heated through."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000015',
 'Turkey Quinoa Bowl', 2,
 '["Prepare cooked quinoa.", "Warm ground turkey.", "Add spinach and tomato.", "Combine and serve."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000016',
 'Salmon and Rice', 2,
 '["Prepare cooked rice.", "Reheat or cook salmon until fully cooked.", "Serve salmon over rice with broccoli."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000017',
 'Salmon Quinoa Bowl', 2,
 '["Prepare cooked quinoa.", "Cook salmon until it flakes easily.", "Add spinach and serve together."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000018',
 'Shrimp Pasta', 2,
 '["Prepare cooked pasta.", "Warm cooked shrimp with olive oil.", "Add spinach and combine with pasta."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000019',
 'Tuna Avocado Toast', 2,
 '["Toast whole-wheat bread.", "Mash avocado.", "Drain tuna.", "Spread avocado on toast and top with tuna."]',
 10, TRUE),

('00000000-0000-4000-8000-000000000020',
 'Shrimp Rice Bowl', 2,
 '["Prepare cooked rice.", "Warm cooked shrimp.", "Add broccoli and carrots.", "Combine and serve."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000021',
 'Tofu Rice Bowl', 2,
 '["Cube firm tofu.", "Cook tofu in olive oil until golden.", "Serve over cooked brown rice with broccoli."]',
 20, TRUE),

('00000000-0000-4000-8000-000000000022',
 'Lentil Stew', 2,
 '["Warm cooked lentils in a saucepan.", "Add carrots and onion.", "Simmer until vegetables are tender."]',
 25, TRUE),

('00000000-0000-4000-8000-000000000023',
 'Chickpea Quinoa Bowl', 2,
 '["Prepare cooked quinoa.", "Warm cooked chickpeas.", "Add tomato and spinach.", "Combine and serve."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000024',
 'Black Bean Burrito', 2,
 '["Warm cooked black beans.", "Place beans and cheddar cheese in tortillas.", "Roll and warm until cheese melts."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000025',
 'Hummus Veggie Wrap', 2,
 '["Spread hummus over flour tortillas.", "Add romaine, carrots, and tomato.", "Roll and serve."]',
 10, TRUE),

('00000000-0000-4000-8000-000000000026',
 'Cottage Cheese Berry Bowl', 2,
 '["Divide cottage cheese between bowls.", "Add blueberries and strawberries.", "Drizzle with honey."]',
 5, TRUE),

('00000000-0000-4000-8000-000000000027',
 'Peanut Butter Banana Toast', 2,
 '["Toast whole-wheat bread.", "Spread peanut butter over toast.", "Top with sliced banana."]',
 5, TRUE),

('00000000-0000-4000-8000-000000000028',
 'Protein Overnight Oats', 2,
 '["Combine rolled oats, milk, Greek yogurt, and whey protein.", "Refrigerate overnight.", "Top with blueberries before serving."]',
 5, TRUE),

('00000000-0000-4000-8000-000000000029',
 'Avocado Egg Toast', 2,
 '["Toast whole-wheat bread.", "Mash avocado.", "Cook eggs to preference.", "Spread avocado on toast and add eggs."]',
 15, TRUE),

('00000000-0000-4000-8000-000000000030',
 'Sweet Potato Chickpea Bowl', 2,
 '["Dice and bake sweet potato until tender.", "Warm cooked chickpeas.", "Serve together over spinach with olive oil."]',
 25, TRUE)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    servings = EXCLUDED.servings,
    steps = EXCLUDED.steps,
    minutes = EXCLUDED.minutes,
    seeded = EXCLUDED.seeded;

-- Recipe ingredients
-- Amounts are in grams for each recipe's base serving count.

INSERT INTO public.recipe_ingredients (recipe_id, food_id, grams)
SELECT
    r.id,
    f.id,
    i.grams
FROM (
    VALUES
    ('Blueberry Oatmeal', 'Oats, rolled, dry', 80::numeric),
    ('Blueberry Oatmeal', 'Milk, 2%', 300),
    ('Blueberry Oatmeal', 'Blueberries', 100),

    ('Banana Peanut Butter Oats', 'Oats, rolled, dry', 80),
    ('Banana Peanut Butter Oats', 'Milk, 2%', 300),
    ('Banana Peanut Butter Oats', 'Banana', 120),
    ('Banana Peanut Butter Oats', 'Peanut butter, smooth', 32),

    ('Veggie Omelet', 'Egg, whole, raw', 176),
    ('Veggie Omelet', 'Spinach, raw', 40),
    ('Veggie Omelet', 'Tomato, raw', 80),
    ('Veggie Omelet', 'Cheddar cheese', 30),

    ('Egg and Avocado Toast', 'Egg, hard-boiled', 100),
    ('Egg and Avocado Toast', 'Avocado', 100),
    ('Egg and Avocado Toast', 'Whole-wheat bread', 64),

    ('Greek Yogurt Berry Bowl', 'Greek yogurt, nonfat, plain', 340),
    ('Greek Yogurt Berry Bowl', 'Blueberries', 80),
    ('Greek Yogurt Berry Bowl', 'Strawberries', 80),
    ('Greek Yogurt Berry Bowl', 'Honey', 20),

    ('Chicken and Rice Bowl', 'Chicken breast, roasted', 200),
    ('Chicken and Rice Bowl', 'White rice, cooked', 316),
    ('Chicken and Rice Bowl', 'Broccoli, boiled', 120),

    ('Chicken Quinoa Bowl', 'Chicken breast, roasted', 200),
    ('Chicken Quinoa Bowl', 'Quinoa, cooked', 250),
    ('Chicken Quinoa Bowl', 'Tomato, raw', 80),
    ('Chicken Quinoa Bowl', 'Spinach, raw', 40),

    ('Chicken Avocado Wrap', 'Chicken breast, roasted', 180),
    ('Chicken Avocado Wrap', 'Avocado', 100),
    ('Chicken Avocado Wrap', 'Romaine lettuce', 60),
    ('Chicken Avocado Wrap', 'Flour tortilla', 100),

    ('Chicken Broccoli Bowl', 'Chicken breast, roasted', 200),
    ('Chicken Broccoli Bowl', 'Broccoli, boiled', 160),
    ('Chicken Broccoli Bowl', 'Brown rice, cooked', 250),

    ('Chicken Sweet Potato Plate', 'Chicken breast, roasted', 200),
    ('Chicken Sweet Potato Plate', 'Sweet potato, baked', 228),
    ('Chicken Sweet Potato Plate', 'Broccoli, boiled', 120),

    ('Beef and Rice Bowl', 'Ground beef 90/10, cooked', 200),
    ('Beef and Rice Bowl', 'White rice, cooked', 316),
    ('Beef and Rice Bowl', 'Onion, raw', 60),

    ('Turkey Lettuce Bowls', 'Ground turkey, cooked', 200),
    ('Turkey Lettuce Bowls', 'Romaine lettuce', 100),
    ('Turkey Lettuce Bowls', 'Onion, raw', 50),

    ('Turkey Pasta', 'Ground turkey, cooked', 200),
    ('Turkey Pasta', 'Pasta, cooked', 250),
    ('Turkey Pasta', 'Tomato, raw', 100),

    ('Beef and Potato Skillet', 'Ground beef 90/10, cooked', 200),
    ('Beef and Potato Skillet', 'Potato, baked, with skin', 250),
    ('Beef and Potato Skillet', 'Onion, raw', 60),

    ('Turkey Quinoa Bowl', 'Ground turkey, cooked', 200),
    ('Turkey Quinoa Bowl', 'Quinoa, cooked', 250),
    ('Turkey Quinoa Bowl', 'Spinach, raw', 40),
    ('Turkey Quinoa Bowl', 'Tomato, raw', 80),

    ('Salmon and Rice', 'Salmon, Atlantic, cooked', 170),
    ('Salmon and Rice', 'White rice, cooked', 316),
    ('Salmon and Rice', 'Broccoli, boiled', 120),

    ('Salmon Quinoa Bowl', 'Salmon, Atlantic, cooked', 170),
    ('Salmon Quinoa Bowl', 'Quinoa, cooked', 250),
    ('Salmon Quinoa Bowl', 'Spinach, raw', 40),

    ('Shrimp Pasta', 'Shrimp, cooked', 170),
    ('Shrimp Pasta', 'Pasta, cooked', 250),
    ('Shrimp Pasta', 'Spinach, raw', 40),
    ('Shrimp Pasta', 'Olive oil', 14),

    ('Tuna Avocado Toast', 'Tuna, canned in water', 165),
    ('Tuna Avocado Toast', 'Avocado', 100),
    ('Tuna Avocado Toast', 'Whole-wheat bread', 64),

    ('Shrimp Rice Bowl', 'Shrimp, cooked', 170),
    ('Shrimp Rice Bowl', 'White rice, cooked', 316),
    ('Shrimp Rice Bowl', 'Broccoli, boiled', 100),
    ('Shrimp Rice Bowl', 'Carrots, raw', 60),

    ('Tofu Rice Bowl', 'Tofu, firm', 250),
    ('Tofu Rice Bowl', 'Brown rice, cooked', 250),
    ('Tofu Rice Bowl', 'Broccoli, boiled', 120),
    ('Tofu Rice Bowl', 'Olive oil', 14),

    ('Lentil Stew', 'Lentils, cooked', 300),
    ('Lentil Stew', 'Carrots, raw', 100),
    ('Lentil Stew', 'Onion, raw', 80),

    ('Chickpea Quinoa Bowl', 'Chickpeas, cooked', 250),
    ('Chickpea Quinoa Bowl', 'Quinoa, cooked', 200),
    ('Chickpea Quinoa Bowl', 'Tomato, raw', 80),
    ('Chickpea Quinoa Bowl', 'Spinach, raw', 40),

    ('Black Bean Burrito', 'Black beans, cooked', 250),
    ('Black Bean Burrito', 'Flour tortilla', 100),
    ('Black Bean Burrito', 'Cheddar cheese', 40),

    ('Hummus Veggie Wrap', 'Hummus', 60),
    ('Hummus Veggie Wrap', 'Flour tortilla', 100),
    ('Hummus Veggie Wrap', 'Romaine lettuce', 60),
    ('Hummus Veggie Wrap', 'Carrots, raw', 60),
    ('Hummus Veggie Wrap', 'Tomato, raw', 60),

    ('Cottage Cheese Berry Bowl', 'Cottage cheese, 2%', 226),
    ('Cottage Cheese Berry Bowl', 'Blueberries', 80),
    ('Cottage Cheese Berry Bowl', 'Strawberries', 80),
    ('Cottage Cheese Berry Bowl', 'Honey', 20),

    ('Peanut Butter Banana Toast', 'Whole-wheat bread', 64),
    ('Peanut Butter Banana Toast', 'Peanut butter, smooth', 32),
    ('Peanut Butter Banana Toast', 'Banana', 120),

    ('Protein Overnight Oats', 'Oats, rolled, dry', 80),
    ('Protein Overnight Oats', 'Milk, 2%', 200),
    ('Protein Overnight Oats', 'Greek yogurt, nonfat, plain', 170),
    ('Protein Overnight Oats', 'Whey protein powder', 32),
    ('Protein Overnight Oats', 'Blueberries', 60),

    ('Avocado Egg Toast', 'Whole-wheat bread', 64),
    ('Avocado Egg Toast', 'Avocado', 100),
    ('Avocado Egg Toast', 'Egg, whole, raw', 88),

    ('Sweet Potato Chickpea Bowl', 'Sweet potato, baked', 228),
    ('Sweet Potato Chickpea Bowl', 'Chickpeas, cooked', 200),
    ('Sweet Potato Chickpea Bowl', 'Spinach, raw', 40),
    ('Sweet Potato Chickpea Bowl', 'Olive oil', 14)

) AS i(recipe_name, food_name, grams)
JOIN public.recipes r
    ON r.name = i.recipe_name
JOIN public.foods f
    ON f.name = i.food_name

ON CONFLICT (recipe_id, food_id)
DO UPDATE SET grams = EXCLUDED.grams;