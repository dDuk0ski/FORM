// Shapes for the daily brief and the weekly report. The models write their results to
// model_outputs and the on-device LLM writes the summary sentences from them; until that
// exists these come from fixtures. Not part of the ML service contract yet.

export interface DailyBrief {
  date: string;
  /** One or two sentences written by the on-device LLM from the model outputs. */
  summary: string;
  expiring: ExpiringItem[];
  /** Nutrients under target on the 7-day average, worst first. */
  deficiencies: { nutrient: string; pct_of_target_7d: number }[];
  eat: { headline: string; detail: string };
  train: TrainingPlan;
}

export interface ExpiringItem {
  pantry_item_id: string;
  name: string;
  grams: number;
  /** 0 means today. */
  days_left: number;
}

export interface TrainingPlan {
  kind: 'session' | 'rest';
  headline: string;
  detail: string;
  exercises: PlannedExercise[];
}

export interface PlannedExercise {
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number;
  rir: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  /** What to do or change next week, most important first. Shown before any numbers. */
  recommendations: string[];
  body_weight: {
    headline: string;
    start_kg: number;
    end_kg: number;
    goal_kg_per_week: number;
    /** Daily trend weight across the week, oldest first. */
    trend_kg: number[];
  };
  real_burn: { headline: string; tdee_kcal: number; change_kcal: number; formula_kcal: number };
  strength: { headline: string; lifts: LiftProgress[] };
  difficulty: {
    headline: string;
    avg_rir: number;
    sessions_done: number;
    sessions_planned: number;
    avg_readiness: number;
  };
  adherence: {
    headline: string;
    days_on_target: number;
    days_logged: number;
    /** Average intake as a percentage of target. */
    macros: { label: string; pct: number }[];
  };
}

export interface LiftProgress {
  name: string;
  /** What moved this week: reps at the same weight, weight at the same reps, or nothing. */
  progressed_by: 'reps' | 'weight' | 'none';
  summary: string;
}
