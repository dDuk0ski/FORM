import type { PantryService } from '@/types/pantry';

import { env } from './env';
import { mockPantry } from './pantry.mock';
import { supabasePantry } from './pantry.supabase';

export const pantry: PantryService = env.useMocks ? mockPantry : supabasePantry;
