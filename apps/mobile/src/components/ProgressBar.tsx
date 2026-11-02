import { View } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type ProgressBarProps = {
  value: number;
  max: number;
  /** Color token for the filled part. */
  color?: keyof ColorTokens;
  accessibilityLabel: string;
};

export function ProgressBar({
  value,
  max,
  color = 'primary',
  accessibilityLabel,
}: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${fraction * 100}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: colors[color],
        }}
      />
    </View>
  );
}
