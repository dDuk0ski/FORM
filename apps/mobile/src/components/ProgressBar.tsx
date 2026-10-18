import { View } from 'react-native';

import { useTheme } from '@/theme';

type ProgressBarProps = {
  /** 0 to 1 is the track; values past 1 fill the track and switch to the warning color. */
  fraction: number;
  /** Read aloud by VoiceOver, e.g. "Protein progress". */
  accessibilityLabel: string;
};

export function ProgressBar({ fraction, accessibilityLabel }: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const percent = Math.round(clamped * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: fraction > 1 ? colors.warning : colors.primary,
        }}
      />
    </View>
  );
}
