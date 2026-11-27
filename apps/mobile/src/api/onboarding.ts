import type { OnboardingService } from '@/types/onboarding';

import { env } from './env';
import { mockOnboarding } from './onboarding.mock';
import { supabaseOnboarding } from './onboarding.supabase';

// mock by default, supabase when EXPO_PUBLIC_USE_MOCKS=0
export const onboarding: OnboardingService = env.useMocks ? mockOnboarding : supabaseOnboarding;
