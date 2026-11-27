import type { SFSymbol } from 'expo-symbols';

import type { ColorTokens } from '@/theme';
import type { MealType } from '@/types/food';

/** Tab color per meal, shared by the Log food meal rows and the Logged today rows. */
export const MEAL_TAB: Record<MealType, keyof ColorTokens> = {
  breakfast: 'mealBreakfast',
  lunch: 'mealLunch',
  dinner: 'mealDinner',
  snack: 'mealSnack',
};

// SF Symbols (expo-symbols is already installed; @expo/vector-icons is not). The frame's bowl
// and apple have no SF Symbol, so lunch and snacks use the closest ones.
export const MEAL_ICON: Record<MealType, SFSymbol> = {
  breakfast: 'sun.max',
  lunch: 'fork.knife',
  dinner: 'moon',
  snack: 'carrot',
};
