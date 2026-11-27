import { router, useLocalSearchParams } from 'expo-router';

import { Button, EmptyState, ErrorState, LoadingState } from '@/components';
import { DataSourceNotice, FoodLogForm, FoodSheetScreen } from '@/components/food';
import { useFood } from '@/hooks/useFoodSearch';
import { errorMessage } from '@/lib/errors';
import { parseMeal } from '@/lib/nutrition';
import type { LogSource } from '@/types/food';

// Pick a serving and amount for one food, then add it to today's log.
// Open with router.push({ pathname: '/food-detail', params: { id } }). The scanner adds
// `source: 'barcode'` so the saved log records how the food was found; without it the log
// says 'manual', as before. `meal` (from Log food's meal "+") preselects that meal.
export default function FoodDetailModal() {
  const params = useLocalSearchParams<{ id?: string; source?: string; meal?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const source: LogSource | undefined = params.source === 'barcode' ? 'barcode' : undefined;
  const meal = parseMeal(params.meal);
  const food = useFood(id);

  return (
    <FoodSheetScreen title="Add food" tint="headerAddFood" onBack={() => router.back()}>
      <DataSourceNotice />
      {food.isLoading ? (
        <LoadingState label="Loading food…" />
      ) : food.isError ? (
        <ErrorState
          title="Couldn't load this food"
          message={errorMessage(food.error, 'Go back and try again.')}
          onRetry={() => void food.refetch()}
        />
      ) : food.data ? (
        <FoodLogForm key={food.data.id} food={food.data} source={source} initialMeal={meal} />
      ) : (
        <EmptyState
          title="Food not found"
          message="This food isn’t available. Go back and search again."
        />
      )}
      <Button title="Back to search" variant="softOutline" onPress={() => router.back()} />
    </FoodSheetScreen>
  );
}
