import { useQuery } from '@tanstack/react-query';

import { isAssistantAvailable, summarizeDay, type DaySummaryInput } from '@/lib/assistant';
import type { TodayResponse } from '@/types/api';

const FIVE_MINUTES = 5 * 60 * 1000;

/** The day-summary prompt input, built from GET /today. */
export function daySummaryInput(
  today: TodayResponse,
  workoutDone: boolean | null = null,
): DaySummaryInput {
  return {
    date: today.date,
    targets: today.targets,
    consumed: today.consumed,
    remaining: today.remaining,
    rationale: today.rationale,
    workout_done: workoutDone,
    readiness_score: today.readiness.score,
  };
}

// On-device day summary for the Today card. Keyed on the numbers, so it re-runs only when
// the day changes (a food log, a new target). Disabled when the assistant isn't available;
// `data` is then undefined and the card stays hidden.
// TODO(Today): pass workoutDone once Today reads today's workouts.
export function useDaySummary(
  today: TodayResponse | undefined,
  workoutDone: boolean | null = null,
) {
  const input = today ? daySummaryInput(today, workoutDone) : null;
  return useQuery({
    queryKey: ['assistant', 'day-summary', input],
    queryFn: () => summarizeDay(input as DaySummaryInput),
    enabled: input !== null && isAssistantAvailable(),
    staleTime: FIVE_MINUTES,
    retry: false,
  });
}
