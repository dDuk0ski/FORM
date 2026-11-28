import type { OnboardingService } from '@/types/onboarding';

// mock onboarding status. in memory so it resets on app reload (you start unfinished)

let done = false;

export const mockOnboarding: OnboardingService = {
    async isComplete(): Promise<boolean> {
        return done;
    },

    async complete(): Promise<void> {
        done = true;
    },
};
