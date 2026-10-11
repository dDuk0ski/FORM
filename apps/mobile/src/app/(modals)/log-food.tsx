import { router } from 'expo-router';

import { Button, Screen } from '@/components';

// Example modal route. Open with router.push('/log-food'); close with router.back().
// TODO(Log food): food search against `foods` (text search via Supabase),
// barcode lookup, portion in grams, insert into food_logs. One-tap suggestions come from
// POST /predict-meal (ml.predictMeal). Logging from the pantry deducts stock.
export default function LogFoodModal() {
  return (
    <Screen title="Log food" edges={[]}>
      <Button title="Close" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
