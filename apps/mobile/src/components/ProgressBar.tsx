import { View } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type ProgressTone = 'default' | 'calories' | 'protein' | 'carbs' | 'fat';

type ProgressBarProps = {
  /** 0 to 1 is the track; values past 1 fill the track and switch to the warning color. */
  fraction: number;
  /** Read aloud by VoiceOver, e.g. "Protein progress". */
  accessibilityLabel: string;
  /**
   * Fill color. "default" keeps the original primary / warning colors; the others use the
   * Figma macro colors, switching to the Figma over-target red past 1.
   */
  tone?: ProgressTone;
};

const toneFill: Record<Exclude<ProgressTone, 'default'>, keyof ColorTokens> = {
  calories: 'progressGood',
  protein: 'macroProtein',
  carbs: 'macroCarbs',
  fat: 'macroFat',
};

export function ProgressBar({ fraction, accessibilityLabel, tone = 'default' }: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const percent = Math.round(clamped * 100);
  const over = fraction > 1;
  const fill =
    tone === 'default'
      ? over
        ? colors.warning
        : colors.primary
      : over
        ? colors.progressOver
        : colors[toneFill[tone]];
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: tone === 'default' ? colors.surfaceMuted : colors.progressTrack,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
