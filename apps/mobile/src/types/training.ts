// Shapes for the Train tab, following the training model on feature/workout-ml: the workout
// generator (split templates, sets, rep range, RIR, rest, weekly volume per muscle) and the
// progression model (one of four actions per exercise, with a probability for each). Until
// the model is served these come from fixtures. Not part of the ML service contract yet.

export type ProgressionAction = 'increase_weight' | 'increase_reps' | 'maintain' | 'decrease';
export type PerformanceClass = 'excellent' | 'good' | 'moderate' | 'poor' | 'failure';
export type RepPosition = 'below_range' | 'mid_range' | 'top_of_range';
export type ExerciseRole = 'primary' | 'secondary' | 'accessory';

export interface TrainingWeek {
  split: string;
  split_label: string;
  week_number: number;
  /** Monday first, seven entries. */
  days: PlanDay[];
  today: TodaySession;
  /** Hard sets per muscle this week against the generator's target. */
  volume: { muscle: string; sets: number; target: number }[];
  preferences: TrainingPreferences;
}

export interface PlanDay {
  weekday: string;
  /** Session name, or null on a rest day. */
  name: string | null;
  status: 'done' | 'today' | 'upcoming' | 'rest';
}

export interface TodaySession {
  name: string;
  /** From readiness: the effort the session is pitched at. */
  effort: string;
  estimated_minutes: number;
  target_muscles: string[];
  exercises: SessionExercise[];
}

export interface SessionExercise {
  id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  role: ExerciseRole;
  sets: number;
  reps_min: number;
  reps_max: number;
  rir: number;
  rest_seconds: number;
  weight_kg: number;
  progression: Progression;
  last_session: { date: string; sets: SetResult[] };
  /** Estimated one-rep max over recent sessions, oldest first. */
  e1rm_trend: number[];
}

/** What the progression model decided for this exercise, and why. */
export interface Progression {
  action: ProgressionAction;
  /** Short label for the change, e.g. "+2.5 kg" or "+1 rep". */
  change: string;
  /** Model probability for each action; sums to 1. */
  probabilities: Record<ProgressionAction, number>;
  performance: PerformanceClass;
  rep_position: RepPosition;
  /** Sessions of this exercise the model has seen for this user. */
  sessions_seen: number;
}

export interface SetResult {
  weight_kg: number;
  reps: number;
  rir: number;
  completed: boolean;
}

export interface TrainingPreferences {
  goal: 'hypertrophy' | 'strength' | 'general_fitness';
  experience: 'beginner' | 'intermediate' | 'advanced';
  split: string;
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
}
