import type { FoodId, IsoDate } from '@/types/api';
import type { Food, FoodLogEntry, NewFoodLog } from '@/types/food';

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
  /**
   * Entries for one local day, oldest first. Soft-deleted rows are never returned. The day
   * is worked out from each row's `logged_at` (food_logs has no date column).
   */
  listLogEntries(date: IsoDate): Promise<FoodLogEntry[]>;
  /** Idempotent by `log.id`: saving the same id twice leaves one entry. */
  addLogEntry(log: NewFoodLog): Promise<FoodLogEntry>;
  /** Soft delete: the row stays, with `deleted_at` set. An unknown id is ignored. */
  removeLogEntry(entryId: string): Promise<void>;
}
