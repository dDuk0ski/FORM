import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { formatGrams, formatNutrient, formatQuantity, parseMeal } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { FoodLogEntry } from '@/types/food';

import { foodTabToken } from './foodTab';
import { MacroLine } from './MacroLine';
import { MEAL_ICON, MEAL_TAB } from './mealStyle';
import { TabbedRow } from './TabbedRow';

type FoodLogListProps = {
  entries: FoodLogEntry[];
  /** Omit to render the list read-only. */
  onRemove?: (entryId: string) => void;
  /** Entry currently being removed; its button is disabled. */
  removingId?: string | null;
};

/** Everything logged today, with the serving and quantity for each entry. */
export function FoodLogList({ entries, onRemove, removingId = null }: FoodLogListProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        Logged today
      </Text>
      {entries.length === 0 ? (
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Nothing logged yet. Search for a food above to add your first entry.
        </Text>
      ) : (
        entries.map((entry) => {
          const kcal = formatNutrient(entry.nutrients.kcal, 'kcal');
          // Stored rows should always have a meal; if one does not, keep the neutral hash color.
          const meal = parseMeal(entry.meal);
          return (
            <TabbedRow
              key={entry.id}
              testID={`logged-row-${entry.id}`}
              tabColor={colors[meal ? MEAL_TAB[meal] : foodTabToken(entry.food_id)]}
              tab={
                meal ? (
                  <SymbolView
                    testID={`meal-icon-${meal}`}
                    name={MEAL_ICON[meal]}
                    tintColor={colors.onPrimarySoft}
                    size={22}
                  />
                ) : null
              }
              accessory={
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Text
                    accessibilityLabel={kcal.accessibilityLabel}
                    style={[
                      typography.body,
                      { color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
                    ]}
                  >
                    {kcal.text}
                  </Text>
                  {onRemove ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${entry.food_name}`}
                      accessibilityState={{ disabled: removingId === entry.id }}
                      disabled={removingId === entry.id}
                      hitSlop={8}
                      onPress={() => onRemove(entry.id)}
                    >
                      <Text style={[typography.caption, { color: colors.danger }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            >
              <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                {entry.food_name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {entry.serving_quantity !== null && entry.serving_label !== null
                  ? `${formatQuantity(entry.serving_quantity)} × ${entry.serving_label}`
                  : `${formatGrams(entry.grams)} g`}
              </Text>
              <MacroLine macros={entry.nutrients} />
            </TabbedRow>
          );
        })
      )}
    </View>
  );
}
