import type { IsoDate, IsoDateTime, Macros } from '@/types/api';
import type { Food, FoodLogEntry, ServingOption } from '@/types/food';

// Pure nutrition math. No React, no I/O, so it is trivially testable and the same rules
// apply to the picker preview, the saved entry, and the daily totals.

export const EMPTY_MACROS: Macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

/** Fallback when a food ships with no servings. */
export const HUNDRED_GRAMS: ServingOption = { id: '100g', label: '100 g', grams: 100 };

export const MIN_QUANTITY = 0.1;
export const MAX_QUANTITY = 100;
/** Sanity cap on one entry, so a typo like 500 servings cannot wreck the day's totals. */
export const MAX_TOTAL_GRAMS = 5000;

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

let entryCounter = 0;
/** Client-side id for a new log entry. The backend may assign its own later. */
export function newEntryId(): string {
  entryCounter += 1;
  return `le_${Date.now().toString(36)}_${entryCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export interface BuildLogEntryInput {
  id: string;
  food: Food;
  serving: ServingOption;
  quantity: number;
  date: IsoDate;
  loggedAt: IsoDateTime;
}

export function buildLogEntry({
  id,
  food,
  serving,
  quantity,
  date,
  loggedAt,
}: BuildLogEntryInput): FoodLogEntry {
  const grams = servingGrams(serving, quantity);
  return {
    id,
    food_id: food.id,
    food_name: food.name,
    date,
    logged_at: loggedAt,
    serving_label: serving.label,
    serving_quantity: quantity,
    grams,
    nutrients: scaleMacros(food.macros_per_100g, grams),
  };
}
