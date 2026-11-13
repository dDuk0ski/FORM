import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDateOf, nowUtcIso } from '@/lib/dates';
import { filterFoods } from '@/lib/foodSearch';
import { hydrateLogEntry } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import type { FoodId, IsoDate } from '@/types/api';
import {
  LOG_SOURCES,
  MEAL_TYPES,
  type Food,
  type FoodLogEntry,
  type NewFoodLog,
  type StoredFoodLog,
} from '@/types/food';

import { FoodServiceError, type FoodService } from './foods.types';

// Mock implementation of FoodService: sample foods from src/mocks/foods.ts, and a food
// log persisted ON THIS DEVICE ONLY in AsyncStorage. It survives closing and reopening
// the app, but it is not saved to the user's account and is not shared across devices.
// It is NOT production persistence.
//
// It behaves like the agreed food_logs design so the screens do not change when the real
// service replaces it: rows hold only the food id, grams and serving (no name, no nutrient
// copies), the name and nutrients are joined from the food on every read, and deletes are
// soft (`deleted_at`).

const MOCK_DELAY_MS = 300;
// v2: rows are now StoredFoodLog. Entries saved under v1 are not read or deleted.
export const FOOD_LOG_STORAGE_KEY = 'form.mock.food_log.v2';

function delay(): Promise<void> {
  // No artificial latency under Jest.
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
}

function isStoredFoodLog(value: unknown): value is StoredFoodLog {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Partial<StoredFoodLog>;
  return (
    typeof row.id === 'string' &&
    typeof row.food_id === 'string' &&
    typeof row.logged_at === 'string' &&
    typeof row.grams === 'number' &&
    (MEAL_TYPES as readonly unknown[]).includes(row.meal) &&
    (LOG_SOURCES as readonly unknown[]).includes(row.source) &&
    (row.serving_label === null || typeof row.serving_label === 'string') &&
    (row.serving_quantity === null || typeof row.serving_quantity === 'number') &&
    (row.deleted_at === null || typeof row.deleted_at === 'string')
  );
}

const CORRUPT_LOG = 'Your saved food log could not be read.';

async function readAll(): Promise<StoredFoodLog[]> {
  const raw = await AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FoodServiceError('corrupt_log', CORRUPT_LOG);
  }
  if (!Array.isArray(parsed) || !parsed.every(isStoredFoodLog)) {
    throw new FoodServiceError('corrupt_log', CORRUPT_LOG);
  }
  return parsed;
}

async function writeAll(rows: StoredFoodLog[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(rows));
}

function findFood(id: FoodId): Food | undefined {
  return foodsFixture.find((food) => food.id === id);
}

/** Join one row to its food. A row whose food is gone cannot be shown, so it is an error. */
function toEntry(row: StoredFoodLog): FoodLogEntry {
  const food = findFood(row.food_id);
  if (!food) {
    throw new FoodServiceError('corrupt_log', CORRUPT_LOG);
  }
  return hydrateLogEntry(row, food);
}

// Read-modify-write calls run one at a time so two quick taps cannot overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => undefined);
  return run;
}

export const mockFoodService: FoodService = {
  async searchFoods(query: string): Promise<Food[]> {
    await delay();
    return filterFoods(foodsFixture, query);
  },

  async getFood(id: FoodId): Promise<Food | null> {
    await delay();
    return findFood(id) ?? null;
  },

  async listLogEntries(date: IsoDate): Promise<FoodLogEntry[]> {
    await delay();
    const rows = await readAll();
    return rows
      .filter((row) => row.deleted_at === null && localDateOf(row.logged_at) === date)
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map(toEntry);
  },

  async addLogEntry(log: NewFoodLog): Promise<FoodLogEntry> {
    await delay();
    if (!findFood(log.food_id)) {
      throw new FoodServiceError('unknown_food', 'That food could not be found.');
    }
    return serialized(async () => {
      const rows = await readAll();
      const without = rows.filter((existing) => existing.id !== log.id);
      const row: StoredFoodLog = { ...log, deleted_at: null };
      await writeAll([...without, row]);
      return toEntry(row);
    });
  },

  async removeLogEntry(entryId: string): Promise<void> {
    await delay();
    return serialized(async () => {
      const rows = await readAll();
      const deletedAt = nowUtcIso();
      await writeAll(
        rows.map((row) =>
          row.id === entryId && row.deleted_at === null ? { ...row, deleted_at: deletedAt } : row,
        ),
      );
    });
  },
};
