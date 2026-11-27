import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text } from 'react-native';

import { formatMealKcal, type MealKcal } from '@/lib/nutrition';
import { useTheme, type ColorTokens } from '@/theme';
import type { MealType } from '@/types/food';

import { AddCircle } from './AddCircle';
import { TabbedRow } from './TabbedRow';

/** Labels on the meal-first Log food screen. The stored value stays `snack`. */
export const MEAL_ROW_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

const MEAL_TAB: Record<MealType, keyof ColorTokens> = {
  breakfast: 'mealBreakfast',
  lunch: 'mealLunch',
  dinner: 'mealDinner',
  snack: 'mealSnack',
};

// SF Symbols (expo-symbols is already installed; @expo/vector-icons is not). The frame's bowl
// and apple have no SF Symbol, so lunch and snacks use the closest ones.
const MEAL_ICON: Record<MealType, SFSymbol> = {
  breakfast: 'sun.max',
  lunch: 'fork.knife',
  dinner: 'moon',
  snack: 'carrot',
};

type MealRowProps = {
  meal: MealType;
  /** Null while the log is loading or failed: no number is shown. */
  total: MealKcal | null;
  /** The dark "+": add a food to this meal. */
  onAdd: (meal: MealType) => void;
};

/** One meal on Log food: icon tab, name, today's kcal for it, and a "+" to add food. */
export function MealRow({ meal, total, onAdd }: MealRowProps) {
  const { colors, spacing, typography } = useTheme();
  const label = MEAL_ROW_LABELS[meal];
  const kcal = total ? formatMealKcal(total) : null;
  return (
    <TabbedRow
      tabColor={colors[MEAL_TAB[meal]]}
      tab={<SymbolView name={MEAL_ICON[meal]} tintColor={colors.onPrimarySoft} size={22} />}
      accessory={
        <>
          {kcal ? (
            <Text
              accessibilityLabel={`${label} ${kcal.accessibilityLabel}`}
              style={[
                typography.body,
                {
                  color: colors.text,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                  marginRight: spacing.sm,
                },
              ]}
            >
              {kcal.text}
            </Text>
          ) : null}
          <AddCircle onPress={() => onAdd(meal)} accessibilityLabel={`Add food to ${label}`} />
        </>
      }
    >
      <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>{label}</Text>
    </TabbedRow>
  );
}
