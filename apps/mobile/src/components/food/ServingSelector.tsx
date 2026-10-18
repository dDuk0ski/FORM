import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import type { ServingOption } from '@/types/food';

type ServingSelectorProps = {
  servings: ServingOption[];
  selectedId: string;
  onSelect: (servingId: string) => void;
};

/** Pick how the food is measured: "1 medium (118 g)", "100 g", ... */
export function ServingSelector({ servings, selectedId, onSelect }: ServingSelectorProps) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Serving size"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {servings.map((serving) => {
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
            <Text
              style={[typography.label, { color: selected ? colors.onPrimary : colors.text }]}
            >
              {serving.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
