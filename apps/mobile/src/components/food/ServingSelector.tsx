import { Pressable, Text, View } from 'react-native';

import { CUSTOM_SERVING_ID } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { ServingOption } from '@/types/food';

type ServingSelectorProps = {
  servings: ServingOption[];
  selectedId: string;
  onSelect: (servingId: string) => void;
};

type Choice = { id: string; label: string };

/**
 * Pick how the food is measured: its default serving, e.g. "1 medium (118 g)", or "Custom
 * grams" to type an exact weight. Custom grams is always offered, as the team agreed.
 */
export function ServingSelector({ servings, selectedId, onSelect }: ServingSelectorProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const choices: Choice[] = [
    ...servings.map((serving) => ({ id: serving.id, label: serving.label })),
    { id: CUSTOM_SERVING_ID, label: 'Custom grams' },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Serving size"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {choices.map((serving) => {
        const selected = serving.id === selectedId;
        return (
          <Pressable
            key={serving.id}
            accessibilityRole="radio"
            accessibilityLabel={serving.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onSelect(serving.id)}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : colors.surface,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={[typography.label, { color: selected ? colors.onPrimary : colors.text }]}>
              {serving.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
