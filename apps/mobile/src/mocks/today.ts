import type { TodayResponse } from '@/types/api';

// Example payload for GET /today.
export const todayFixture: TodayResponse = {
  date: '2026-10-09',
  targets: { kcal: 2680, protein_g: 175, carb_g: 300, fat_g: 85 },
  consumed: { kcal: 2068, protein_g: 127, carb_g: 242, fat_g: 61 },
  remaining: { kcal: 612, protein_g: 48, carb_g: 58, fat_g: 24 },
  tdee_estimate: 2710,
  target_source: 'adaptive',
  rationale: 'Weight trend fell 0.4 kg over 14 days on 2,560 kcal average.',
  readiness: { score: 71, advice: 'Normal session.' },
  protein_split: { meals_logged: 3, largest_meal_g: 52, advice: 'Aim for 40 g at dinner.' },
  micronutrient_flags: [{ nutrient: 'magnesium', pct_of_rda_7d: 55, confidence: 0.8 }],
  log_quality: 0.82,
  stub: true,
};
