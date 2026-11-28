import { deviceTimezone } from '@/lib/dates';
import type { SetupData, SetupService } from '@/types/setup';

// Mock setup service. In memory, so it resets on app reload.
// Used when EXPO_PUBLIC_USE_MOCKS isn't 0; the real one is setup.supabase.ts

let setup: SetupData = {};

export const mockSetup: SetupService = {
    async get(): Promise<SetupData> {
        return setup;
    },

    // Every step sends the timezone, so it's saved even if the user skips some steps.
    async saveStep(step: SetupData): Promise<SetupData> {
        setup = { ...setup, ...step, timezone: deviceTimezone() };
        return setup;
    },
};
