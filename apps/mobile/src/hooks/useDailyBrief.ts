import { useQuery } from '@tanstack/react-query';

import { dailyBriefFixture } from '@/mocks/daily-brief';
import type { DailyBrief } from '@/types/brief';

// TODO(Brief): read today's rows from model_outputs and the pantry, then have the on-device
// LLM write `summary` from them. The numbers always come from the models, never the LLM.
export function useDailyBrief() {
  return useQuery({
    queryKey: ['brief', 'daily'],
    queryFn: async (): Promise<DailyBrief> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return dailyBriefFixture;
    },
  });
}
