import { Text, View } from 'react-native';

import { Card, ProgressBar } from '@/components';
import { formatGrams, formatKcal, targetProgress } from '@/lib/nutrition';
import { useTheme, type ColorTokens } from '@/theme';
import type { Macros } from '@/types/api';

type MacroTone = 'calories' | 'protein' | 'carbs' | 'fat';

const toneDot: Record<MacroTone, keyof ColorTokens> = {
  calories: 'progressGood',
  protein: 'macroProtein',
  carbs: 'macroCarbs',
  fat: 'macroFat',
};

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
  tone: MacroTone;
};

function MacroProgressRow({ label, consumed, target, unit, format, tone }: MacroRowProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const progress = targetProgress(consumed, target);
  const over = progress !== null && progress > 1;
  const amount =
    target !== undefined && progress !== null
      ? `${format(consumed)} / ${format(target)} ${unit}`
      : `${format(consumed)} ${unit}`;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors[toneDot[tone]],
            }}
          />
          <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
        </View>
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
        <ProgressBar fraction={progress} accessibilityLabel={`${label} progress`} tone={tone} />
      ) : null}
    </View>
  );
}

/** Calories, protein, carbs and fat for the day, with progress toward targets when known. */
export function DailyNutritionCard({ totals, targets, targetsNote }: DailyNutritionCardProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card variant="soft" style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        Nutrition
      </Text>
      <MacroProgressRow
        label="Calories"
        consumed={totals.kcal}
        target={targets?.kcal}
        unit="kcal"
        format={formatKcal}
        tone="calories"
      />
      <MacroProgressRow
        label="Protein"
        consumed={totals.protein_g}
        target={targets?.protein_g}
        unit="g"
        format={formatGrams}
        tone="protein"
      />
      <MacroProgressRow
        label="Carbs"
        consumed={totals.carb_g}
        target={targets?.carb_g}
        unit="g"
        format={formatGrams}
        tone="carbs"
      />
      <MacroProgressRow
        label="Fat"
        consumed={totals.fat_g}
        target={targets?.fat_g}
        unit="g"
        format={formatGrams}
        tone="fat"
      />
      {targetsNote ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{targetsNote}</Text>
      ) : null}
    </Card>
  );
}
