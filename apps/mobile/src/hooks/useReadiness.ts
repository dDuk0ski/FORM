import { useQuery } from '@tanstack/react-query';

import { ml } from '@/api/ml';
import type { ReadinessQuery } from '@/types/api';

// TODO(Readiness): invalidate ['ml', 'readiness'] after a check-in is saved.
export function useReadiness(query: ReadinessQuery = {}) {
  return useQuery({
    queryKey: ['ml', 'readiness', query.date ?? 'local'],
    queryFn: () => ml.getReadiness(query),
  });
}
