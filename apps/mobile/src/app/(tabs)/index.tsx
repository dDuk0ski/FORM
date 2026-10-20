import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Row, Screen, StatTile } from '@/components';
import { TodayNutrition } from '@/components/food';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';

// Today: targets, consumed, remaining and readiness from GET /today.
// The cards above come from GET /today. <TodayNutrition /> below is the food log: all four
// macros summed from what was logged, with progress toward the same targets.
// TODO(Today): gap closer button -> ml.gapCloser (POST /gap-closer).
// TODO(Today): readiness check-in (sleep_h, soreness, stress) -> readiness_checkins.
// TODO(Today): daily weigh-in -> body_metrics; show protein_split, micronutrient_flags.
export default function TodayScreen() {
  const { colors, spacing, typography } = useTheme();
  const { data, isPending, error, refetch } = useToday();
  return (
    <Screen title="Today">
      {isPending ? (
        <ActivityIndicator accessibilityLabel="Loading today" />
      ) : error ? (
        <Card>
          <Text style={[typography.body, { color: colors.danger }]}>{error.message}</Text>
          <Button title="Retry" variant="secondary" onPress={() => refetch()} />
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile label="Calories left" value={data.remaining.kcal} unit="kcal" />
            <StatTile label="Readiness" value={data.readiness.score} />
          </View>
          <Row label="Target" value={`${data.targets.kcal} kcal`} />
          <Row label="Eaten" value={`${data.consumed.kcal} kcal`} />
          <Row label="Protein left" value={`${data.remaining.protein_g} g`} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{data.rationale}</Text>
        </Card>
      )}
      <Button title="Log food" onPress={() => router.push('/log-food')} />
      <TodayNutrition />
    </Screen>
  );
}
