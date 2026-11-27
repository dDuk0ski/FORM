import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components';
import {
  DataSourceNotice,
  FoodSearchField,
  FoodSheetScreen,
  SearchResults,
  TodayNutrition,
} from '@/components/food';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Food } from '@/types/food';

// Food search and logging. Open with router.push('/log-food'); close with router.back().
// Flow: search here, tap a result to open /food-detail (serving + amount + add to log),
// then come back to see today's totals and entries update.
// Data comes from foodService (src/api/foods.ts), currently sample data + on-device storage.
// "Scan barcode" opens /scan-barcode (sample barcodes in mock mode; the server lookup is not
// connected yet, see docs/BACKEND_HANDOFF.md).
// TODO(Log food), after the MVP: connect the barcode lookup to the server once its contract
// is agreed, one-tap suggestions from POST /predict-meal (ml.predictMeal), and deducting
// pantry stock when logging from the pantry.
export default function LogFoodModal() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const openFood = (food: Food) =>
    router.push({ pathname: '/food-detail', params: { id: food.id } });

  return (
    <FoodSheetScreen
      title="Log food"
      tint="headerLogFood"
      onBack={() => router.back()}
      backLabel="Close"
      top={<FoodSearchField value={query} onChangeText={setQuery} />}
    >
      <DataSourceNotice />
      <Button
        title="Scan barcode"
        variant="softOutline"
        onPress={() => router.push('/scan-barcode')}
      />
      <SearchResults query={debouncedQuery} onSelect={openFood} />
      <TodayNutrition />
    </FoodSheetScreen>
  );
}
