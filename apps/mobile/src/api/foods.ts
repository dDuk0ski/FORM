import type { FoodDataSource } from '@/types/food';

import { env } from './env';
import { mockFoodService } from './foods.mock';
import { createSupabaseFoodService } from './foods.supabase';
import type { FoodService } from './foods.types';
import { supabase } from './supabase';

// The single seam between the food UI and wherever food data lives.
//
// Screens and hooks call `foodService` and never touch AsyncStorage, fetch or supabase
// directly. Mock mode is the default: sample data and on-device storage (foods.mock.ts).
// With EXPO_PUBLIC_USE_MOCKS=0 it uses Supabase (foods.supabase.ts, names on main), which
// needs a signed-in session and a default on food_logs.user_id before logging works.
// Nothing in src/app, src/components or src/hooks should need to change.
// Integration points are listed in docs/BACKEND_HANDOFF.md.

export { FoodServiceError, type FoodService } from './foods.types';

/** What the UI should tell the user about where this data is stored. */
export const FOOD_DATA_SOURCE: FoodDataSource = env.useMocks ? 'mock' : 'api';

export const foodService: FoodService = env.useMocks
  ? mockFoodService
  : createSupabaseFoodService(supabase);
