import type { SFSymbol } from 'expo-symbols';

import type { Food } from '@/types/food';

export type PantryUnit = 'pcs' | 'g' | 'ml' | 'pack';
export type PantryCategory = 'produce' | 'protein' | 'dairy' | 'bakery' | 'other';

// TODO(Pantry): real food images once items link to foods
const CATEGORY_ICONS: Partial<Record<string, SFSymbol>> = {
  produce: 'carrot.fill',
  protein: 'fish.fill',
  dairy: 'cup.and.saucer.fill',
  bakery: 'birthday.cake.fill',
};

export function categoryIcon(category: string | null): SFSymbol {
  return CATEGORY_ICONS[category ?? ''] ?? 'basket.fill';
}

const UNITS: PantryUnit[] = ['pcs', 'g', 'ml', 'pack'];

// the column is plain text, so check it's one of the presets
export function toPantryUnit(unit: string): PantryUnit | null {
  return UNITS.includes(unit as PantryUnit) ? (unit as PantryUnit) : null;
}

// recipes only use grams. ml counts as ~1g, pcs/pack need a linked food's serving size
export function gramsFor(quantity: number, unit: PantryUnit, servingGrams: number | null = null): number | null {
  if (unit === 'g' || unit === 'ml') return quantity;
  return servingGrams ? Math.round(quantity * servingGrams * 10) / 10 : null;
}

// kcal for one serving of a food, or per 100 g if it has no serving. null if kcal is unknown
export function servingKcal(food: Food): { kcal: number; per: string } | null {
  const per100 = food.macros_per_100g.kcal;
  if (per100 === null) return null;
  const serving = food.servings[0];
  if (!serving) return { kcal: Math.round(per100), per: '100 g' };
  return { kcal: Math.round((per100 * serving.grams) / 100), per: serving.label };
}

// 1 decimal max, no trailing .0
function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}

// short label: 500g, 1.5kg, 750ml, 1.5L, 12 (pcs/pack show just the number)
export function formatAmount(quantity: number, unit: string): string {
  const u = toPantryUnit(unit);
  if (u === 'g') return quantity >= 1000 ? `${trim(quantity / 1000)}kg` : `${trim(quantity)}g`;
  if (u === 'ml') return quantity >= 1000 ? `${trim(quantity / 1000)}L` : `${trim(quantity)}ml`;
  return quantity >= 1000 ? `${trim(quantity / 1000)}k` : trim(quantity);
}

// days from today until a "YYYY-MM-DD" date. negative means already expired
export function daysUntil(date: string): number {
  const ms = new Date(`${date}T00:00:00`).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

// how full the freshness bar is: days left out of 2 weeks, no date counts as fresh
export function freshness(expirationDate: string | null): number {
  if (!expirationDate) return 1;
  return Math.min(1, Math.max(0, daysUntil(expirationDate) / 14));
}

// bar color: expired, 3 days or less is red, a week or less is yellow
export function freshnessLevel(expirationDate: string | null): 'good' | 'warning' | 'bad' | 'expired' {
  if (!expirationDate) return 'good';
  const days = daysUntil(expirationDate);
  if (days < 0) return 'expired';
  if (days <= 3) return 'bad';
  if (days <= 7) return 'warning';
  return 'good';
}

// "Expired", "Today", "1 day", "12 days", "3 months", "2 years"
export function expiresInLabel(date: string): string {
  const days = daysUntil(date);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}
