import { useQuery } from '@tanstack/react-query';

import { nutritionDayFixture } from '@/mocks/nutrition-day';
import type { NutritionDay } from '@/types/nutrition';

// TODO(Today): replace the placeholder with a Supabase query: the user's food_logs for their
// local day (deleted_at is null) joined to foods and food_nutrients, summed per meal. Unknown
// nutrient values are left out of the sums and lower known_fraction; they never count as zero.
export function useNutritionDay(date?: string) {
  return useQuery({
    queryKey: ['nutrition-day', date ?? 'local'],
    queryFn: async (): Promise<NutritionDay> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return nutritionDayFixture;
    },
  });
}
