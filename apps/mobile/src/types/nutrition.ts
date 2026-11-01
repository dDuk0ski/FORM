// Shapes the nutrition screens read from the user's own rows in Supabase (food_logs joined to
// foods and food_nutrients), summed for one local day. Not part of the ML service contract.

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LoggedFood {
  /** food_logs.id */
  id: string;
  food_id: string;
  name: string;
  grams: number;
  kcal: number;
}

export interface MealLog {
  meal: MealSlot;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  items: LoggedFood[];
}

export interface NutrientIntake {
  key: string;
  label: string;
  unit: 'g' | 'mg' | 'µg';
  /** Sum of known values. Null when no logged food has a known value. Never zero for unknown. */
  amount: number | null;
  /** Daily target, or the upper limit when kind is "limit". */
  target: number;
  kind: 'target' | 'limit';
  /** Share of the day's logged food (by grams) with a known value for this nutrient, 0 to 1. */
  known_fraction: number;
}

export interface NutritionDay {
  date: string;
  meals: MealLog[];
  micronutrients: NutrientIntake[];
}
