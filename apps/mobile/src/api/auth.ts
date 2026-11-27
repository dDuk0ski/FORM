import type { AuthService } from '@/types/auth';

import { mockAuth } from './auth.mock';
import { supabaseAuth } from './auth.supabase';
import { env } from './env';

// Mock mode is the default (in-memory, any 6 digit code but 000000 works).
// With EXPO_PUBLIC_USE_MOCKS=0 it uses Supabase Auth (auth.supabase.ts).
// Hooks import `auth` and never need to know which one is running.
export const auth: AuthService = env.useMocks ? mockAuth : supabaseAuth;
