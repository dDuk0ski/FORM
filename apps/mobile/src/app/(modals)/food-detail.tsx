import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components';
import { DataSourceNotice, FoodLogForm } from '@/components/food';
import { useFood } from '@/hooks/useFoodSearch';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import type { LogSource } from '@/types/food';

// Pick a serving and amount for one food, then add it to today's log.
// Open with router.push({ pathname: '/food-detail', params: { id } }). The scanner adds
// `source: 'barcode'` so the saved log records how the food was found; without it the log
// says 'manual', as before.
export default function FoodDetailModal() {
  const params = useLocalSearchParams<{ id?: string; source?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const source: LogSource | undefined = params.source === 'barcode' ? 'barcode' : undefined;
  const food = useFood(id);
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();

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
        <FoodLogForm key={food.data.id} food={food.data} source={source} />
      ) : (
        <EmptyState
          title="Food not found"
          message="This food isn’t available. Go back and search again."
        />
      )}
      {/* Keep the last button clear of the home indicator. */}
      <View style={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
        <Button title="Back to search" variant="softOutline" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
