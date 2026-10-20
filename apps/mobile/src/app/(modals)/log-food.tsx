import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Screen, SearchInput } from '@/components';
import { DataSourceNotice, SearchResults, TodayNutrition } from '@/components/food';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
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
      />
      <SearchResults query={debouncedQuery} onSelect={openFood} />
      <TodayNutrition />
      <Button title="Close" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
