import type { SFSymbol } from 'expo-symbols';

import type { ColorTokens } from '@/theme';
import type {
  PerformanceClass,
  Progression,
  ProgressionAction,
  RepPosition,
  SessionExercise,
} from '@/types/training';

export const ACTIONS: ProgressionAction[] = [
  'increase_weight',
  'increase_reps',
  'maintain',
  'decrease',
];

export const ACTION_INFO: Record<
  ProgressionAction,
  { label: string; icon: SFSymbol; color: keyof ColorTokens }
> = {
  increase_weight: { label: 'Add weight', icon: 'arrow.up', color: 'readiness' },
  increase_reps: { label: 'Add reps', icon: 'arrow.up', color: 'readiness' },
  maintain: { label: 'Hold', icon: 'equal', color: 'textMuted' },
  decrease: { label: 'Go lighter', icon: 'arrow.down', color: 'alert' },
};

export const PERFORMANCE_LABEL: Record<PerformanceClass, string> = {
  excellent: 'Excellent',
  good: 'Good',
  moderate: 'Moderate',
  poor: 'Poor',
  failure: 'Missed reps',
};

export const REP_POSITION_LABEL: Record<RepPosition, string> = {
  below_range: 'Bottom of range',
  mid_range: 'Middle of range',
  top_of_range: 'Top of range',
};

/** One sentence on why the model chose this action, from what it saw last session. */
export function explain(p: Progression): string {
  const position = {
    below_range: 'near the bottom of the rep range',
    mid_range: 'in the middle of the rep range',
    top_of_range: 'at the top of the rep range',
  }[p.rep_position];
  switch (p.action) {
    case 'increase_weight':
      return `You finished ${position} with reps to spare, so the weight goes up.`;
    case 'increase_reps':
      return `You finished ${position} with good form, so aim for one more rep per set.`;
    case 'maintain':
      return `You finished ${position} and ran out of reps in reserve. Same weight, same reps, until it moves.`;
    case 'decrease':
      return `You missed reps last time. A lighter load this session keeps the progress going.`;
  }
}

/** Reps to pre-fill in the logger: what last session suggests for today's set. */
export function suggestedReps(ex: SessionExercise, setIndex: number): number {
  const last = ex.last_session.sets[setIndex]?.reps ?? ex.reps_min;
  switch (ex.progression.action) {
    case 'increase_weight':
      return ex.reps_min;
    case 'increase_reps':
      return Math.min(ex.reps_max, last + 1);
    default:
      return Math.max(ex.reps_min, Math.min(ex.reps_max, last));
  }
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
