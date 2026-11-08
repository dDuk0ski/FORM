import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Pill, Row, Screen } from '@/components';
import { daysLeftLabel } from '@/features/brief';
import {
  CalorieCard,
  GapCloserCard,
  MacroCard,
  MealsCard,
  MicronutrientCard,
} from '@/features/nutrition';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useNutritionDay } from '@/hooks/useNutritionDay';
import { useReadiness } from '@/hooks/useReadiness';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';

const TITLES: Record<string, string> = {
  expiring: 'Expiring soon',
  nutrients: 'Micronutrients',
  eat: 'Eat',
  train: "Today's session",
  fuel: 'Fuel',
  readiness: 'Readiness',
  meals: 'Meals logged',
};

// The detail behind one row of the daily brief, shown as a sheet over Today.
export default function BriefDetailSheet() {
  const { section = '' } = useLocalSearchParams<{ section: string }>();
  return (
    <Screen title={TITLES[section] ?? 'Details'} edges={[]}>
      <SectionDetail section={section} />
    </Screen>
  );
}

function SectionDetail({ section }: { section: string }) {
  const today = useToday();
  const brief = useDailyBrief();
  const day = useNutritionDay();
  if (!today.data || !brief.data || !day.data) {
    return <ActivityIndicator accessibilityLabel="Loading" />;
  }

  switch (section) {
    case 'expiring':
      return <ExpiringList />;
    case 'nutrients':
      return (
        <MicronutrientCard
          nutrients={day.data.micronutrients}
          flags={today.data.micronutrient_flags}
        />
      );
    case 'eat':
      return (
        <>
          <GapCloserCard remaining={today.data.remaining} />
          <ExpiringList />
        </>
      );
    case 'train':
      return <TrainingDetail />;
    case 'fuel':
      return (
        <>
          <CalorieCard today={today.data} />
          <MacroCard today={today.data} />
        </>
      );
    case 'readiness':
      return <ReadinessDetail />;
    case 'meals':
      return <MealsCard meals={day.data.meals} proteinSplit={today.data.protein_split} />;
    default:
      return null;
  }
}

function ExpiringList() {
  const { colors, typography } = useTheme();
  const { data } = useDailyBrief();
  if (!data) return null;
  return (
    <Card>
      <Text style={[typography.heading, { color: colors.text }]}>Expiring this week</Text>
      {data.expiring.map((item) => (
        <Row key={item.pantry_item_id} label={`${item.name}, ${item.grams} g`}>
          <Pill
            label={daysLeftLabel(item.days_left)}
            tone={item.days_left <= 1 ? 'warning' : 'neutral'}
          />
        </Row>
      ))}
    </Card>
  );
}

function TrainingDetail() {
  const { colors, spacing, typography } = useTheme();
  const { data } = useDailyBrief();
  if (!data) return null;
  const { train } = data;
  return (
    <>
      <Card>
        <Text style={[typography.heading, { color: colors.text }]}>{train.headline}</Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>{train.detail}</Text>
      </Card>
      {train.kind === 'session' ? (
        <Card>
          {train.exercises.map((ex) => (
            <View key={ex.name} style={{ gap: spacing.xs / 2, paddingVertical: spacing.xs }}>
              <Text style={[typography.label, { color: colors.text }]}>{ex.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {ex.sets} × {ex.reps_min}–{ex.reps_max} at {ex.weight_kg} kg · {ex.rir} in reserve
              </Text>
            </View>
          ))}
          <Button title="Start workout" onPress={() => router.push('/workout-logger')} />
        </Card>
      ) : null}
    </>
  );
}

function ReadinessDetail() {
  const { colors, typography } = useTheme();
  const { data } = useReadiness();
  if (!data) return <ActivityIndicator accessibilityLabel="Loading readiness" />;
  return (
    <>
      <Card>
        <Text style={[typography.heading, { color: colors.text }]}>{data.advice}</Text>
        <Text style={[typography.number, { color: colors.text }]}>{data.score}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>out of 100</Text>
      </Card>
      <Card>
        <Row label="Sleep" value={`${data.inputs.sleep_h} h`} />
        <Row label="Soreness" value={`${data.inputs.soreness} / 5`} />
        <Row label="Stress" value={`${data.inputs.stress} / 5`} />
        <Row label="Training load, 7 days" value={data.inputs.training_load_7d} />
      </Card>
      <Button
        title="Update check-in"
        variant="secondary"
        onPress={() => router.push('/check-in')}
      />
    </>
  );
}
