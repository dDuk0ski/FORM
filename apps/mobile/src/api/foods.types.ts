import type { FoodId, IsoDate } from '@/types/api';
import type { Food, FoodLogEntry } from '@/types/food';

/** Failure from the food service, with a message that is safe to show to the user. */
export class FoodServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FoodServiceError';
    this.code = code;
  }
}

/** Everything the food UI needs from a data source. Implemented by foods.mock.ts today. */
export interface FoodService {
  /** Text search. Resolves to [] for no matches; rejects only on failure. */
  searchFoods(query: string): Promise<Food[]>;
  /** Resolves to null when the id is unknown. */
  getFood(id: FoodId): Promise<Food | null>;
  /** Entries for one local day, oldest first. */
  listLogEntries(date: IsoDate): Promise<FoodLogEntry[]>;
  /** Idempotent by `entry.id`: saving the same id twice leaves one entry. */
  addLogEntry(entry: FoodLogEntry): Promise<FoodLogEntry>;
  removeLogEntry(entryId: string): Promise<void>;
}
