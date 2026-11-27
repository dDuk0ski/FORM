import type { OnboardingService } from '@/types/onboarding';

import { supabase } from './supabase';

// no flag column: done = these profile fields are set + at least one weigh-in.
// same check the backend runs before making targets
const REQUIRED_FIELDS = ['sex', 'birth_date', 'height_cm', 'activity_level', 'goal'] as const;

async function isComplete(): Promise<boolean> {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return false;

    const [profile, weighIns] = await Promise.all([
        supabase.from('profiles').select(REQUIRED_FIELDS.join(', ')).eq('id', userId).maybeSingle(),
        supabase.from('body_metrics').select('date').limit(1),
    ]);
    if (profile.error) throw new Error('Couldn’t load your profile. Check your connection');
    if (weighIns.error) throw new Error('Couldn’t load your profile. Check your connection');

    const row = profile.data as Record<string, unknown> | null;
    const fieldsSet = row !== null && REQUIRED_FIELDS.every((field) => row[field] != null);
    return fieldsSet && weighIns.data.length > 0;
}

export const supabaseOnboarding: OnboardingService = {
    isComplete,

    // nothing to save, just make sure the data is really there
    async complete(): Promise<void> {
        if (!(await isComplete())) {
            throw new Error('Finish your profile and body stats first');
        }
    },
};
