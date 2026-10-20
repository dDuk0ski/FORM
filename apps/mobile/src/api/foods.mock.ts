import AsyncStorage from '@react-native-async-storage/async-storage';

import { filterFoods } from '@/lib/foodSearch';
import { foodsFixture } from '@/mocks/foods';
import type { FoodId, IsoDate } from '@/types/api';
import type { Food, FoodLogEntry } from '@/types/food';

import { FoodServiceError, type FoodService } from './foods.types';

// Mock implementation of FoodService: sample foods from src/mocks/foods.ts, and a food
// log persisted ON THIS DEVICE ONLY in AsyncStorage. It survives closing and reopening
// the app, but it is not saved to the user's account and is not shared across devices.
// It is NOT production persistence.

const MOCK_DELAY_MS = 300;
export const FOOD_LOG_STORAGE_KEY = 'form.mock.food_log.v1';

function delay(): Promise<void> {
  // No artificial latency under Jest.
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
}

function isFoodLogEntry(value: unknown): value is FoodLogEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<FoodLogEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.food_id === 'string' &&
    typeof entry.food_name === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.grams === 'number' &&
    typeof entry.nutrients === 'object' &&
    entry.nutrients !== null
  );
}

async function readAll(): Promise<FoodLogEntry[]> {
  const raw = await AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FoodServiceError('corrupt_log', 'Your saved food log could not be read.');
  }
  if (!Array.isArray(parsed) || !parsed.every(isFoodLogEntry)) {
    throw new FoodServiceError('corrupt_log', 'Your saved food log could not be read.');
  }
  return parsed;
}

async function writeAll(entries: FoodLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify(entries));
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
    return foodsFixture.find((food) => food.id === id) ?? null;
  },

  async listLogEntries(date: IsoDate): Promise<FoodLogEntry[]> {
    await delay();
    const entries = await readAll();
    return entries
      .filter((entry) => entry.date === date)
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  },

  async addLogEntry(entry: FoodLogEntry): Promise<FoodLogEntry> {
    await delay();
    return serialized(async () => {
      const entries = await readAll();
      const without = entries.filter((existing) => existing.id !== entry.id);
      await writeAll([...without, entry]);
      return entry;
    });
  },

  async removeLogEntry(entryId: string): Promise<void> {
    await delay();
    return serialized(async () => {
      const entries = await readAll();
      await writeAll(entries.filter((entry) => entry.id !== entryId));
    });
  },
};
