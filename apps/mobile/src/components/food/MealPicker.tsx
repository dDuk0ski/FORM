import { Pressable, Text, View } from 'react-native';

import { mealLabel } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import { MEAL_TYPES, type MealType } from '@/types/food';

type MealPickerProps = {
  selected: MealType;
  onSelect: (meal: MealType) => void;
};

/** Choose which meal an entry belongs to: breakfast, lunch, dinner or snack. */
export function MealPicker({ selected, onSelect }: MealPickerProps) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.textMuted }]}>Meal</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Meal"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {MEAL_TYPES.map((meal) => {
          const isSelected = meal === selected;
          return (
            <Pressable
              key={meal}
              accessibilityRole="radio"
              accessibilityLabel={mealLabel(meal)}
              accessibilityState={{ checked: isSelected }}
              onPress={() => onSelect(meal)}
              style={({ pressed }) => ({
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={[typography.label, { color: isSelected ? colors.onPrimary : colors.text }]}
              >
                {mealLabel(meal)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
