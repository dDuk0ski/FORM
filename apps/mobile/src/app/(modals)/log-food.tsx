import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Screen, SearchInput } from '@/components';
import { DataSourceNotice, SearchResults, TodayNutrition } from '@/components/food';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/theme';
import type { Food } from '@/types/food';

// Food search and logging. Open with router.push('/log-food'); close with router.back().
// Flow: search here, tap a result to open /food-detail (serving + amount + add to log),
// then come back to see today's totals and entries update.
// Data comes from foodService (src/api/foods.ts), currently sample data + on-device storage.
// TODO(Log food), after the MVP: barcode lookup, one-tap suggestions from
// POST /predict-meal (ml.predictMeal), and deducting pantry stock when logging from the pantry.
export default function LogFoodModal() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const openFood = (food: Food) =>
    router.push({ pathname: '/food-detail', params: { id: food.id } });

  return (
    <Screen title="Log food" edges={[]}>
      <DataSourceNotice />
      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods"
        accessibilityLabel="Search foods"
        variant="soft"
      />
      <SearchResults query={debouncedQuery} onSelect={openFood} />
      <TodayNutrition />
      {/* Keep the last button clear of the home indicator. */}
      <View style={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
        <Button title="Close" variant="softOutline" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
