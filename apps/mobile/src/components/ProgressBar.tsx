import { View } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type ProgressTone = 'default' | 'calories' | 'protein' | 'carbs' | 'fat';

type ValueProps = {
  value: number;
  max: number;
  /** Color token for the filled part. */
  color?: keyof ColorTokens;
  accessibilityLabel: string;
  fraction?: never;
  tone?: never;
};

/** The food screens' form: a raw fraction and a Figma macro tone. */
type FractionProps = {
  /** 0 to 1 is the track; values past 1 fill the track and switch to the over-target color. */
  fraction: number;
  /**
   * Fill color. "default" uses primary / warning; the others use the Figma macro colors,
   * switching to the Figma over-target red past 1.
   */
  tone?: ProgressTone;
  accessibilityLabel: string;
  value?: never;
  max?: never;
  color?: never;
};

type ProgressBarProps = ValueProps | FractionProps;

const toneFill: Record<Exclude<ProgressTone, 'default'>, keyof ColorTokens> = {
  calories: 'progressGood',
  protein: 'macroProtein',
  carbs: 'macroCarbs',
  fat: 'macroFat',
};

export function ProgressBar(props: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const { accessibilityLabel } = props;

  let fraction: number;
  let fill: string;
  let track: string;
  let accessibilityValue: { min: number; max: number; now: number };

  if (props.fraction === undefined) {
    const { value, max, color = 'primary' } = props;
    fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    fill = colors[color];
    track = colors.surfaceMuted;
    accessibilityValue = { min: 0, max: Math.round(max), now: Math.round(value) };
  } else {
    const raw = props.fraction;
    const tone = props.tone ?? 'default';
    const over = raw > 1;
    fraction = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
    fill =
      tone === 'default'
        ? over
          ? colors.warning
          : colors.primary
        : over
          ? colors.progressOver
          : colors[toneFill[tone]];
    track = tone === 'default' ? colors.surfaceMuted : colors.progressTrack;
    accessibilityValue = { min: 0, max: 100, now: Math.round(fraction * 100) };
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValue}
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${fraction * 100}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
