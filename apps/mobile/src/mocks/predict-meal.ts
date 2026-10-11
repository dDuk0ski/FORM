import type { PredictMealResponse } from '@/types/api';

// Example payload for POST /predict-meal.
export const predictMealFixture: PredictMealResponse = {
  predictions: [
    {
      label: 'Oats, whey, banana',
      confidence: 0.62,
      items: [
        { food_id: 'f_0931', grams: 80 },
        { food_id: 'f_7712', grams: 30 },
        { food_id: 'f_0455', grams: 118 },
      ],
      last_logged: '2026-10-08T12:12:00Z',
    },
  ],
  stub: true,
};
