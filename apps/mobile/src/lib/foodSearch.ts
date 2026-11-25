import type { Food } from '@/types/food';

export const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 25;

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Local text search over a list of foods, with the same rules as the `search_foods` SQL
 * function on main (supabase/migrations/20261101180200_add_food_views_and_search.sql):
 * the query must appear in the name or the brand (case-insensitive). Name prefix matches
 * rank first, then other name matches, then brand-only matches, then shorter names, then
 * alphabetical. At most 25 results, whatever `limit` asks for.
 */
export function filterFoods(foods: readonly Food[], query: string, limit = DEFAULT_LIMIT): Food[] {
  const normalized = normalizeQuery(query);
  if (normalized.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const matches = foods.flatMap((food) => {
    const name = food.name.toLowerCase();
    const brand = (food.brand ?? '').toLowerCase();
    const inName = name.includes(normalized);
    if (!inName && !brand.includes(normalized)) {
      return [];
    }
    const rank = name.startsWith(normalized) ? 0 : inName ? 1 : 2;
    return [{ food, rank }];
  });

  return matches
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.food.name.length - b.food.name.length ||
        a.food.name.localeCompare(b.food.name),
    )
    .slice(0, Math.min(Math.max(limit, 1), DEFAULT_LIMIT))
    .map((match) => match.food);
}
