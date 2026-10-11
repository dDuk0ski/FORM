import type { NextSetResponse } from '@/types/api';

// Example payload for GET /next-set.
export const nextSetFixture: NextSetResponse = {
  exercise_id: 'e_squat_back',
  suggested: { weight_kg: 102.5, reps: 5, rir: 2 },
  last_session: { date: '2026-10-05', top_set: { weight_kg: 100, reps: 5, rir: 2 } },
  e1rm_estimate: 118.3,
  e1rm_trend_28d: 2.4,
  plateau: false,
  note: 'Up 2.5 kg from last session.',
  stub: true,
};
