import type { IsoDateTime, Macros } from '@/types/api';
import { localDateOf } from '@/lib/dates';
import type {
  Food,
  FoodLogEntry,
  LogSource,
  MealType,
  NewFoodLog,
  ServingOption,
} from '@/types/food';

// Pure nutrition math. No React, no I/O, so it is trivially testable and the same rules
// apply to the picker preview, the saved entry, and the daily totals.

export const EMPTY_MACROS: Macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

/** Fallback when a food ships with no servings. */
export const HUNDRED_GRAMS: ServingOption = { id: '100g', label: '100 g', grams: 100 };

/** Id of the "Custom grams" choice in the serving picker. Never a real serving id. */
export const CUSTOM_SERVING_ID = 'custom-grams';

export const MIN_QUANTITY = 0.1;
export const MAX_QUANTITY = 100;
/** Sanity cap on one entry, so a typo like 500 servings cannot wreck the day's totals. */
export const MAX_TOTAL_GRAMS = 5000;
export const MIN_GRAMS = 1;

/** Round to one decimal, avoiding binary float noise (0.1 + 0.2). */
export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = grams / 100;
  return {
    kcal: round1(per100g.kcal * factor),
    protein_g: round1(per100g.protein_g * factor),
    carb_g: round1(per100g.carb_g * factor),
    fat_g: round1(per100g.fat_g * factor),
  };
}

export function sumMacros(items: readonly Macros[]): Macros {
  const total = items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: acc.protein_g + item.protein_g,
      carb_g: acc.carb_g + item.carb_g,
      fat_g: acc.fat_g + item.fat_g,
    }),
    EMPTY_MACROS,
  );
  return {
    kcal: round1(total.kcal),
    protein_g: round1(total.protein_g),
    carb_g: round1(total.carb_g),
    fat_g: round1(total.fat_g),
  };
}

export function defaultServing(food: Food): ServingOption {
  return food.servings[0] ?? HUNDRED_GRAMS;
}

export function servingGrams(serving: ServingOption, quantity: number): number {
  return round1(serving.grams * quantity);
}

export function macrosForServing(food: Food, serving: ServingOption, quantity: number): Macros {
  return scaleMacros(food.macros_per_100g, servingGrams(serving, quantity));
}

export type QuantityResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Validate what the user typed into the quantity box. Accepts "1", "1.5", ".5" and "1,5"
 * (some keyboards). Rejects everything else, including exponent notation.
 */
export function parseQuantity(input: string, serving?: ServingOption): QuantityResult {
  const text = input.trim().replace(',', '.');
  if (text === '') {
    return { ok: false, error: 'Enter an amount.' };
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) {
    return { ok: false, error: 'Use numbers only, like 1 or 1.5.' };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < MIN_QUANTITY) {
    return { ok: false, error: `Amount must be at least ${MIN_QUANTITY}.` };
  }
  if (value > MAX_QUANTITY) {
    return { ok: false, error: `Amount can't be more than ${MAX_QUANTITY}.` };
  }
  if (serving && servingGrams(serving, value) > MAX_TOTAL_GRAMS) {
    return { ok: false, error: `That's over ${MAX_TOTAL_GRAMS} g. Lower the amount.` };
  }
  return { ok: true, value };
}

/** Validate custom grams typed by the user: 1 to 5000 g, same number rules as parseQuantity. */
export function parseGrams(input: string): QuantityResult {
  const text = input.trim().replace(',', '.');
  if (text === '') {
    return { ok: false, error: 'Enter an amount.' };
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) {
    return { ok: false, error: 'Use numbers only, like 100 or 62.5.' };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < MIN_GRAMS) {
    return { ok: false, error: `Amount must be at least ${MIN_GRAMS} g.` };
  }
  if (value > MAX_TOTAL_GRAMS) {
    return { ok: false, error: `That's over ${MAX_TOTAL_GRAMS} g. Lower the amount.` };
  }
  return { ok: true, value };
}

/** "1.5", not "1.5000000001". */
export function formatQuantity(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function formatKcal(value: number): string {
  return String(Math.round(value));
}

/** One decimal, trailing ".0" dropped: 12.0 -> "12", 12.34 -> "12.3". */
export function formatGrams(value: number): string {
  return String(Number(value.toFixed(1)));
}

/** Fraction of the target reached (may exceed 1), or null when there is no usable target. */
export function targetProgress(consumed: number, target: number | undefined | null): number | null {
  if (target === undefined || target === null || !(target > 0)) {
    return null;
  }
  return consumed / target;
}

function randomBytes16(): Uint8Array {
  const bytes = new Uint8Array(16);
  const webCrypto = (
    globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }
  ).crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    // Fallback for runtimes without Web Crypto. Not cryptographically secure, which is fine
    // for a row id that only needs to be unique; row level security protects ownership.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

/**
 * A random version 4 UUID for a new log entry, generated on the device so a retried save
 * cannot create a duplicate. food_logs.id is a uuid column, so the format must be valid.
 * When expo-crypto is installed (`npx expo install expo-crypto`), this body can become
 * `return Crypto.randomUUID();`.
 */
export function newEntryId(): string {
  const bytes = randomBytes16();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Suggested meal for a time of day. It is only a default; the person can change it. */
export function defaultMeal(now: Date = new Date()): MealType {
  const hour = now.getHours();
  if (hour < 11) {
    return 'breakfast';
  }
  if (hour < 15) {
    return 'lunch';
  }
  if (hour < 21) {
    return 'dinner';
  }
  return 'snack';
}

export function mealLabel(meal: MealType): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

interface BuildLogBase {
  id: string;
  food: Food;
  loggedAt: IsoDateTime;
  meal: MealType;
  source?: LogSource;
}

/** A log row for "N of the chosen serving". Stores the serving label and quantity. */
export function buildServingLog({
  id,
  food,
  serving,
  quantity,
  loggedAt,
  meal,
  source = 'manual',
}: BuildLogBase & { serving: ServingOption; quantity: number }): NewFoodLog {
  return {
    id,
    food_id: food.id,
    logged_at: loggedAt,
    grams: servingGrams(serving, quantity),
    meal,
    source,
    serving_label: serving.label,
    serving_quantity: quantity,
  };
}

/** A log row for grams typed in directly. There is no serving, so those fields are null. */
export function buildCustomGramsLog({
  id,
  food,
  grams,
  loggedAt,
  meal,
  source = 'manual',
}: BuildLogBase & { grams: number }): NewFoodLog {
  return {
    id,
    food_id: food.id,
    logged_at: loggedAt,
    grams: round1(grams),
    meal,
    source,
    serving_label: null,
    serving_quantity: null,
  };
}

/**
 * Join a log row to its food: the name comes from the food, the nutrients are calculated
 * from the food's per-100 g values, and the day is derived from `logged_at`. Nothing here
 * is stored, so a corrected food automatically corrects its log.
 */
export function hydrateLogEntry(log: NewFoodLog, food: Food): FoodLogEntry {
  return {
    id: log.id,
    food_id: log.food_id,
    food_name: food.name,
    date: localDateOf(log.logged_at),
    logged_at: log.logged_at,
    meal: log.meal,
    source: log.source,
    serving_label: log.serving_label,
    serving_quantity: log.serving_quantity,
    grams: log.grams,
    nutrients: scaleMacros(food.macros_per_100g, log.grams),
  };
}
