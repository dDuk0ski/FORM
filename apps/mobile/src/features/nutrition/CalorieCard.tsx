import { Text, View } from 'react-native';

import { Card, Pill, ProgressBar, Row } from '@/components';
import type { TodayResponse } from '@/types/api';
import { useTheme } from '@/theme';

import { formatNumber } from './format';

type CalorieCardProps = { today: TodayResponse };

export function CalorieCard({ today }: CalorieCardProps) {
  const { colors, spacing, typography } = useTheme();
  const { targets, consumed, remaining } = today;
  const over = remaining.kcal < 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.heading, { color: colors.text }]}>Calories</Text>
        <Pill
          label={today.target_source === 'adaptive' ? 'Adaptive target' : 'Starting target'}
          tone={today.target_source === 'adaptive' ? 'primary' : 'neutral'}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text style={[typography.number, { color: over ? colors.warning : colors.text }]}>
          {formatNumber(Math.abs(remaining.kcal))}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {over ? 'kcal over' : 'kcal left'}
        </Text>
      </View>
      <ProgressBar
        value={consumed.kcal}
        max={targets.kcal}
        color={over ? 'warning' : 'primary'}
        accessibilityLabel="Calories eaten against target"
      />
      <Row label="Eaten" value={`${formatNumber(consumed.kcal)} kcal`} />
      <Row label="Target" value={`${formatNumber(targets.kcal)} kcal`} />
      <Row label="Estimated burn" value={`${formatNumber(today.tdee_estimate)} kcal`} />
      <Text style={[typography.caption, { color: colors.textMuted }]}>{today.rationale}</Text>
    </Card>
  );
}
