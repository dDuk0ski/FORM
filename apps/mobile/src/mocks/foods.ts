import type { Food } from '@/types/food';

// SAMPLE DATA for development only. Values are rounded approximations of common foods and
// are NOT authoritative nutrition data. The five f_0455 / f_0931 / f_1177 / f_2041 / f_7712
// ids match the food_ids already used in the ML fixtures; the f_9xxx ids are placeholders.
// Replaced by the team's food API once the contract is agreed (see docs/BACKEND_HANDOFF.md).

const g100 = { id: '100g', label: '100 g', grams: 100 } as const;

export const foodsFixture: Food[] = [
  {
    id: 'f_0455',
    name: 'Banana, raw',
    brand: null,
    macros_per_100g: { kcal: 89, protein_g: 1.1, carb_g: 22.8, fat_g: 0.3 },
    servings: [{ id: 'medium', label: '1 medium (118 g)', grams: 118 }, g100],
  },
  {
    id: 'f_9001',
    name: 'Apple, raw',
    brand: null,
    macros_per_100g: { kcal: 52, protein_g: 0.3, carb_g: 13.8, fat_g: 0.2 },
    servings: [{ id: 'medium', label: '1 medium (182 g)', grams: 182 }, g100],
  },
  {
    id: 'f_9002',
    name: 'Orange, raw',
    brand: null,
    macros_per_100g: { kcal: 47, protein_g: 0.9, carb_g: 11.8, fat_g: 0.1 },
    servings: [{ id: 'medium', label: '1 medium (131 g)', grams: 131 }, g100],
  },
  {
    id: 'f_0931',
    name: 'Oats, rolled, dry',
    brand: null,
    macros_per_100g: { kcal: 379, protein_g: 13.2, carb_g: 67.7, fat_g: 6.5 },
    servings: [{ id: 'half-cup', label: '1/2 cup (40 g)', grams: 40 }, g100],
  },
  {
    id: 'f_7712',
    name: 'Whey protein powder',
    brand: null,
    macros_per_100g: { kcal: 400, protein_g: 80, carb_g: 8, fat_g: 6 },
    servings: [{ id: 'scoop', label: '1 scoop (30 g)', grams: 30 }, g100],
  },
  {
    id: 'f_2041',
    name: 'Greek yogurt, plain, nonfat',
    brand: null,
    macros_per_100g: { kcal: 59, protein_g: 10.2, carb_g: 3.6, fat_g: 0.4 },
    servings: [
      { id: 'container', label: '1 container (170 g)', grams: 170 },
      { id: 'cup', label: '1 cup (245 g)', grams: 245 },
      g100,
    ],
  },
  {
    id: 'f_1177',
    name: 'Chicken breast, cooked',
    brand: null,
    macros_per_100g: { kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6 },
    servings: [{ id: '3oz', label: '3 oz (85 g)', grams: 85 }, g100],
  },
  {
    id: 'f_9003',
    name: 'Ground beef, 90% lean, cooked',
    brand: null,
    macros_per_100g: { kcal: 217, protein_g: 26.1, carb_g: 0, fat_g: 11.7 },
    servings: [{ id: '3oz', label: '3 oz (85 g)', grams: 85 }, g100],
  },
  {
    id: 'f_9004',
    name: 'Salmon, Atlantic, cooked',
    brand: null,
    macros_per_100g: { kcal: 206, protein_g: 22.1, carb_g: 0, fat_g: 12.4 },
    servings: [{ id: '3oz', label: '3 oz (85 g)', grams: 85 }, g100],
  },
  {
    id: 'f_9005',
    name: 'Egg, whole, large',
    brand: null,
    macros_per_100g: { kcal: 143, protein_g: 12.6, carb_g: 0.7, fat_g: 9.5 },
    servings: [{ id: 'large', label: '1 large (50 g)', grams: 50 }, g100],
  },
  {
    id: 'f_9006',
    name: 'Tofu, firm',
    brand: null,
    macros_per_100g: { kcal: 144, protein_g: 17.3, carb_g: 2.8, fat_g: 8.7 },
    servings: [{ id: 'half-cup', label: '1/2 cup (126 g)', grams: 126 }, g100],
  },
  {
    id: 'f_9007',
    name: 'Black beans, cooked',
    brand: null,
    macros_per_100g: { kcal: 132, protein_g: 8.9, carb_g: 23.7, fat_g: 0.5 },
    servings: [{ id: 'half-cup', label: '1/2 cup (86 g)', grams: 86 }, g100],
  },
  {
    id: 'f_9008',
    name: 'White rice, cooked',
    brand: null,
    macros_per_100g: { kcal: 130, protein_g: 2.7, carb_g: 28.2, fat_g: 0.3 },
    servings: [{ id: 'cup', label: '1 cup (158 g)', grams: 158 }, g100],
  },
  {
    id: 'f_9009',
    name: 'Brown rice, cooked',
    brand: null,
    macros_per_100g: { kcal: 123, protein_g: 2.7, carb_g: 25.6, fat_g: 1 },
    servings: [{ id: 'cup', label: '1 cup (195 g)', grams: 195 }, g100],
  },
  {
    id: 'f_9010',
    name: 'Pasta, cooked',
    brand: null,
    macros_per_100g: { kcal: 158, protein_g: 5.8, carb_g: 30.9, fat_g: 0.9 },
    servings: [{ id: 'cup', label: '1 cup (140 g)', grams: 140 }, g100],
  },
  {
    id: 'f_9011',
    name: 'Sweet potato, baked',
    brand: null,
    macros_per_100g: { kcal: 90, protein_g: 2, carb_g: 20.7, fat_g: 0.2 },
    servings: [{ id: 'medium', label: '1 medium (114 g)', grams: 114 }, g100],
  },
  {
    id: 'f_9012',
    name: 'Broccoli, cooked',
    brand: null,
    macros_per_100g: { kcal: 35, protein_g: 2.4, carb_g: 7.2, fat_g: 0.4 },
    servings: [{ id: 'cup', label: '1 cup (156 g)', grams: 156 }, g100],
  },
  {
    id: 'f_9013',
    name: 'Avocado, raw',
    brand: null,
    macros_per_100g: { kcal: 160, protein_g: 2, carb_g: 8.5, fat_g: 14.7 },
    servings: [{ id: 'half', label: '1/2 avocado (100 g)', grams: 100 }],
  },
  {
    id: 'f_9014',
    name: 'Whole wheat bread',
    brand: null,
    macros_per_100g: { kcal: 247, protein_g: 13, carb_g: 41.3, fat_g: 3.4 },
    servings: [{ id: 'slice', label: '1 slice (28 g)', grams: 28 }, g100],
  },
  {
    id: 'f_9015',
    name: 'Peanut butter',
    brand: null,
    macros_per_100g: { kcal: 588, protein_g: 25.1, carb_g: 20, fat_g: 50.4 },
    servings: [{ id: '2tbsp', label: '2 tbsp (32 g)', grams: 32 }, g100],
  },
  {
    id: 'f_9016',
    name: 'Almonds',
    brand: null,
    macros_per_100g: { kcal: 579, protein_g: 21.2, carb_g: 21.6, fat_g: 49.9 },
    servings: [{ id: 'oz', label: '1 oz (28 g)', grams: 28 }, g100],
  },
  {
    id: 'f_9017',
    name: 'Olive oil',
    brand: null,
    macros_per_100g: { kcal: 884, protein_g: 0, carb_g: 0, fat_g: 100 },
    servings: [{ id: 'tbsp', label: '1 tbsp (14 g)', grams: 14 }],
  },
  {
    id: 'f_9018',
    name: 'Milk, whole',
    brand: null,
    macros_per_100g: { kcal: 61, protein_g: 3.2, carb_g: 4.8, fat_g: 3.3 },
    servings: [{ id: 'cup', label: '1 cup (244 g)', grams: 244 }, g100],
  },
  {
    id: 'f_9019',
    name: 'Cheddar cheese',
    brand: null,
    macros_per_100g: { kcal: 403, protein_g: 24.9, carb_g: 1.3, fat_g: 33.1 },
    servings: [{ id: 'slice', label: '1 slice (28 g)', grams: 28 }, g100],
  },
];
