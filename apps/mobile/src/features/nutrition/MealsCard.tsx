import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Card } from '@/components';
import type { TodayResponse } from '@/types/api';
import type { MealLog, MealSlot } from '@/types/nutrition';
import { useTheme } from '@/theme';

import { formatNumber } from './format';

const SLOTS: { meal: MealSlot; label: string }[] = [
  { meal: 'breakfast', label: 'Breakfast' },
  { meal: 'lunch', label: 'Lunch' },
  { meal: 'dinner', label: 'Dinner' },
  { meal: 'snack', label: 'Snacks' },
];

type MealsCardProps = {
  meals: MealLog[];
  proteinSplit: TodayResponse['protein_split'];
};

export function MealsCard({ meals, proteinSplit }: MealsCardProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card>
      <Text style={[typography.heading, { color: colors.text }]}>Meals</Text>
      {SLOTS.map(({ meal, label }) => {
        const log = meals.find((m) => m.meal === meal);
        return (
          <View key={meal} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
              <Text style={[typography.label, { color: colors.textMuted }]}>
                {log
                  ? `${formatNumber(log.kcal)} kcal · ${formatNumber(log.protein_g)} g protein`
                  : 'Nothing logged'}
              </Text>
            </View>
            {log?.items.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
              >
                <Text style={[typography.caption, { color: colors.textMuted, flexShrink: 1 }]}>
                  {item.name}, {formatNumber(item.grams)} g
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {formatNumber(item.kcal)} kcal
                </Text>
              </View>
            ))}
          </View>
        );
      })}
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Protein split: {proteinSplit.meals_logged} meals, largest {proteinSplit.largest_meal_g} g.{' '}
        {proteinSplit.advice}
      </Text>
      <Button title="Log food" onPress={() => router.push('/log-food')} />
    </Card>
  );
}
