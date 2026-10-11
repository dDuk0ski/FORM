import type { GapCloserResponse } from '@/types/api';

// Example payload for POST /gap-closer.
export const gapCloserFixture: GapCloserResponse = {
  remaining: { kcal: 612, protein_g: 48 },
  suggestions: [
    {
      rank: 1,
      items: [
        {
          food_id: 'f_2041',
          name: 'Greek yogurt, plain, nonfat',
          grams: 200,
          pantry_item_id: 'p_88',
        },
        { food_id: 'f_1177', name: 'Chicken breast, cooked', grams: 120, pantry_item_id: 'p_91' },
      ],
      totals: { kcal: 420, protein_g: 58, carb_g: 14, fat_g: 6 },
      fit: 0.93,
      reason: 'Uses chicken expiring tomorrow.',
    },
  ],
  shortfall: null,
  stub: true,
};
