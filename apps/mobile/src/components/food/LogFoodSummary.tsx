import { Text, View } from 'react-native';

import { formatDayHeading } from '@/lib/dates';
import { formatNutrientTotal, kcalSummary } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { NutrientTotal } from '@/types/food';

type LogFoodSummaryProps = {
  /** Today's calorie total, or null while the log is loading or failed. */
  kcal: NutrientTotal | null;
  /** Today's calorie target, when known. */
  target: number | undefined;
};

/**
 * The "Log food" frame's header summary: "X kcal left" large, then "Y eaten of Z · date".
 * Same unknown rules as the Nutrition card: no "left" number unless every entry is known.
 * Without a target it shows what was eaten; without the log, only the date.
 */
export function LogFoodSummary({ kcal, target }: LogFoodSummaryProps) {
  const { colors, spacing, typography } = useTheme();
  const date = formatDayHeading();
  const summary = kcal ? kcalSummary(kcal, target) : null;
  let headline: { text: string; accessibilityLabel: string } | null = null;
  let detail = date;
  if (summary) {
    headline = summary.headline;
    detail = `${summary.detail} · ${date}`;
  } else if (kcal) {
    const eaten = formatNutrientTotal(kcal, 'kcal');
    headline = {
      text: `${eaten.text} eaten`,
      accessibilityLabel: `${eaten.accessibilityLabel} eaten`,
    };
  }
  return (
    <View style={{ gap: spacing.xs / 2 }}>
      {headline ? (
        <Text
          accessibilityLabel={headline.accessibilityLabel}
          style={[typography.title, { color: colors.text, fontVariant: ['tabular-nums'] }]}
        >
          {headline.text}
        </Text>
      ) : null}
      <Text style={[typography.label, { color: colors.textMuted, fontVariant: ['tabular-nums'] }]}>
        {detail}
      </Text>
    </View>
  );
}
