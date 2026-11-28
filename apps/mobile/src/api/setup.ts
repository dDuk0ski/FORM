import type { SetupService } from '@/types/setup';

import { env } from './env';
import { mockSetup } from './setup.mock';
import { supabaseSetup } from './setup.supabase';

// Mock mode is the default (in memory). With EXPO_PUBLIC_USE_MOCKS=0 it saves to Supabase
// (profiles + body_metrics, see setup.supabase.ts). Hooks import `setupApi` and never need
// to know which one is running.
export const setupApi: SetupService = env.useMocks ? mockSetup : supabaseSetup;
