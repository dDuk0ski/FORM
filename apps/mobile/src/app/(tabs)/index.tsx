import { ActivityIndicator, Text } from 'react-native';

import { Button, Card, Row, Screen } from '@/components';
import {
  CalorieCard,
  GapCloserCard,
  MacroCard,
  MealsCard,
  MicronutrientCard,
} from '@/features/nutrition';
import { useNutritionDay } from '@/hooks/useNutritionDay';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';

// Today: the nutrition dashboard (targets, macros, what to eat next, meals, micronutrients)
// plus today's readiness.
// TODO(Today): readiness check-in (sleep_h, soreness, stress) -> readiness_checkins.
// TODO(Today): daily weigh-in -> body_metrics.
export default function TodayScreen() {
  const { colors, typography } = useTheme();
  const today = useToday();
  const day = useNutritionDay();

  if (today.isPending) {
    return (
      <Screen title="Today">
        <ActivityIndicator accessibilityLabel="Loading today" />
      </Screen>
    );
  }
  if (today.error) {
    return (
      <Screen title="Today">
        <Card>
          <Text style={[typography.body, { color: colors.danger }]}>{today.error.message}</Text>
          <Button title="Retry" variant="secondary" onPress={() => today.refetch()} />
        </Card>
      </Screen>
    );
  }

  const data = today.data;
  return (
    <Screen title="Today">
      <CalorieCard today={data} />
      <MacroCard today={data} />
      <GapCloserCard remaining={data.remaining} />
      {day.data ? (
        <>
          <MealsCard meals={day.data.meals} proteinSplit={data.protein_split} />
          <MicronutrientCard nutrients={day.data.micronutrients} flags={data.micronutrient_flags} />
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="Loading meals" />
      )}
      <Card>
        <Row label="Readiness" value={data.readiness.score} />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {data.readiness.advice}
        </Text>
      </Card>
    </Screen>
  );
}
