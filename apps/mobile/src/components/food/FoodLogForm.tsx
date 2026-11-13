import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card } from '@/components';
import { useLogFood } from '@/hooks/useFoodLog';
import { errorMessage } from '@/lib/errors';
import { nowUtcIso } from '@/lib/dates';
import {
  CUSTOM_SERVING_ID,
  MAX_QUANTITY,
  MAX_TOTAL_GRAMS,
  MIN_GRAMS,
  MIN_QUANTITY,
  buildCustomGramsLog,
  buildServingLog,
  defaultMeal,
  defaultServing,
  formatGrams,
  formatNutrient,
  formatQuantity,
  newEntryId,
  parseGrams,
  parseQuantity,
  round1,
  scaleMacros,
  servingGrams,
} from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Food, MealType } from '@/types/food';

import { MealPicker } from './MealPicker';
import { NutritionPreview } from './NutritionPreview';
import { QuantityField } from './QuantityField';
import { ServingSelector } from './ServingSelector';

const QUANTITY_STEP = 0.5;
const GRAMS_STEP = 10;
const DEFAULT_CUSTOM_GRAMS = '100';

/**
 * Choose a meal, a serving (or custom grams) and an amount for one food, preview the scaled
 * nutrition, and add it to today's log. After a successful save the form is replaced by a
 * confirmation.
 */
export function FoodLogForm({ food }: { food: Food }) {
  const { colors, spacing, typography } = useTheme();
  const logFood = useLogFood();
  const [servingId, setServingId] = useState(() => defaultServing(food).id);
  const [quantityText, setQuantityText] = useState('1');
  const [meal, setMeal] = useState<MealType>(() => defaultMeal());
  // One id per form, so a retry after a failed save cannot create a duplicate entry.
  const [entryId] = useState(newEntryId);

  const servings = food.servings.length > 0 ? food.servings : [defaultServing(food)];
  const isCustom = servingId === CUSTOM_SERVING_ID;
  const serving = servings.find((option) => option.id === servingId) ?? defaultServing(food);
  const parsed = isCustom ? parseGrams(quantityText) : parseQuantity(quantityText, serving);
  const amount = parsed.ok ? parsed.value : null;
  const grams = amount === null ? null : isCustom ? round1(amount) : servingGrams(serving, amount);
  const preview = grams === null ? null : scaleMacros(food.macros_per_100g, grams);

  const clearSaveError = () => {
    if (logFood.isError) {
      logFood.reset();
    }
  };

  const onSelectServing = (id: string) => {
    clearSaveError();
    if ((id === CUSTOM_SERVING_ID) !== isCustom) {
      // The amount means servings in one mode and grams in the other, so start fresh.
      setQuantityText(id === CUSTOM_SERVING_ID ? DEFAULT_CUSTOM_GRAMS : '1');
    }
    setServingId(id);
  };

  const onStep = (direction: -1 | 1) => {
    clearSaveError();
    if (isCustom) {
      const next = (amount ?? Number(DEFAULT_CUSTOM_GRAMS)) + direction * GRAMS_STEP;
      setQuantityText(formatGrams(Math.min(MAX_TOTAL_GRAMS, Math.max(MIN_GRAMS, next))));
      return;
    }
    const next = (amount ?? 1) + direction * QUANTITY_STEP;
    setQuantityText(formatQuantity(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next))));
  };

  const onAdd = () => {
    if (amount === null || logFood.isPending) {
      return;
    }
    const base = { id: entryId, food, loggedAt: nowUtcIso(), meal };
    logFood.mutate(
      isCustom
        ? buildCustomGramsLog({ ...base, grams: amount })
        : buildServingLog({ ...base, serving, quantity: amount }),
    );
  };

  if (logFood.isSuccess) {
    const saved = logFood.data;
    const eaten =
      saved.serving_quantity !== null && saved.serving_label !== null
        ? `${formatQuantity(saved.serving_quantity)} × ${saved.serving_label}`
        : `${formatGrams(saved.grams)} g`;
    const savedKcal = formatNutrient(saved.nutrients.kcal, 'kcal');
    return (
      <View accessibilityLiveRegion="polite">
        <Card variant="soft">
          <Text accessibilityRole="header" style={[typography.heading, { color: colors.success }]}>
            Added to your log
          </Text>
          <Text style={[typography.body, { color: colors.text }]}>{saved.food_name}</Text>
          <Text
            accessibilityLabel={`${eaten}, ${savedKcal.accessibilityLabel}`}
            style={[typography.caption, { color: colors.textMuted }]}
          >
            {eaten}, {savedKcal.text}
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

      <MealPicker
        selected={meal}
        onSelect={(next) => {
          clearSaveError();
          setMeal(next);
        }}
      />

      <ServingSelector
        servings={servings}
        selectedId={isCustom ? CUSTOM_SERVING_ID : serving.id}
        onSelect={onSelectServing}
      />

      <QuantityField
        label={isCustom ? 'Grams' : 'Servings'}
        value={quantityText}
        onChangeText={(text) => {
          clearSaveError();
          setQuantityText(text);
        }}
        onStep={onStep}
        error={parsed.ok ? null : parsed.error}
        decrementDisabled={amount !== null && amount <= (isCustom ? MIN_GRAMS : MIN_QUANTITY)}
        incrementDisabled={amount !== null && amount >= (isCustom ? MAX_TOTAL_GRAMS : MAX_QUANTITY)}
      />
      {grams !== null ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatGrams(grams)} g in total
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
        disabled={amount === null || logFood.isPending}
        variant="soft"
      />
    </View>
  );
}
