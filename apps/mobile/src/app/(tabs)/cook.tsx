import { Screen } from '@/components';

// Cook: seeded recipes and what can be made from the pantry right now.
// TODO(Cook): list `recipes` with `recipe_ingredients`, and a "Cook Now"
// filter showing only recipes makeable from current pantry_items.
// TODO(Cook): cooking calls the log_cooked_recipe Postgres function
// (recipe_id, servings_made, servings_eaten), which logs the meal and deducts stock in one
// transaction. Invalidate ['ml', 'today'] afterwards.
export default function CookScreen() {
  return <Screen title="Cook" />;
}
