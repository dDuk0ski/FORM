import { router, useLocalSearchParams } from 'expo-router';

import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components';
import { DataSourceNotice, FoodLogForm } from '@/components/food';
import { useFood } from '@/hooks/useFoodSearch';
import { errorMessage } from '@/lib/errors';

// Pick a serving and amount for one food, then add it to today's log.
// Open with router.push({ pathname: '/food-detail', params: { id } }).
export default function FoodDetailModal() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const food = useFood(id);

  return (
    <Screen title="Add food" edges={[]}>
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
        <FoodLogForm key={food.data.id} food={food.data} />
      ) : (
        <EmptyState
          title="Food not found"
          message="This food isn’t available. Go back and search again."
        />
      )}
      <Button title="Back to search" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
