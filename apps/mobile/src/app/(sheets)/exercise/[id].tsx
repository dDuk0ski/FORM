import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Pill, Screen } from '@/components';
import { Sparkline } from '@/features/brief';
import {
  PERFORMANCE_LABEL,
  ProbabilityBars,
  ProgressionBadge,
  REP_POSITION_LABEL,
  explain,
  formatRest,
} from '@/features/training';
import { useTrainingWeek } from '@/hooks/useTrainingWeek';
import { useTheme } from '@/theme';

// One exercise: today's prescription, why the progression model chose it, and the history.
export default function ExerciseSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, typography } = useTheme();
  const { data } = useTrainingWeek();
  const ex = data?.today.exercises.find((e) => e.id === id);
  if (!ex) {
    return (
      <Screen title="Exercise" edges={[]}>
        <ActivityIndicator accessibilityLabel="Loading exercise" />
      </Screen>
    );
  }
  const p = ex.progression;
  const e1rm = ex.e1rm_trend;
  const e1rmChange = e1rm[e1rm.length - 1] - e1rm[0];
  const strong = p.performance === 'excellent' || p.performance === 'good';

  return (
    <Screen
      title={ex.name}
      eyebrow={`${ex.role} · ${ex.equipment} · ${ex.primary_muscle}`}
      edges={[]}
    >
      <Card>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={[typography.eyebrow, { color: colors.train }]}>TODAY</Text>
          <ProgressionBadge progression={p} />
        </View>
        <Text style={[typography.display, { color: colors.text }]}>
          {ex.weight_kg}
          <Text style={[typography.rounded, { color: colors.textMuted }]}> kg</Text>
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {ex.sets} sets of {ex.reps_min}–{ex.reps_max} · {ex.rir} in reserve · rest{' '}
          {formatRest(ex.rest_seconds)}
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.eyebrow, { color: colors.train }]}>WHY</Text>
        <Text style={[typography.lead, { color: colors.text }]}>{explain(p)}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pill label={PERFORMANCE_LABEL[p.performance]} tone={strong ? 'success' : 'neutral'} />
          <Pill label={REP_POSITION_LABEL[p.rep_position]} />
        </View>
        <ProbabilityBars progression={p} color={colors.train} />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          How likely each change is to keep you progressing, learned from your last{' '}
          {p.sessions_seen} sessions of this lift.
        </Text>
      </Card>

      <Card>
        <Text style={[typography.eyebrow, { color: colors.train }]}>LAST SESSION</Text>
        {ex.last_session.sets.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
            <Text style={[typography.body, { color: colors.textMuted, width: 56 }]}>
              Set {i + 1}
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.text, flex: 1, fontVariant: ['tabular-nums'] },
              ]}
            >
              {s.weight_kg} kg × {s.reps}
            </Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>{s.rir} RIR</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[typography.eyebrow, { color: colors.train }]}>ESTIMATED 1-REP MAX</Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={[typography.display, { color: colors.text }]}>
              {e1rm[e1rm.length - 1].toFixed(1)}
              <Text style={[typography.rounded, { color: colors.textMuted }]}> kg</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {e1rmChange >= 0 ? '+' : ''}
              {e1rmChange.toFixed(1)} kg over {e1rm.length} sessions
            </Text>
          </View>
          <Sparkline values={e1rm} color={colors.train} width={130} />
        </View>
      </Card>
    </Screen>
  );
}
