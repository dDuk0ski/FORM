import { useQuery } from '@tanstack/react-query';

import { foodService } from '@/api/foods';
import { MIN_QUERY_LENGTH, normalizeQuery } from '@/lib/foodSearch';
import type { FoodId } from '@/types/api';

export const foodSearchKey = (query: string) => ['foods', 'search', query] as const;
export const foodDetailKey = (id: FoodId) => ['foods', 'detail', id] as const;

// retry is off for food reads: failures show a "Try again" button right away rather than
// retrying silently for several seconds. Revisit when the real API (and real network
// flakiness) is wired in.

/** Search results for `query`. Idle (no request) until the query is long enough. */
export function useFoodSearch(query: string) {
  const normalized = normalizeQuery(query);
  return useQuery({
    queryKey: foodSearchKey(normalized),
    queryFn: () => foodService.searchFoods(normalized),
    enabled: normalized.length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** One food by id. `data` is null when the id does not exist. */
export function useFood(id: FoodId | undefined) {
  return useQuery({
    queryKey: foodDetailKey(id ?? ''),
    queryFn: () => foodService.getFood(id ?? ''),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
