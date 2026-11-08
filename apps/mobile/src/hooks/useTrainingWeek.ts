import { useQuery } from '@tanstack/react-query';

import { trainingWeekFixture } from '@/mocks/training';
import type { TrainingWeek } from '@/types/training';

// TODO(Train): the generator's plan and the progression model's decisions, read from
// model_outputs once the training model is served; preferences from training_preferences.
export function useTrainingWeek() {
  return useQuery({
    queryKey: ['training', 'week'],
    queryFn: async (): Promise<TrainingWeek> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return trainingWeekFixture;
    },
  });
}
