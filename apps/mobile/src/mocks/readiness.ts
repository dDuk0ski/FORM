import type { ReadinessResponse } from '@/types/api';

// Example payload for GET /readiness.
export const readinessFixture: ReadinessResponse = {
  date: '2026-10-09',
  score: 71,
  inputs: { sleep_h: 6.5, soreness: 3, stress: 2, hrv_ms: null, training_load_7d: 1840 },
  fatigue: 42,
  fitness: 58,
  advice: 'Normal session. Drop one set on squats if bar speed is slow.',
  source: 'manual',
  stub: true,
};
