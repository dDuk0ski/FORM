import type { FoodId, IsoDate, IsoDateTime, Macros } from '@/types/api';

// FRONTEND-ONLY, PROVISIONAL types for food search and food logging.
//
// These are NOT the agreed backend contract. Joey and Austen own the foods / food_logs
// schemas and the food API; until they confirm field names, these types describe what the
// UI needs and nothing else. When the contract lands, adapt it to these shapes inside
// src/api/foods.ts (so screens do not change), or change this file and the mock together.
//
// Conventions follow the README: grams are the only unit of mass, dates are "YYYY-MM-DD",
// timestamps are ISO 8601 UTC, and no user_id ever appears on the client.

/** Where food data comes from. "mock" until the real food API is wired in. */
export type FoodDataSource = 'mock' | 'api';

/** The food's default serving, e.g. "1 medium (118 g)". Custom grams is always available too. */
export interface ServingOption {
  id: string;
  label: string;
  /** Mass of ONE of this serving, in grams. */
  grams: number;
}

export interface Food {
  id: FoodId;
  name: string;
  brand: string | null;
  /** Nutrients for 100 g. Everything is scaled from this. */
  macros_per_100g: Macros;
  /** The default serving (the first one). Agreed plan: one per food, plus custom grams. */
  servings: ServingOption[];
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const LOG_SOURCES = ['manual', 'barcode', 'recipe', 'predicted'] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

/**
 * What the app sends to log a food. This mirrors the agreed food_logs row (Oct 25 team
 * decisions): food id and grams, plus the serving the person picked. It carries NO food
 * name and NO nutrient copies, and no user_id (the server takes that from the session).
 */
export interface NewFoodLog {
  /** UUID generated on the device, so a retried save cannot create a duplicate. */
  id: string;
  food_id: FoodId;
  logged_at: IsoDateTime;
  /** Total grams eaten. */
  grams: number;
  meal: MealType;
  source: LogSource;
  /** Null when the person entered custom grams instead of picking a serving. */
  serving_label: string | null;
  /** How many of `serving_label` were eaten. Null for custom grams. */
  serving_quantity: number | null;
}

/** A stored food log row. Deletes are soft: the row stays, with `deleted_at` set. */
export interface StoredFoodLog extends NewFoodLog {
  deleted_at: IsoDateTime | null;
}

/**
 * One logged food as the screens show it: a log row joined to its food, with nutrients
 * calculated from the food's per-100 g values. Never stored; always derived.
 */
export interface FoodLogEntry {
  id: string;
  food_id: FoodId;
  food_name: string;
  /** The user's local day this entry counts toward, derived from `logged_at`. */
  date: IsoDate;
  logged_at: IsoDateTime;
  meal: MealType;
  source: LogSource;
  serving_label: string | null;
  serving_quantity: number | null;
  grams: number;
  /** Calculated from the food's per-100 g nutrients and `grams`. */
  nutrients: Macros;
}
