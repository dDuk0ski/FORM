// Request and response shapes for the ML service. This file is the contract: change it,
// the fixtures in src/mocks/ and the service's Pydantic models together, in one PR.
//
// Conventions:
// - Dates are "YYYY-MM-DD" strings, timestamps are ISO 8601 UTC strings.
// - Grams are the only unit for food quantities.
// - `stub: true` is present while a route returns fixed data. It disappears when the real
//   model lands, so it is optional here.

export type IsoDate = string;
export type IsoDateTime = string;
export type FoodId = string;
export type PantryItemId = string;
export type ExerciseId = string;

type StubFlag = { stub?: true };

/** Error body for every non-2xx response: 401, 404, 422, 503. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

// ---------------------------------------------------------------------------
// GET /today

export interface TodayQuery {
  /** Defaults to the user's local today. */
  date?: IsoDate;
}

export interface TodayResponse extends StubFlag {
  date: IsoDate;
  targets: Macros;
  consumed: Macros;
  remaining: Macros;
  tdee_estimate: number;
  /** Same values as the `targets.source` column. */
  target_source: 'formula' | 'adaptive';
  rationale: string;
  readiness: { score: number; advice: string };
  protein_split: { meals_logged: number; largest_meal_g: number; advice: string };
  micronutrient_flags: MicronutrientFlag[];
  /** 0 to 1. */
  log_quality: number;
}

export interface MicronutrientFlag {
  nutrient: string;
  pct_of_rda_7d: number;
  /** 0 to 1. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// POST /gap-closer

export type MealSize = 'snack' | 'meal' | 'rest_of_day';

export interface GapCloserRequest {
  /** Defaults to "meal". */
  meal_size?: MealSize;
  max_items: number;
  exclude_food_ids: FoodId[];
}

export interface GapCloserResponse extends StubFlag {
  remaining: Pick<Macros, 'kcal' | 'protein_g'>;
  suggestions: GapCloserSuggestion[];
  /** Null when the pantry can close the gap. */
  shortfall: GapCloserShortfall | null;
}

export interface GapCloserSuggestion {
  rank: number;
  items: GapCloserItem[];
  totals: Macros;
  /** 0 to 1 against the remaining targets. */
  fit: number;
  reason: string;
}

export interface GapCloserItem {
  food_id: FoodId;
  name: string;
  grams: number;
  pantry_item_id: PantryItemId;
}

export interface GapCloserShortfall {
  /** A macro key such as "protein_g". */
  nutrient: string;
  amount: number;
  suggested_foods: FoodId[];
}

// ---------------------------------------------------------------------------
// POST /predict-meal

export interface PredictMealRequest {
  at: IsoDateTime;
  limit: number;
}

export interface PredictMealResponse extends StubFlag {
  predictions: MealPrediction[];
}

export interface MealPrediction {
  label: string;
  /** 0 to 1. */
  confidence: number;
  items: { food_id: FoodId; grams: number }[];
  last_logged: IsoDateTime;
}

// ---------------------------------------------------------------------------
// GET /next-set

export interface NextSetQuery {
  exercise_id: ExerciseId;
  /** Defaults to 1. */
  set_index?: number;
}

export interface SetPrescription {
  weight_kg: number;
  reps: number;
  /** Reps in reserve. */
  rir: number;
}

export interface NextSetResponse extends StubFlag {
  exercise_id: ExerciseId;
  suggested: SetPrescription;
  last_session: { date: IsoDate; top_set: SetPrescription };
  e1rm_estimate: number;
  e1rm_trend_28d: number;
  plateau: boolean;
  note: string;
}

// ---------------------------------------------------------------------------
// GET /readiness

export interface ReadinessQuery {
  date?: IsoDate;
}

export interface ReadinessResponse extends StubFlag {
  date: IsoDate;
  score: number;
  inputs: {
    sleep_h: number;
    /** 1 to 5. */
    soreness: number;
    /** 1 to 5. */
    stress: number;
    /** Premium only (HealthKit). */
    hrv_ms: number | null;
    training_load_7d: number;
  };
  fatigue: number;
  fitness: number;
  advice: string;
  /** "wearable" is premium with HealthKit present. */
  source: 'manual' | 'wearable';
}

// ---------------------------------------------------------------------------
// POST /receipt

export interface ReceiptRequest {
  /** Path of an image already uploaded to Supabase Storage. */
  storage_path: string;
}

export interface ReceiptResponse extends StubFlag {
  items: ReceiptItem[];
  unmatched: string[];
}

export interface ReceiptItem {
  raw_text: string;
  food_id: FoodId;
  name: string;
  grams: number;
  /** 0 to 1. Below 0.6 is flagged in the UI; every item needs user confirmation. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// POST /recompute
// Called by the nightly job with the service key. The app never calls it; the types are
// here so the contract stays in one place.

export interface RecomputeRequest {
  user_id: string;
  from: IsoDate;
  to: IsoDate;
}

export interface RecomputeResponse extends StubFlag {
  rows_written: number;
  tdee_estimate: number;
}
