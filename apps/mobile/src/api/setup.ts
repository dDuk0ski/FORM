import type { SetupData } from '@/types/setup';

// TODO(setup): replace with a Supabase profile read/write; the signatures stay the same

let setup: SetupData = {};

// The device's timezone, for profiles.timezone. Falls back to UTC if the device doesn't report one
function deviceTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export const setupApi = {
    async get(): Promise<SetupData> {
        return setup;
    },

    // Every step sends the timezone, so it's saved even if the user skips some steps.
    // TODO(setup): goes into the profiles .update() alongside the step's fields
    async saveStep(step: SetupData): Promise<SetupData> {
        setup = { ...setup, ...step, timezone: deviceTimezone() };
        return setup;
    },
};