import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

const SIZE = 32;

type AddCircleProps = {
  /** Omit for a purely visual "+" inside a row that is itself the button. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The frames' dark round "+" button. */
export function AddCircle({ onPress, accessibilityLabel }: AddCircleProps) {
  const { colors, radii, spacing } = useTheme();
  const circle = {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.stepper,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const icon = <SymbolView name="plus" tintColor={colors.stepperText} size={14} weight="bold" />;
  if (!onPress) {
    return (
      <View
        style={circle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [circle, { opacity: pressed ? 0.8 : 1 }]}
    >
      {icon}
    </Pressable>
  );
}
