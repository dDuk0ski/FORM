import type { SupabaseClient } from '@supabase/supabase-js';

import { nowUtcIso } from '@/lib/dates';
import { MIN_QUERY_LENGTH, normalizeQuery } from '@/lib/foodSearch';
import { round1 } from '@/lib/nutrition';
import type { FoodId, IsoDate } from '@/types/api';
import {
  LOG_SOURCES,
  MEAL_TYPES,
  type Food,
  type FoodLogEntry,
  type FoodMacros,
  type LogSource,
  type MealType,
  type NewFoodLog,
  type NutrientValue,
} from '@/types/food';

import { FoodServiceError, type FoodService } from './foods.types';

// FoodService backed by Supabase, using the names from PR #4 (origin/db/schema-gaps,
// supabase/migrations/20261101180200_add_food_views_and_search.sql):
//   search    rpc search_foods(query, max_results)  (server caps at 25 rows)
//   detail    foods + food_macros view
//   read log  food_log_entries view, by local_date, ordered by logged_at (soft-deleted excluded)
//   write     food_logs: insert with an app-generated id; soft delete sets deleted_at
// RLS scopes every row to the signed-in user. The app never sends user_id.
//
// KNOWN BLOCKER: inserts fail until food_logs.user_id gets a default (e.g. DEFAULT auth.uid()).
// It is NOT NULL with no default (20261022210543_add_foods_and_food_logs.sql) and PR #4 does not
// change it. This file does not work around that. Reads and inserts also need a signed-in
// session, which the app does not have yet (no sign-in screen).
//
// Unknown nutrients are null (is_known = false) and stay null here, never 0.
// Not used unless EXPO_PUBLIC_USE_MOCKS=0 (see foods.ts).

/** The part of the Supabase client this service uses; tests pass a fake. */
export type FoodsClient = Pick<SupabaseClient, 'from' | 'rpc'>;

const SEARCH_LIMIT = 25;
const MACRO_COLUMNS = 'kcal_per_100g, protein_g_per_100g, carb_g_per_100g, fat_g_per_100g';
const ENTRY_COLUMNS =
  'id, food_id, food_name, local_date, logged_at, meal, source, grams, serving_label, ' +
  'serving_quantity, kcal, protein_g, carb_g, fat_g';

type Numeric = number | string | null;

interface MacroRow {
  kcal_per_100g: Numeric;
  protein_g_per_100g: Numeric;
  carb_g_per_100g: Numeric;
  fat_g_per_100g: Numeric;
}

interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  serving_g: Numeric;
  serving_label: string | null;
}

interface EntryRow {
  id: string;
  food_id: string;
  food_name: string;
  local_date: string;
  logged_at: string;
  meal: string | null;
  source: string;
  grams: Numeric;
  serving_label: string | null;
  serving_quantity: Numeric;
  kcal: Numeric;
  protein_g: Numeric;
  carb_g: Numeric;
  fat_g: Numeric;
}

interface DbError {
  code?: string;
  message: string;
}

/** Postgres DECIMAL can arrive as a string. Null stays null (unknown), never 0. */
function toNumber(value: Numeric): number | null {
  if (value === null) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nutrient(value: Numeric): NutrientValue {
  const n = toNumber(value);
  return n === null ? null : round1(n);
}

function toMacros(row: MacroRow | null): FoodMacros {
  return {
    kcal: row ? toNumber(row.kcal_per_100g) : null,
    protein_g: row ? toNumber(row.protein_g_per_100g) : null,
    carb_g: row ? toNumber(row.carb_g_per_100g) : null,
    fat_g: row ? toNumber(row.fat_g_per_100g) : null,
  };
}

function toFood(food: FoodRow, macros: MacroRow | null): Food {
  const servingGrams = toNumber(food.serving_g);
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    macros_per_100g: toMacros(macros),
    // One default serving per food when the row has one; the UI falls back to 100 g otherwise.
    servings:
      servingGrams !== null && servingGrams > 0 && food.serving_label
        ? [{ id: 'default', label: food.serving_label, grams: servingGrams }]
        : [],
  };
}

const UNEXPECTED_ROW = 'Your food log has an entry the app cannot show.';

