import { deviceTimezone, todayLocal } from '@/lib/dates';
import type { ActivityLevel, BodyStatsInput, Gender, ProfileInput, SetupData, SetupService } from '@/types/setup';

import { supabase } from './supabase';

// Real setup service. The screens collect imperial values; the database always stores
// kg and cm (profiles.units is only for display), so all conversion happens here.
// The profiles row already exists (a trigger creates it at signup), so this only updates it.

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;
// goal weight within this many lbs of current weight counts as "maintain"
const MAINTAIN_RANGE_LBS = 2;

// TODO(setup): decide what 'other' should save. The DB only allows 'male' or 'female',
// so for now it saves nothing, which also keeps onboarding from completing.
function toSex(gender: Gender): 'male' | 'female' | null {
    return gender === 'other' ? null : gender;
}

// TODO(setup): the DB also allows 'active'; decide whether the screen should offer it
const ACTIVITY_TO_DB: Record<ActivityLevel, string> = {
    sedentary: 'sedentary',
    light: 'light',
    moderate: 'moderate',
    'very active': 'very_active',
};

// calculate goal direction from goal weight
function toGoal(weightLbs: number, goalWeightLbs: number): 'lose' | 'maintain' | 'gain' {
    const diff = goalWeightLbs - weightLbs;
    if (Math.abs(diff) <= MAINTAIN_RANGE_LBS) return 'maintain';
    return diff < 0 ? 'lose' : 'gain';
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

// Postgres error codes a user can actually cause; anything else is a connection or setup problem
function friendlyError(error: { code?: string; message: string }): Error {
    if (error.code === '23514') return new Error('One of these values isn’t allowed. Check them and try again');
    if (error.code === '42501') return new Error('You don’t have permission to save this. Try logging in again');
    return new Error('Couldn’t save. Check your connection and try again');
}

async function currentUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('You’re signed out. Log in and try again');
    return id;
}

// profiles has no user_id default; Supabase also refuses an update with no filter,
// so filter on the signed-in user's id (RLS checks it matches anyway)
async function updateProfile(fields: Record<string, unknown>): Promise<void> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...fields, units: 'imperial', timezone: deviceTimezone() })
        .eq('id', userId)
        .select('id');
    if (error) throw friendlyError(error);
    // no row back means the update matched nothing (missing profile row or blocked by RLS)
    if (!data || data.length === 0) throw new Error('Couldn’t find your profile. Try logging in again');
}

async function saveProfile(profile: ProfileInput): Promise<void> {
    // TODO(setup): name isn't saved yet; profiles has no name column (ask whether it maps to username)
    await updateProfile({ sex: toSex(profile.gender), birth_date: profile.birthDate });
}

async function saveBodyStats(stats: BodyStatsInput): Promise<void> {
    const totalInches = stats.heightFeet * 12 + stats.heightInches;
    await updateProfile({
        height_cm: round(totalInches * CM_PER_INCH, 1),
        activity_level: ACTIVITY_TO_DB[stats.activity],
        goal: toGoal(stats.weight, stats.goalWeight),
    });

    // the first weigh-in; one row per user per day, so redoing setup today overwrites it.
    // user_id is filled in by the database (DEFAULT auth.uid())
    const { error } = await supabase
        .from('body_metrics')
        .upsert(
            { date: todayLocal(), weight_kg: round(stats.weight * KG_PER_LB, 2) },
            { onConflict: 'user_id,date' },
        );
    if (error) throw friendlyError(error);
}

// targets aren't saved: the targets table is written by the backend model only.
// The values stay in memory so the screens can still read them back this session.
let local: SetupData = {};

export const supabaseSetup: SetupService = {
    // what was saved this session; nothing reads setup back from the database yet
    // TODO(setup): read profiles + latest body_metrics if a screen needs to prefill after a relaunch
    async get(): Promise<SetupData> {
        return local;
    },

    async saveStep(step: SetupData): Promise<SetupData> {
        if (step.profile) await saveProfile(step.profile);
        if (step.bodyStats) await saveBodyStats(step.bodyStats);
        local = { ...local, ...step, timezone: deviceTimezone() };
        return local;
    },
};
