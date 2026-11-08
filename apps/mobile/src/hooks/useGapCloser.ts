import { useMutation } from '@tanstack/react-query';

import { ml } from '@/api/ml';
import type { GapCloserRequest } from '@/types/api';

// A mutation, not a query: suggestions are asked for on a tap, not loaded with the screen.
export function useGapCloser() {
  return useMutation({ mutationFn: (body: GapCloserRequest) => ml.gapCloser(body) });
}