function toEntry(row: EntryRow): FoodLogEntry {
  const grams = toNumber(row.grams);
  if (
    grams === null ||
    !(MEAL_TYPES as readonly unknown[]).includes(row.meal) ||
    !(LOG_SOURCES as readonly unknown[]).includes(row.source)
  ) {
    // e.g. a row written elsewhere with meal = null, which the schema still allows.
    throw new FoodServiceError('unexpected_row', UNEXPECTED_ROW);
  }
  return {
    id: row.id,
    food_id: row.food_id,
    food_name: row.food_name,
    date: row.local_date,
    logged_at: row.logged_at,
    meal: row.meal as MealType,
    source: row.source as LogSource,
    serving_label: row.serving_label,
    serving_quantity: toNumber(row.serving_quantity),
    grams,
    nutrients: {
      kcal: nutrient(row.kcal),
      protein_g: nutrient(row.protein_g),
      carb_g: nutrient(row.carb_g),
      fat_g: nutrient(row.fat_g),
    },
  };
}

/** Map a PostgREST / Postgres error to a message that is safe to show. */
function fail(error: DbError, fallback: string): never {
  if (error.code === '23503') {
    throw new FoodServiceError('unknown_food', 'That food could not be found.');
  }
  if (error.code === '23502' || error.code === '42501') {
    throw new FoodServiceError('not_ready', 'Saving to your account is not available yet.');
  }
  throw new FoodServiceError('request_failed', fallback);
}

export function createSupabaseFoodService(client: FoodsClient): FoodService {
  return {
    async searchFoods(query: string): Promise<Food[]> {
      const normalized = normalizeQuery(query);
      if (normalized.length < MIN_QUERY_LENGTH) {
        return [];
      }
      const { data, error } = await client.rpc('search_foods', {
        query: normalized,
        max_results: SEARCH_LIMIT,
      });
      if (error) {
        fail(error, 'Search is not available right now.');
      }
      return ((data ?? []) as (FoodRow & MacroRow)[]).map((row) => toFood(row, row));
    },

    async getFood(id: FoodId): Promise<Food | null> {
      const [food, macros] = await Promise.all([
        client
          .from('foods')
          .select('id, name, brand, serving_g, serving_label')
          .eq('id', id)
          .maybeSingle(),
        client.from('food_macros').select(MACRO_COLUMNS).eq('food_id', id).maybeSingle(),
      ]);
      const error = food.error ?? macros.error;
      if (error) {
        fail(error, 'That food could not be loaded.');
      }
      if (!food.data) {
        return null;
      }
      return toFood(food.data as FoodRow, (macros.data as MacroRow | null) ?? null);
    },

    async listLogEntries(date: IsoDate): Promise<FoodLogEntry[]> {
      const { data, error } = await client
        .from('food_log_entries')
        .select(ENTRY_COLUMNS)
        .eq('local_date', date)
        .order('logged_at', { ascending: true });
      if (error) {
        fail(error, 'Your food log could not be loaded.');
      }
      return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
    },

    async addLogEntry(log: NewFoodLog): Promise<FoodLogEntry> {
      // No user_id: the server must fill it from the session (see KNOWN BLOCKER above).
      // ON CONFLICT (id) DO NOTHING keeps a retried save with the same id to one row.
      const { error } = await client.from('food_logs').upsert(
        {
          id: log.id,
          food_id: log.food_id,
          grams: log.grams,
          meal: log.meal,
          source: log.source,
          serving_label: log.serving_label,
          serving_quantity: log.serving_quantity,
          logged_at: log.logged_at,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error) {
        fail(error, 'That food could not be saved.');
      }
      const saved = await client
        .from('food_log_entries')
        .select(ENTRY_COLUMNS)
        .eq('id', log.id)
        .maybeSingle();
      if (saved.error) {
        fail(saved.error, 'That food was saved but could not be loaded.');
      }
      if (!saved.data) {
        throw new FoodServiceError('request_failed', 'That food could not be saved.');
      }
      return toEntry(saved.data as unknown as EntryRow);
    },

    async removeLogEntry(entryId: string): Promise<void> {
      // Soft delete. An unknown or already-deleted id matches no row, which is not an error.
      const { error } = await client
        .from('food_logs')
        .update({ deleted_at: nowUtcIso() })
        .eq('id', entryId)
        .is('deleted_at', null);
      if (error) {
        fail(error, 'That entry could not be removed.');
      }
    },
  };
}
