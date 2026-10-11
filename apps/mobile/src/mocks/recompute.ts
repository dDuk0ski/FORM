import type { RecomputeResponse } from '@/types/api';

// Example payload for POST /recompute. The app never calls this route (it runs
// with the service key from the nightly job); the fixture keeps the contract documented here.
export const recomputeFixture: RecomputeResponse = {
  rows_written: 15,
  tdee_estimate: 2710,
  stub: true,
};
