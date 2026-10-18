import type { Food } from '@/types/food';

export const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 25;

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Local text search over a list of foods. Every word of the query must appear in the name
 * or brand. Names that start with the query rank first, then names with a word starting
 * with it, then everything else; ties sort alphabetically.
 */
export function filterFoods(foods: readonly Food[], query: string, limit = DEFAULT_LIMIT): Food[] {
  const normalized = normalizeQuery(query);
  if (normalized.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const words = normalized.split(' ');

  const matches = foods.flatMap((food) => {
    const name = food.name.toLowerCase();
    const haystack = `${name} ${(food.brand ?? '').toLowerCase()}`;
    if (!words.every((word) => haystack.includes(word))) {
      return [];
    }
    const rank = name.startsWith(normalized)
      ? 0
      : name.split(/[\s,]+/).some((part) => part.startsWith(words[0] ?? ''))
        ? 1
        : 2;
    return [{ food, rank }];
  });

  return matches
    .sort((a, b) => a.rank - b.rank || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((match) => match.food);
}
