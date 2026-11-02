import type { DailyBrief } from '@/types/brief';

// Placeholder brief, consistent with the GET /today and /gap-closer fixtures.
export const dailyBriefFixture: DailyBrief = {
  date: '2026-10-09',
  summary:
    'Dinner can close your 48 g protein gap, and the chicken in your pantry expires tomorrow. Upper body today at normal effort.',
  expiring: [
    { pantry_item_id: 'p_91', name: 'Chicken breast', grams: 450, days_left: 1 },
    { pantry_item_id: 'p_23', name: 'Spinach', grams: 150, days_left: 2 },
    { pantry_item_id: 'p_88', name: 'Greek yogurt, plain, nonfat', grams: 500, days_left: 4 },
  ],
  deficiencies: [{ nutrient: 'Magnesium', pct_of_target_7d: 55 }],
  eat: {
    headline: 'Chicken and Greek yogurt for dinner',
    detail: '316 kcal · 58 g protein',
  },
  train: {
    kind: 'session',
    headline: 'Upper A, normal effort',
    detail: '5 exercises · 55 min',
    exercises: [
      { name: 'Bench press', sets: 3, reps_min: 6, reps_max: 8, weight_kg: 82.5, rir: 2 },
      { name: 'Barbell row', sets: 3, reps_min: 8, reps_max: 10, weight_kg: 70, rir: 2 },
      { name: 'Overhead press', sets: 3, reps_min: 6, reps_max: 8, weight_kg: 50, rir: 2 },
      { name: 'Lat pulldown', sets: 3, reps_min: 10, reps_max: 12, weight_kg: 60, rir: 1 },
      { name: 'Lateral raise', sets: 2, reps_min: 12, reps_max: 15, weight_kg: 10, rir: 1 },
    ],
  },
};
