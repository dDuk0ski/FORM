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

/** One way to measure a food, e.g. "1 medium (118 g)". */
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
  /** At least one option. The first is the default. */
  servings: ServingOption[];
}

/** One logged food. Nutrients are a snapshot, so later food edits do not rewrite history. */
export interface FoodLogEntry {
  /** Client-generated; makes retries idempotent. The backend may replace it with its own id. */
  id: string;
  food_id: FoodId;
  food_name: string;
  /** The day this entry counts toward (user's local day). */
  date: IsoDate;
  logged_at: IsoDateTime;
  serving_label: string;
  /** How many of `serving_label` were eaten. */
  serving_quantity: number;
  /** Total grams eaten: serving grams x quantity. */
  grams: number;
  /** Calculated from the food's per-100 g nutrients and `grams`. */
  nutrients: Macros;
}
