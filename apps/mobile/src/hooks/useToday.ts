import { useQuery } from '@tanstack/react-query';

import { ml } from '@/api/ml';
import type { TodayQuery } from '@/types/api';

// The pattern for every ML read: one hook per route, keyed by route and params.
// TODO(Today): invalidate ['ml', 'today'] after logging food or cooking a recipe, so the
// remaining targets refresh.
export function useToday(query: TodayQuery = {}) {
  return useQuery({
    queryKey: ['ml', 'today', query.date ?? 'local'],
    queryFn: () => ml.getToday(query),
  });
}
