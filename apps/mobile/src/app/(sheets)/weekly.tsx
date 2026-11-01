import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Pill, Row, Screen } from '@/components';
import { formatNumber } from '@/features/nutrition/format';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { useTheme } from '@/theme';
import type { LiftProgress } from '@/types/brief';

const PROGRESS_PILL: Record<
  LiftProgress['progressed_by'],
  { label: string; tone: 'success' | 'neutral' }
> = {
  reps: { label: 'More reps', tone: 'success' },
  weight: { label: 'More weight', tone: 'success' },
  none: { label: 'No change', tone: 'neutral' },
};

// The weekly report. Next week's recommendations come first; each section then leads with
// its takeaway before the numbers.
export default function WeeklyReportSheet() {
  const { colors, spacing, typography } = useTheme();
  const { data } = useWeeklyReport();
  if (!data) {
    return (
      <Screen title="This week" edges={[]}>
        <ActivityIndicator accessibilityLabel="Loading weekly report" />
      </Screen>
    );
  }
  const { body_weight, real_burn, strength, difficulty, adherence } = data;
  const change = body_weight.end_kg - body_weight.start_kg;

  return (
    <Screen title="This week" edges={[]}>
      <Card>
        <Text style={[typography.heading, { color: colors.text }]}>Next week</Text>
        {data.recommendations.map((rec, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text style={[typography.body, { color: colors.primary }]}>{i + 1}.</Text>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{rec}</Text>
          </View>
        ))}
      </Card>

      <Section label="Body weight" headline={body_weight.headline}>
        <Row label="Trend" value={`${body_weight.start_kg} → ${body_weight.end_kg} kg`} />
        <Row label="Change" value={`${change > 0 ? '+' : ''}${change.toFixed(1)} kg`} />
        <Row label="Goal pace" value={`${body_weight.goal_kg_per_week} kg / week`} />
      </Section>

      <Section label="Real burn" headline={real_burn.headline}>
        <Row label="Estimated from your data" value={`${formatNumber(real_burn.tdee_kcal)} kcal`} />
        <Row
          label="Change from last week"
          value={`${real_burn.change_kcal > 0 ? '+' : ''}${real_burn.change_kcal} kcal`}
        />
        <Row label="Profile formula" value={`${formatNumber(real_burn.formula_kcal)} kcal`} />
      </Section>

      <Section label="Strength" headline={strength.headline}>
        {strength.lifts.map((lift) => (
          <View key={lift.name} style={{ gap: spacing.xs / 2, paddingVertical: spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={[typography.label, { color: colors.text }]}>{lift.name}</Text>
              <Pill {...PROGRESS_PILL[lift.progressed_by]} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{lift.summary}</Text>
          </View>
        ))}
      </Section>

      <Section label="Difficulty" headline={difficulty.headline}>
        <Row
          label="Sessions"
          value={`${difficulty.sessions_done} of ${difficulty.sessions_planned}`}
        />
        <Row label="Average reps in reserve" value={difficulty.avg_rir} />
        <Row label="Average readiness" value={`${difficulty.avg_readiness} / 100`} />
      </Section>

      <Section label="Diet adherence" headline={adherence.headline}>
        <Row label="Days logged" value={`${adherence.days_logged} of 7`} />
        {adherence.macros.map((m) => (
          <Row key={m.label} label={m.label} value={`${m.pct}% of target`} />
        ))}
      </Section>
    </Screen>
  );
}

function Section({
  label,
  headline,
  children,
}: {
  label: string;
  headline: string;
  children: ReactNode;
}) {
  const { colors, typography } = useTheme();
  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.heading, { color: colors.text }]}>{headline}</Text>
      {children}
    </Card>
  );
}
