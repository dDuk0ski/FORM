import { useQuery } from '@tanstack/react-query';

import { weeklyReportFixture } from '@/mocks/weekly-report';
import type { WeeklyReport } from '@/types/brief';

// TODO(Brief): build from the week's model_outputs rows once the weekly job writes them.
export function useWeeklyReport() {
  return useQuery({
    queryKey: ['brief', 'weekly'],
    queryFn: async (): Promise<WeeklyReport> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return weeklyReportFixture;
    },
  });
}
