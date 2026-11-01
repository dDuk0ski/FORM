import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { BriefList, BriefRow, daysLeftLabel, nextUnloggedMeal } from '@/features/brief';
import { formatNumber } from '@/features/nutrition/format';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useNutritionDay } from '@/hooks/useNutritionDay';
import { useToday } from '@/hooks/useToday';
import { useTheme } from '@/theme';

// Today: the daily brief. Each row leads with what to do, then the number, and opens a
// sheet with the detail (src/app/(sheets)/brief/[section].tsx).
export default function TodayScreen() {
  const { colors, typography } = useTheme();
  const today = useToday();
  const brief = useDailyBrief();
  const day = useNutritionDay();

  const t = today.data;
  const b = brief.data;
  const d = day.data;
  const error = today.error ?? brief.error ?? day.error;
  if (error) {
    return (
      <Screen title="Today">
        <Card>
          <Text style={[typography.body, { color: colors.danger }]}>{error.message}</Text>
          <Button
            title="Retry"
            variant="secondary"
            onPress={() => {
              today.refetch();
              brief.refetch();
              day.refetch();
            }}
          />
        </Card>
      </Screen>
    );
  }
  if (!t || !b || !d) {
    return (
      <Screen title="Today">
        <ActivityIndicator accessibilityLabel="Loading today" />
      </Screen>
    );
  }

  const soonest = b.expiring[0];
  const worst = b.deficiencies[0];
  const mealsLogged = d.meals.filter((m) => m.items.length > 0).length;
  const missingMeal = nextUnloggedMeal(d.meals);

  return (
    <Screen title="Today">
      <Card>
        <Text style={[typography.label, { color: colors.textMuted }]}>Today&apos;s brief</Text>
        <Text style={[typography.body, { color: colors.text }]}>{b.summary}</Text>
      </Card>

      <BriefList>
        {soonest ? (
          <BriefRow
            icon="clock"
            tint="warning"
            label="Expiring"
            headline={`Use the ${soonest.name.toLowerCase()} ${daysLeftLabel(soonest.days_left)}`}
            detail={`${b.expiring.length} items expire this week`}
            onPress={() => router.push('/brief/expiring')}
          />
        ) : null}
        {worst ? (
          <BriefRow
            icon="exclamationmark.triangle"
            tint="warning"
            label="Running low"
            headline={`Eat more ${worst.nutrient.toLowerCase()}`}
            detail={`${worst.pct_of_target_7d}% of target, 7-day average`}
            onPress={() => router.push('/brief/nutrients')}
          />
        ) : null}
      </BriefList>

      <BriefList>
        <BriefRow
          icon="fork.knife"
          label="Eat"
          headline={b.eat.headline}
          detail={b.eat.detail}
          onPress={() => router.push('/brief/eat')}
        />
        <BriefRow
          icon={b.train.kind === 'rest' ? 'bed.double' : 'dumbbell'}
          label="Train"
          headline={b.train.headline}
          detail={b.train.detail}
          onPress={() => router.push('/brief/train')}
        />
        <BriefRow
          icon="plus.circle"
          label="Log"
          headline="Weigh in, check in, or log a meal"
          onPress={() => router.push('/quick-log')}
        />
      </BriefList>

      <BriefList>
        <BriefRow
          icon="flame"
          tint="carb"
          label="Fuel"
          headline={t.protein_split.advice}
          detail={`${formatNumber(t.remaining.kcal)} kcal · ${formatNumber(t.remaining.protein_g)} g protein left`}
          onPress={() => router.push('/brief/fuel')}
        />
        <BriefRow
          icon="heart"
          tint="success"
          label="Readiness"
          headline={t.readiness.advice}
          detail={`${t.readiness.score} / 100`}
          onPress={() => router.push('/brief/readiness')}
        />
        <BriefRow
          icon="list.bullet"
          label="Meals logged"
          headline={missingMeal ? `${missingMeal} not logged yet` : 'All meals logged'}
          detail={`${mealsLogged} logged · ${formatNumber(t.consumed.kcal)} kcal`}
          onPress={() => router.push('/brief/meals')}
        />
      </BriefList>

      <BriefList>
        <BriefRow
          icon="chart.line.uptrend.xyaxis"
          label="This week"
          headline="Your weekly report"
          detail="Weight, real burn, strength and next week's plan"
          onPress={() => router.push('/weekly')}
        />
      </BriefList>
    </Screen>
  );
}
