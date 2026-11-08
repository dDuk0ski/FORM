import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, NumberStepper, Screen, SegmentedControl } from '@/components';
import { trainingWeekFixture } from '@/mocks/training';
import { useTheme } from '@/theme';
import type { TrainingPreferences } from '@/types/training';

// Same values as the training_preferences check constraints and the generator's templates.
const SPLITS = [
  { value: 'full_body', label: 'Full body' },
  { value: 'upper_lower', label: 'Upper / Lower' },
  { value: 'push_pull_legs', label: 'Push / Pull / Legs' },
  { value: 'ppl_upper_lower', label: 'Push / Pull / Legs + Upper / Lower' },
  { value: 'bro_split', label: 'Body part split' },
];
const GOALS: { value: TrainingPreferences['goal']; label: string }[] = [
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'strength', label: 'Strength' },
  { value: 'general_fitness', label: 'Fitness' },
];
const LEVELS: { value: TrainingPreferences['experience']; label: string }[] = [
  { value: 'beginner', label: 'New' },
  { value: 'intermediate', label: 'Some' },
  { value: 'advanced', label: 'Lots' },
];

// TODO(Train): load and upsert the user's training_preferences row; regenerate the plan on save.
export default function TrainingPreferencesSheet() {
  const { colors, spacing, typography } = useTheme();
  const [prefs, setPrefs] = useState(trainingWeekFixture.preferences);
  const set = <K extends keyof TrainingPreferences>(key: K, value: TrainingPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <Screen title="Program" edges={[]}>
      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.label, { color: colors.textMuted }]}>Goal</Text>
        <SegmentedControl
          options={GOALS}
          value={prefs.goal}
          onChange={(v) => set('goal', v)}
          accessibilityLabel="Goal"
        />
        <Text style={[typography.label, { color: colors.textMuted }]}>Training experience</Text>
        <SegmentedControl
          options={LEVELS}
          value={prefs.experience}
          onChange={(v) => set('experience', v)}
          accessibilityLabel="Experience"
        />
      </Card>

      <Card style={{ gap: 0 }}>
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.xs }]}>
          Split
        </Text>
        {SPLITS.map((s, i) => (
          <Pressable
            key={s.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: prefs.split === s.value }}
            onPress={() => set('split', s.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.md,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{s.label}</Text>
            {prefs.split === s.value ? (
              <SymbolView name="checkmark" tintColor={colors.train} size={16} weight="bold" />
            ) : null}
          </Pressable>
        ))}
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <NumberStepper
            label="Days a week"
            value={prefs.days_per_week}
            min={2}
            max={6}
            onChange={(v) => set('days_per_week', v)}
          />
        </View>
        <NumberStepper
          label="Session length"
          value={prefs.session_minutes}
          step={15}
          min={30}
          max={120}
          unit="min"
          onChange={(v) => set('session_minutes', v)}
        />
      </Card>

      <Button title="Save and rebuild plan" onPress={() => router.back()} />
    </Screen>
  );
}
