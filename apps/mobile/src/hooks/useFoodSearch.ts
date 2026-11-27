import { useQuery, useQueryClient } from '@tanstack/react-query';

import { foodService } from '@/api/foods';
import { MIN_QUERY_LENGTH, normalizeQuery } from '@/lib/foodSearch';
import type { FoodId } from '@/types/api';
import type { Food } from '@/types/food';

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

/**
 * One food by id. `data` is null when the id does not exist.
 *
 * A food may already be in the cache from somewhere other than getFood (a barcode lookup puts
 * the server's result there before food detail opens). If a later refetch cannot find it
 * through getFood, the cached food is kept instead of being replaced by null, so the screen
 * never blanks a food it was already showing.
 */
export function useFood(id: FoodId | undefined) {
  const queryClient = useQueryClient();
  const key = foodDetailKey(id ?? '');
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const food = await foodService.getFood(id ?? '');
      return food ?? queryClient.getQueryData<Food | null>(key) ?? null;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
