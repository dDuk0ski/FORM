import type { MealLog, MealSlot } from '@/types/nutrition';

export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

const MAIN_MEALS: { meal: MealSlot; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch', label: 'Lunch' },
  { meal: 'dinner', label: 'Dinner' },
];

/** The first main meal with nothing logged (absent or empty), for the "Meals logged" row. */
export function nextUnloggedMeal(meals: MealLog[]): string | null {
  const missing = MAIN_MEALS.find(
    ({ meal }) => !meals.some((m) => m.meal === meal && m.items.length > 0),
  );
  return missing ? missing.label : null;
}
