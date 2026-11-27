import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme';

import { softShadow } from './softShadow';

export const ROUND_BUTTON_SIZE = 44;

/** The frames' round white back button. It only calls `onPress`; navigation stays the caller's. */
export function RoundBackButton({
  onPress,
  accessibilityLabel = 'Back',
  fill,
  iconColor,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  /** Override the white fill / dark chevron, e.g. on the always-dark camera screen. */
  fill?: string;
  iconColor?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: ROUND_BUTTON_SIZE,
          height: ROUND_BUTTON_SIZE,
          borderRadius: radii.pill,
          backgroundColor: fill ?? colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
        softShadow(colors),
      ]}
    >
      <SymbolView
        name="chevron.left"
        tintColor={iconColor ?? colors.text}
        size={18}
        weight="semibold"
      />
    </Pressable>
  );
}
