import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components';
import {
  DataSourceNotice,
  FoodSearchField,
  FoodSheetScreen,
  LogFoodSummary,
  MealRow,
  SearchResults,
  TodayNutrition,
} from '@/components/food';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDailyNutrition } from '@/hooks/useFoodLog';
import { useToday } from '@/hooks/useToday';
import { todayLocal } from '@/lib/dates';
import { normalizeQuery } from '@/lib/foodSearch';
import { mealKcalTotals } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import { MEAL_TYPES, type Food, type MealType } from '@/types/food';

// Food logging, meal first. Open with router.push('/log-food'); close with router.back().
// The header shows today's "kcal left". Each meal row shows that meal's kcal today and its "+"
// opens /food-search with the meal preselected (food detail opens with it selected too).
// Searching here and "Scan barcode" still work as before (meal suggested by time of day).
// Data comes from foodService (src/api/foods.ts), currently sample data + on-device storage.
// "Scan barcode" opens /scan-barcode (sample barcodes in mock mode; the server lookup is not
// connected yet, see docs/BACKEND_HANDOFF.md).
// TODO(Log food), after the MVP: connect the barcode lookup to the server once its contract
// is agreed, one-tap suggestions from POST /predict-meal (ml.predictMeal), and deducting
// pantry stock when logging from the pantry.
export default function LogFoodModal() {
  const { colors, typography } = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  // Both: hide at once when the field is cleared, show once the debounced text catches up.
  const hasQuery = normalizeQuery(query).length > 0 && normalizeQuery(debouncedQuery).length > 0;
  const log = useDailyNutrition(todayLocal());
  const today = useToday();
  const loaded = !log.isLoading && !log.isError;
  const perMeal = mealKcalTotals(log.entries);

  const openFood = (food: Food) =>
    router.push({ pathname: '/food-detail', params: { id: food.id } });
  const addToMeal = (meal: MealType) => router.push({ pathname: '/food-search', params: { meal } });

  return (
    <FoodSheetScreen
      title="Log food"
      tint="headerLogFood"
      onBack={() => router.back()}
      backLabel="Close"
      subtitle={null}
      top={
        <LogFoodSummary kcal={loaded ? log.totals.kcal : null} target={today.data?.targets.kcal} />
      }
    >
      <DataSourceNotice />
      <Text
        accessibilityRole="header"
        style={[typography.label, { color: colors.textMuted, textAlign: 'center' }]}
      >
        Today’s meals
      </Text>
      {/* Until the log loads, rows show no number rather than a misleading 0. */}
      {MEAL_TYPES.map((meal) => (
        <MealRow key={meal} meal={meal} total={loaded ? perMeal[meal] : null} onAdd={addToMeal} />
      ))}
      <FoodSearchField value={query} onChangeText={setQuery} />
      <Button
        title="Scan barcode"
        variant="softOutline"
        onPress={() => router.push('/scan-barcode')}
      />
      {/* No hint, loading or error while the field is empty: Nutrition and Logged today sit
          right under Scan barcode until the person types. */}
      {hasQuery ? <SearchResults query={debouncedQuery} onSelect={openFood} /> : null}
      <TodayNutrition showHeadline={false} />
    </FoodSheetScreen>
  );
}
