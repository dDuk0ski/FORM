import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import {
  AlertChip,
  MealDots,
  QuickActions,
  Rings,
  Sparkline,
  Tile,
  daysLeftLabel,
  nextUnloggedMeal,
} from '@/features/brief';
import { formatNumber } from '@/features/nutrition/format';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useNutritionDay } from '@/hooks/useNutritionDay';
import { useToday } from '@/hooks/useToday';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { useTheme } from '@/theme';

// Today: the daily brief. Every tile leads with what to do, then the number, and opens a
// sheet with the detail (src/app/(sheets)/brief/[section].tsx).
export default function TodayScreen() {
  const { colors, spacing, radii, typography } = useTheme();
  const today = useToday();
  const brief = useDailyBrief();
  const day = useNutritionDay();
  const week = useWeeklyReport();

  const t = today.data;
  const b = brief.data;
  const d = day.data;
  const w = week.data;
  const error = today.error ?? brief.error ?? day.error ?? week.error;
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
              week.refetch();
            }}
          />
        </Card>
      </Screen>
    );
  }
  if (!t || !b || !d || !w) {
    return (
      <Screen title="Today">
        <ActivityIndicator accessibilityLabel="Loading today" />
      </Screen>
    );
  }

  const soonest = b.expiring[0];
  const worst = b.deficiencies[0];
  const missingMeal = nextUnloggedMeal(d.meals);
  const weightChange = w.body_weight.end_kg - w.body_weight.start_kg;
  const pct = (eaten: number, target: number) => (target > 0 ? eaten / target : 0);

  return (
    <Screen title="Today" eyebrow={formatDay(t.date)}>
      {/* The brief: the LLM's summary, with today's alerts as chips. */}
      <LinearGradient
        colors={[colors.briefStart, colors.briefEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <SymbolView name="sparkles" tintColor={colors.week} size={16} weight="semibold" />
          <Text style={[typography.eyebrow, { color: colors.week }]}>TODAY&apos;S BRIEF</Text>
        </View>
        <Text style={[typography.lead, { color: colors.text }]}>{b.summary}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {soonest ? (
            <AlertChip
              icon="clock.fill"
              color={colors.alert}
              label={`${soonest.name} ${daysLeftLabel(soonest.days_left)}`}
              onPress={() => router.push('/brief/expiring')}
            />
          ) : null}
          {worst ? (
            <AlertChip
              icon="exclamationmark.triangle.fill"
              color={colors.alert}
              label={`Low ${worst.nutrient.toLowerCase()}`}
              onPress={() => router.push('/brief/nutrients')}
            />
          ) : null}
        </View>
      </LinearGradient>

      <QuickActions
        actions={[
          {
            icon: 'fork.knife',
            label: 'Meal',
            color: colors.eat,
            onPress: () => router.push('/log-food'),
          },
          {
            icon: 'scalemass.fill',
            label: 'Weigh in',
            color: colors.primary,
            onPress: () => router.push('/weigh-in'),
          },
          {
            icon: 'heart.fill',
            label: 'Check in',
            color: colors.readiness,
            onPress: () => router.push('/check-in'),
          },
          {
            icon: 'dumbbell.fill',
            label: 'Workout',
            color: colors.train,
            onPress: () => router.push('/workout-logger'),
          },
        ]}
      />

      {/* Fuel: the advice, then rings for calories, protein and carbs. */}
      <Tile
        icon="flame.fill"
        label="Fuel"
        color={colors.kcal}
        accessibilityLabel={`Fuel: ${t.protein_split.advice} ${formatNumber(t.remaining.kcal)} kcal left`}
        onPress={() => router.push('/brief/fuel')}
      >
        <Text style={[typography.heading, { color: colors.text }]}>{t.protein_split.advice}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Rings
            rings={[
              { progress: pct(t.consumed.kcal, t.targets.kcal), color: colors.kcal },
              { progress: pct(t.consumed.protein_g, t.targets.protein_g), color: colors.protein },
              { progress: pct(t.consumed.carb_g, t.targets.carb_g), color: colors.carb },
            ]}
          />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View>
              <Text style={[typography.display, { color: colors.text }]}>
                {formatNumber(t.remaining.kcal)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>kcal left</Text>
            </View>
            <Legend
              color={colors.protein}
              label="Protein"
              value={`${formatNumber(t.remaining.protein_g)} g left`}
            />
            <Legend
              color={colors.carb}
              label="Carbs"
              value={`${formatNumber(t.remaining.carb_g)} g left`}
            />
            <Legend
              color={colors.fat}
              label="Fat"
              value={`${formatNumber(t.remaining.fat_g)} g left`}
            />
          </View>
        </View>
      </Tile>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Tile
          flex
          icon="fork.knife"
          label="Eat"
          color={colors.eat}
          accessibilityLabel={`Eat: ${b.eat.headline}. ${b.eat.detail}`}
          onPress={() => router.push('/brief/eat')}
        >
          <Text style={[typography.label, { color: colors.text, fontSize: 16, lineHeight: 21 }]}>
            {b.eat.headline}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{b.eat.detail}</Text>
        </Tile>
        <Tile
          flex
          icon={b.train.kind === 'rest' ? 'bed.double.fill' : 'dumbbell.fill'}
          label="Train"
          color={colors.train}
          accessibilityLabel={`Train: ${b.train.headline}. ${b.train.detail}`}
          onPress={() => router.push('/brief/train')}
        >
          <Text style={[typography.label, { color: colors.text, fontSize: 16, lineHeight: 21 }]}>
            {b.train.headline}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{b.train.detail}</Text>
        </Tile>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Tile
          flex
          icon="heart.fill"
          label="Readiness"
          color={colors.readiness}
          accessibilityLabel={`Readiness: ${t.readiness.advice} Score ${t.readiness.score}`}
          onPress={() => router.push('/brief/readiness')}
        >
          <Text style={[typography.label, { color: colors.text, fontSize: 16 }]}>
            {t.readiness.advice}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Rings
              rings={[{ progress: t.readiness.score / 100, color: colors.readiness }]}
              size={44}
              stroke={7}
            />
            <Text style={[typography.display, { color: colors.text }]}>{t.readiness.score}</Text>
          </View>
        </Tile>
        <Tile
          flex
          icon="list.bullet"
          label="Meals"
          color={colors.eat}
          accessibilityLabel={`Meals logged: ${missingMeal ? `${missingMeal} not logged yet` : 'all logged'}`}
          onPress={() => router.push('/brief/meals')}
        >
          <Text style={[typography.label, { color: colors.text, fontSize: 16 }]}>
            {missingMeal ? `${missingMeal} next` : 'All logged'}
          </Text>
          <MealDots meals={d.meals} color={colors.eat} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatNumber(t.consumed.kcal)} kcal so far
          </Text>
        </Tile>
      </View>

      {/* This week: the top recommendation, then the weight trend. */}
      <Tile
        icon="chart.line.uptrend.xyaxis"
        label="This week"
        color={colors.week}
        accessibilityLabel={`This week: ${w.recommendations[0]}`}
        onPress={() => router.push('/weekly')}
      >
        <Text style={[typography.heading, { color: colors.text }]}>{w.recommendations[0]}</Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={[typography.display, { color: colors.text }]}>
              {weightChange > 0 ? '+' : ''}
              {weightChange.toFixed(1)}
              <Text style={[typography.rounded, { color: colors.textMuted }]}> kg</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              trend weight this week
            </Text>
          </View>
          <Sparkline values={w.body_weight.trend_kg} color={colors.week} />
        </View>
      </Tile>
    </Screen>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

/** "2026-10-09" as "Friday, October 9", read as a calendar date (no timezone shift). */
function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
