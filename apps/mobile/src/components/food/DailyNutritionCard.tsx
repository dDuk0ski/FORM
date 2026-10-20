import { Text, View } from 'react-native';

import { Card, ProgressBar } from '@/components';
import { formatGrams, formatKcal, targetProgress } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Macros } from '@/types/api';

type DailyNutritionCardProps = {
  /** Sum of today's logged entries. */
  totals: Macros;
  /** Daily targets. Omit (or pass null) and the card shows totals without progress bars. */
  targets?: Macros | null;
  /** Small print under the card, e.g. where the targets came from. */
  targetsNote?: string | null;
};

type MacroRowProps = {
  label: string;
  consumed: number;
  target: number | undefined;
  unit: string;
  format: (value: number) => string;
};

function MacroProgressRow({ label, consumed, target, unit, format }: MacroRowProps) {
  const { colors, spacing, typography } = useTheme();
  const progress = targetProgress(consumed, target);
  const over = progress !== null && progress > 1;
  const amount =
    target !== undefined && progress !== null
      ? `${format(consumed)} / ${format(target)} ${unit}`
      : `${format(consumed)} ${unit}`;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
        <Text
          style={[
            typography.label,
            { color: over ? colors.warning : colors.textMuted, fontVariant: ['tabular-nums'] },
          ]}
        >
          {amount}
        </Text>
      </View>
      {progress !== null ? (
        <ProgressBar fraction={progress} accessibilityLabel={`${label} progress`} />
      ) : null}
    </View>
  );
}

/** Calories, protein, carbs and fat for the day, with progress toward targets when known. */
export function DailyNutritionCard({ totals, targets, targetsNote }: DailyNutritionCardProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        Nutrition
      </Text>
      <MacroProgressRow
        label="Calories"
        consumed={totals.kcal}
        target={targets?.kcal}
        unit="kcal"
        format={formatKcal}
      />
      <MacroProgressRow
        label="Protein"
        consumed={totals.protein_g}
        target={targets?.protein_g}
        unit="g"
        format={formatGrams}
      />
      <MacroProgressRow
        label="Carbs"
        consumed={totals.carb_g}
        target={targets?.carb_g}
        unit="g"
        format={formatGrams}
      />
      <MacroProgressRow
        label="Fat"
        consumed={totals.fat_g}
        target={targets?.fat_g}
        unit="g"
        format={formatGrams}
      />
      {targetsNote ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{targetsNote}</Text>
      ) : null}
    </Card>
  );
}
