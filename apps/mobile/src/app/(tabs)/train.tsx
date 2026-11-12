import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Card, ProgressBar, Screen } from '@/components';
import { Tile } from '@/features/brief';
import { ExerciseRow, WeekStrip } from '@/features/training';
import { useTrainingWeek } from '@/hooks/useTrainingWeek';
import { useTheme, withAlpha } from '@/theme';

const GOAL_LABEL = { hypertrophy: 'Muscle', strength: 'Strength', general_fitness: 'Fitness' };

// Train: today's generated session, the week's plan, and what the progression model changed.
// TODO(Train): read the plan and decisions from model_outputs; log sets into workout_sets.
export default function TrainScreen() {
  const { colors, spacing, radii, typography } = useTheme();
  const { data: week } = useTrainingWeek();
  if (!week) {
    return (
      <Screen title="Train">
        <ActivityIndicator accessibilityLabel="Loading training" />
      </Screen>
    );
  }
  const { today, preferences } = week;
  const behind = [...week.volume]
    .sort((a, b) => a.sets / a.target - b.sets / b.target)
    .slice(0, 2)
    .map((v) => v.muscle.toLowerCase());
  const changes = today.exercises.filter((e) => e.progression.action !== 'maintain').length;

  return (
    <Screen title="Train" eyebrow={`${week.split_label} · Week ${week.week_number}`}>
      {/* Today's session */}
      <LinearGradient
        colors={[colors.train, colors.week]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md }}
      >
        <Text style={[typography.eyebrow, { color: withAlpha(colors.onPrimary, 0.8) }]}>TODAY</Text>
        <View>
          <Text style={[typography.display, { color: colors.onPrimary }]}>{today.name}</Text>
          <Text style={[typography.body, { color: withAlpha(colors.onPrimary, 0.85) }]}>
            {today.effort} · {today.exercises.length} exercises · {today.estimated_minutes} min
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {today.target_muscles.map((m) => (
            <View
              key={m}
              style={{
                paddingVertical: 3,
                paddingHorizontal: spacing.sm,
                borderRadius: radii.pill,
                backgroundColor: withAlpha(colors.onPrimary, 0.2),
              }}
            >
              <Text style={[typography.caption, { color: colors.onPrimary, fontWeight: '600' }]}>
                {m}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start workout"
          onPress={() => router.push('/workout-logger')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: radii.pill,
            backgroundColor: colors.onPrimary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <SymbolView name="play.fill" tintColor={colors.train} size={16} />
          <Text style={[typography.label, { color: colors.train, fontSize: 16 }]}>
            Start workout
          </Text>
        </Pressable>
      </LinearGradient>

      <Card>
        <WeekStrip days={week.days} color={colors.train} />
      </Card>

      {/* Today's plan: each exercise with the model's change since last time */}
      <Card style={{ gap: 0 }}>
        <Text style={[typography.eyebrow, { color: colors.train }]}>TODAY&apos;S PLAN</Text>
        <Text style={[typography.heading, { color: colors.text, marginTop: spacing.xs }]}>
          {changes} of {today.exercises.length} lifts progress today
        </Text>
        {today.exercises.map((ex, i) => (
          <View
            key={ex.id}
            style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
          >
            <ExerciseRow
              index={i + 1}
              exercise={ex}
              color={colors.train}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
            />
          </View>
        ))}
      </Card>

      {/* Weekly volume against the generator's targets */}
      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.eyebrow, { color: colors.train }]}>WEEKLY VOLUME</Text>
        <Text style={[typography.heading, { color: colors.text }]}>
          Most room left: {behind.join(' and ')}
        </Text>
        {week.volume.map((v) => (
          <View key={v.muscle} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: colors.text }]}>{v.muscle}</Text>
              <Text style={[typography.label, { color: colors.textMuted }]}>
                {v.sets} / {v.target} sets
              </Text>
            </View>
            <ProgressBar
              value={v.sets}
              max={v.target}
              color="train"
              accessibilityLabel={`${v.muscle} ${v.sets} of ${v.target} sets`}
            />
          </View>
        ))}
      </Card>

      <Tile
        icon="slider.horizontal.3"
        label="Program"
        color={colors.train}
        accessibilityLabel="Program settings"
        onPress={() => router.push('/training-preferences')}
      >
        <Text style={[typography.label, { color: colors.text, fontSize: 16 }]}>
          {week.split_label}, {preferences.days_per_week} days, {preferences.session_minutes} min
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Goal: {GOAL_LABEL[preferences.goal]} · {preferences.equipment.length} equipment types
        </Text>
      </Tile>
    </Screen>
  );
}
