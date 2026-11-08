import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Pill, SegmentedControl } from '@/components';
import { useGapCloser } from '@/hooks/useGapCloser';
import type { GapCloserSuggestion, Macros, MealSize } from '@/types/api';
import { useTheme } from '@/theme';

import { formatNumber } from './format';

const SIZES: { value: MealSize; label: string }[] = [
  { value: 'snack', label: 'Snack' },
  { value: 'meal', label: 'Meal' },
  { value: 'rest_of_day', label: 'Rest of day' },
];

const NUTRIENT_NAMES: Record<string, string> = {
  kcal: 'calories',
  protein_g: 'protein',
  carb_g: 'carbs',
  fat_g: 'fat',
};

type GapCloserCardProps = { remaining: Macros };

export function GapCloserCard({ remaining }: GapCloserCardProps) {
  const { colors, typography } = useTheme();
  const [size, setSize] = useState<MealSize>('meal');
  const { mutate, data, isPending, error } = useGapCloser();

  return (
    <Card>
      <Text style={[typography.heading, { color: colors.text }]}>What to eat next</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        From your pantry, for the {formatNumber(remaining.kcal)} kcal and{' '}
        {formatNumber(remaining.protein_g)} g protein you have left.
      </Text>
      <SegmentedControl
        options={SIZES}
        value={size}
        onChange={setSize}
        accessibilityLabel="Suggestion size"
      />
      <Button
        title={data ? 'Suggest again' : 'Suggest from my pantry'}
        disabled={isPending}
        onPress={() => mutate({ meal_size: size, max_items: 3, exclude_food_ids: [] })}
      />
      {isPending ? <ActivityIndicator accessibilityLabel="Finding suggestions" /> : null}
      {error ? (
        <Text style={[typography.body, { color: colors.danger }]}>{error.message}</Text>
      ) : null}
      {data?.suggestions.map((suggestion) => (
        <Suggestion key={suggestion.rank} suggestion={suggestion} />
      ))}
      {data?.shortfall ? (
        <Text style={[typography.caption, { color: colors.warning }]}>
          Your pantry can&apos;t close the gap. Adding about {formatNumber(data.shortfall.amount)} g
          of {NUTRIENT_NAMES[data.shortfall.nutrient] ?? data.shortfall.nutrient} would.
        </Text>
      ) : null}
    </Card>
  );
}

function Suggestion({ suggestion }: { suggestion: GapCloserSuggestion }) {
  const { colors, spacing, radii, typography } = useTheme();
  const { totals } = suggestion;
  return (
    <View
      style={{
        gap: spacing.xs,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.label, { color: colors.text }]}>Option {suggestion.rank}</Text>
        <Pill label={`${Math.round(suggestion.fit * 100)}% fit`} tone="success" />
      </View>
      {suggestion.items.map((item) => (
        <Text key={item.food_id} style={[typography.body, { color: colors.text }]}>
          {formatNumber(item.grams)} g {item.name}
        </Text>
      ))}
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {formatNumber(totals.kcal)} kcal · {formatNumber(totals.protein_g)} g protein ·{' '}
        {formatNumber(totals.carb_g)} g carbs · {formatNumber(totals.fat_g)} g fat
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{suggestion.reason}</Text>
    </View>
  );
}
