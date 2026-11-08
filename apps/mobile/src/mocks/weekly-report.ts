import type { WeeklyReport } from '@/types/brief';

// Placeholder weekly report, consistent with the daily fixtures.
export const weeklyReportFixture: WeeklyReport = {
  week_start: '2026-10-03',
  week_end: '2026-10-09',
  recommendations: [
    'Keep calories at 2,680. You lost 0.4 kg, right on pace.',
    'Add a set to rows and pulldowns. Both stalled at the same reps and weight.',
    'Hit protein on weekends. You reached it 5 of 7 days and missed both weekend days.',
  ],
  body_weight: {
    headline: 'Down 0.4 kg, on pace for your goal',
    start_kg: 82.8,
    end_kg: 82.4,
    goal_kg_per_week: -0.4,
    trend_kg: [82.8, 82.74, 82.69, 82.61, 82.55, 82.46, 82.4],
  },
  real_burn: {
    headline: 'Your burn is holding steady',
    tdee_kcal: 2710,
    change_kcal: 40,
    formula_kcal: 2590,
  },
  strength: {
    headline: 'Pressing is up, pulling stalled',
    lifts: [
      { name: 'Bench press', progressed_by: 'reps', summary: '80 kg for 8 reps, up from 7' },
      { name: 'Back squat', progressed_by: 'weight', summary: '102.5 kg for 5, up 2.5 kg' },
      { name: 'Barbell row', progressed_by: 'none', summary: '70 kg for 8, same as last week' },
    ],
  },
  difficulty: {
    headline: 'Moderate week with room to push',
    avg_rir: 2.3,
    sessions_done: 4,
    sessions_planned: 4,
    avg_readiness: 72,
  },
  adherence: {
    headline: 'Close, but protein slipped on weekends',
    days_on_target: 5,
    days_logged: 7,
    macros: [
      { label: 'Calories', pct: 98 },
      { label: 'Protein', pct: 91 },
      { label: 'Carbs', pct: 102 },
      { label: 'Fat', pct: 96 },
    ],
  },
};
