import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, NumberStepper, Screen } from '@/components';
import { ProgressionBadge, suggestedReps } from '@/features/training';
import { useTrainingWeek } from '@/hooks/useTrainingWeek';
import { useTheme } from '@/theme';
import type { SessionExercise } from '@/types/training';

type LoggedSet = { weight_kg: number; reps: number; rir: number; done: boolean };

// The live session: each set pre-filled from the plan, tap the circle when done, tap the
// row to change weight, reps or reps in reserve.
// TODO(Train): insert each completed set into workout_sets (soft delete to undo).
export default function WorkoutLoggerScreen() {
  const { colors, spacing, typography } = useTheme();
  const { data } = useTrainingWeek();
  const session = data?.today;
  const initial = useMemo(
    () =>
      Object.fromEntries(
        (session?.exercises ?? []).map((ex) => [
          ex.id,
          Array.from({ length: ex.sets }, (_, i) => ({
            weight_kg: ex.weight_kg,
            reps: suggestedReps(ex, i),
            rir: ex.rir,
            done: false,
          })),
        ]),
      ),
    [session],
  );
  const [log, setLog] = useState<Record<string, LoggedSet[]> | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const sets = log ?? initial;

  if (!session) {
    return (
      <Screen title="Workout" edges={[]}>
        <ActivityIndicator accessibilityLabel="Loading workout" />
      </Screen>
    );
  }

  const update = (exId: string, i: number, patch: Partial<LoggedSet>) =>
    setLog({ ...sets, [exId]: sets[exId].map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const total = Object.values(sets).flat();
  const done = total.filter((s) => s.done).length;

  return (
    <Screen title={session.name} eyebrow={`${done} of ${total.length} sets done`} edges={[]}>
      {session.exercises.map((ex) => (
        <ExerciseLog
          key={ex.id}
          exercise={ex}
          sets={sets[ex.id] ?? []}
          editing={editing}
          onEdit={(key) => setEditing(editing === key ? null : key)}
          onChange={(i, patch) => update(ex.id, i, patch)}
        />
      ))}
      <Button title="Finish workout" onPress={() => router.back()} />
      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
        ]}
      >
        The progression model updates from these sets after you finish.
      </Text>
    </Screen>
  );
}

type ExerciseLogProps = {
  exercise: SessionExercise;
  sets: LoggedSet[];
  editing: string | null;
  onEdit: (key: string) => void;
  onChange: (i: number, patch: Partial<LoggedSet>) => void;
};

function ExerciseLog({ exercise: ex, sets, editing, onEdit, onChange }: ExerciseLogProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card style={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[typography.heading, { color: colors.text }]}>{ex.name}</Text>
        <ProgressionBadge progression={ex.progression} />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        Target {ex.reps_min}–{ex.reps_max} reps, {ex.rir} in reserve
      </Text>
      {sets.map((s, i) => {
        const key = `${ex.id}:${i}`;
        return (
          <View key={key} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit set ${i + 1}`}
                onPress={() => onEdit(key)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={[typography.label, { color: colors.textMuted, width: 52 }]}>
                  Set {i + 1}
                </Text>
                <Text
                  style={[
                    typography.rounded,
                    { color: s.done ? colors.textMuted : colors.text, fontSize: 18, flex: 1 },
                  ]}
                >
                  {s.weight_kg} kg × {s.reps}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted, marginRight: spacing.md }]}
                >
                  {s.rir} RIR
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Set ${i + 1} done`}
                accessibilityState={{ checked: s.done }}
                onPress={() => onChange(i, { done: !s.done })}
                hitSlop={8}
              >
                <SymbolView
                  name={s.done ? 'checkmark.circle.fill' : 'circle'}
                  tintColor={s.done ? colors.readiness : colors.border}
                  size={30}
                />
              </Pressable>
            </View>
            {editing === key ? (
              <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
                <NumberStepper
                  label="Weight"
                  value={s.weight_kg}
                  step={2.5}
                  min={0}
                  unit="kg"
                  onChange={(v) => onChange(i, { weight_kg: v })}
                />
                <NumberStepper
                  label="Reps"
                  value={s.reps}
                  min={0}
                  max={50}
                  onChange={(v) => onChange(i, { reps: v })}
                />
                <NumberStepper
                  label="Reps in reserve"
                  value={s.rir}
                  min={0}
                  max={5}
                  onChange={(v) => onChange(i, { rir: v })}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
