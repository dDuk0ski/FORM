import type { SetupData } from '@/types/setup';

// TODO(setup): replace with a Supabase profile read/write; the signatures stay the same

let setup: SetupData = {};

export const setupApi = {
    async get(): Promise<SetupData> {
        return setup;
    },

    async saveStep(step: SetupData): Promise<SetupData> {
        setup = { ...setup, ...step };
        return setup;
    },
};