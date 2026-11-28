import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import type { PillOption } from './OptionPills';

type SegmentedPillProps<T extends string> = {
  options: PillOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
};

// one gray pill split evenly, the selected option gets a white bubble
export function SegmentedPill<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: SegmentedPillProps<T>) {
  const { colors, radii, typography } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        height: 50,
        padding: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
      }}
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
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: isSelected ? colors.surface : undefined,
            }}
          >
            <Text
              style={[
                typography.label,
                { fontWeight: '600', color: isSelected ? colors.text : colors.textMuted },
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
