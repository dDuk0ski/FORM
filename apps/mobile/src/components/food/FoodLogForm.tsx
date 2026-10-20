import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card } from '@/components';
import { useLogFood } from '@/hooks/useFoodLog';
import { errorMessage } from '@/lib/errors';
import { nowUtcIso, todayLocal } from '@/lib/dates';
import {
  MAX_QUANTITY,
  MIN_QUANTITY,
  buildLogEntry,
  defaultServing,
  formatGrams,
  formatKcal,
  formatQuantity,
  macrosForServing,
  newEntryId,
  parseQuantity,
  servingGrams,
} from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Food } from '@/types/food';

import { NutritionPreview } from './NutritionPreview';
import { QuantityField } from './QuantityField';
import { ServingSelector } from './ServingSelector';

const QUANTITY_STEP = 0.5;

/**
 * Choose a serving and amount for one food, preview the scaled nutrition, and add it to
 * today's log. After a successful save the form is replaced by a confirmation.
 */
export function FoodLogForm({ food }: { food: Food }) {
  const { colors, spacing, typography } = useTheme();
  const logFood = useLogFood();
  const [servingId, setServingId] = useState(() => defaultServing(food).id);
  const [quantityText, setQuantityText] = useState('1');
  // One id per form, so a retry after a failed save cannot create a duplicate entry.
  const [entryId] = useState(newEntryId);

  const servings = food.servings.length > 0 ? food.servings : [defaultServing(food)];
  const serving = servings.find((option) => option.id === servingId) ?? defaultServing(food);
  const parsed = parseQuantity(quantityText, serving);
  const quantity = parsed.ok ? parsed.value : null;
  const preview = quantity === null ? null : macrosForServing(food, serving, quantity);

  const clearSaveError = () => {
    if (logFood.isError) {
      logFood.reset();
    }
  };

  const onStep = (direction: -1 | 1) => {
    clearSaveError();
    const next = (quantity ?? 1) + direction * QUANTITY_STEP;
    setQuantityText(formatQuantity(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next))));
  };

  const onAdd = () => {
    if (quantity === null || logFood.isPending) {
      return;
    }
    logFood.mutate(
      buildLogEntry({
        id: entryId,
        food,
        serving,
        quantity,
        date: todayLocal(),
        loggedAt: nowUtcIso(),
      }),
    );
  };

  if (logFood.isSuccess) {
    const saved = logFood.data;
    return (
      <View accessibilityLiveRegion="polite">
        <Card>
          <Text accessibilityRole="header" style={[typography.heading, { color: colors.success }]}>
            Added to your log
          </Text>
          <Text style={[typography.body, { color: colors.text }]}>{saved.food_name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatQuantity(saved.serving_quantity)} × {saved.serving_label},{' '}
            {formatKcal(saved.nutrients.kcal)} kcal
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs / 2 }}>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
          {food.name}
        </Text>
        {food.brand ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{food.brand}</Text>
        ) : null}
      </View>

      <ServingSelector
        servings={servings}
        selectedId={serving.id}
        onSelect={(id) => {
          clearSaveError();
          setServingId(id);
        }}
      />

      <QuantityField
        label="Servings"
        value={quantityText}
        onChangeText={(text) => {
          clearSaveError();
          setQuantityText(text);
        }}
        onStep={onStep}
        error={parsed.ok ? null : parsed.error}
        decrementDisabled={quantity !== null && quantity <= MIN_QUANTITY}
        incrementDisabled={quantity !== null && quantity >= MAX_QUANTITY}
      />
      {quantity !== null ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatGrams(servingGrams(serving, quantity))} g in total
        </Text>
      ) : null}

      <NutritionPreview macros={preview} />

      {logFood.isError ? (
        <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>
          {errorMessage(logFood.error, 'Could not save this entry.')} Your log was not changed.
        </Text>
      ) : null}

      <Button
        title={logFood.isPending ? 'Adding…' : logFood.isError ? 'Try again' : 'Add to log'}
        onPress={onAdd}
        disabled={quantity === null || logFood.isPending}
      />
    </View>
  );
}
