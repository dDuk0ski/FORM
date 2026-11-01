import { Text, View } from 'react-native';

import { Card, Pill, ProgressBar } from '@/components';
import type { MicronutrientFlag } from '@/types/api';
import type { NutrientIntake } from '@/types/nutrition';
import { useTheme } from '@/theme';

import { formatNumber } from './format';

type MicronutrientCardProps = {
  nutrients: NutrientIntake[];
  flags: MicronutrientFlag[];
};

export function MicronutrientCard({ nutrients, flags }: MicronutrientCardProps) {
  const { colors, typography } = useTheme();
  return (
    <Card>
      <Text style={[typography.heading, { color: colors.text }]}>Micronutrients</Text>
      {flags.map((flag) => {
        const name = nutrients.find((n) => n.key === flag.nutrient)?.label ?? flag.nutrient;
        return (
          <Pill
            key={flag.nutrient}
            tone="warning"
            label={`${name}: ${flag.pct_of_rda_7d}% of target, 7-day average`}
          />
        );
      })}
      {nutrients.map((nutrient) => (
        <NutrientRow key={nutrient.key} nutrient={nutrient} />
      ))}
    </Card>
  );
}

function NutrientRow({ nutrient }: { nutrient: NutrientIntake }) {
  const { colors, spacing, typography } = useTheme();
  const { label, unit, amount, target, kind, known_fraction } = nutrient;
  const overLimit = kind === 'limit' && amount !== null && amount > target;
  const value =
    amount === null
      ? 'Unknown'
      : `${formatNumber(amount)} / ${formatNumber(target)} ${unit}${kind === 'limit' ? ' limit' : ''}`;
  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.label, { color: overLimit ? colors.warning : colors.textMuted }]}>
          {value}
        </Text>
      </View>
      <ProgressBar
        value={amount ?? 0}
        max={target}
        color={kind === 'limit' ? (overLimit ? 'warning' : 'textMuted') : 'success'}
        accessibilityLabel={`${label} against ${kind}`}
      />
      {known_fraction < 1 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Known for {Math.round(known_fraction * 100)}% of what you logged
        </Text>
      ) : null}
    </View>
  );
}
