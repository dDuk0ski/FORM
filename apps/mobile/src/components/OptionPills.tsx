import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type PillOption<T extends string> = { value: T; label: string };

type OptionPillsProps<T extends string> = {
  options: PillOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
};

// row of pills where one is selected, light green when picked
export function OptionPills<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: OptionPillsProps<T>) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: isSelected ? colors.primarySoftBorder : colors.chipBorder,
              backgroundColor: isSelected ? colors.primarySoft : colors.surface,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={[
                typography.label,
                { fontWeight: '700', color: isSelected ? colors.onPrimarySoft : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
