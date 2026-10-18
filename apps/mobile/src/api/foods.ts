import type { FoodDataSource } from '@/types/food';

import { mockFoodService } from './foods.mock';
import type { FoodService } from './foods.types';

// The single seam between the food UI and wherever food data lives.
//
// Screens and hooks call `foodService` and never touch AsyncStorage, fetch or supabase
// directly. Today it is backed by sample data and on-device storage (foods.mock.ts). When
// Joey and Austen confirm the foods / food_logs contract, write a second implementation of
// `FoodService` (search + detail from the food API, log from Supabase) and swap it in
// below. Nothing in src/app, src/components or src/hooks should need to change.
// Integration points are listed in docs/BACKEND_HANDOFF.md.

export { FoodServiceError, type FoodService } from './foods.types';

/** What the UI should tell the user about where this data is stored. */
export const FOOD_DATA_SOURCE: FoodDataSource = 'mock';

export const foodService: FoodService = mockFoodService;
