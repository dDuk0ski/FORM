import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components';
import {
  DataSourceNotice,
  FoodSearchField,
  FoodSheetScreen,
  MEAL_ROW_LABELS,
  SearchResults,
} from '@/components/food';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDayHeading } from '@/lib/dates';
import { parseMeal } from '@/lib/nutrition';
import type { Food } from '@/types/food';

// Search for a food to add to one meal. Opened by a meal row's "+" on Log food with
// router.push({ pathname: '/food-search', params: { meal } }). Results and the scanner open
// /food-detail with that meal preselected (still changeable there). Saving is unchanged.
export default function FoodSearchModal() {
  const params = useLocalSearchParams<{ meal?: string }>();
  const meal = parseMeal(params.meal);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const openFood = (food: Food) =>
    router.push({
      pathname: '/food-detail',
      params: meal ? { id: food.id, meal } : { id: food.id },
    });

  return (
    <FoodSheetScreen
      title="Add food"
      tint="headerAddFood"
      onBack={() => router.back()}
      subtitle={meal ? `${MEAL_ROW_LABELS[meal]} · ${formatDayHeading()}` : formatDayHeading()}
      top={<FoodSearchField value={query} onChangeText={setQuery} />}
    >
      <DataSourceNotice />
      <Button
        title="Scan barcode"
        variant="softOutline"
        onPress={() =>
          router.push(meal ? { pathname: '/scan-barcode', params: { meal } } : '/scan-barcode')
        }
      />
      <SearchResults query={debouncedQuery} onSelect={openFood} />
    </FoodSheetScreen>
  );
}
