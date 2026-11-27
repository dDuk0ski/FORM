export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very active';
export type MacroPreset = 'balanced' | 'high-protein' | 'low-carb';

export type ProfileInput = {
    name: string;
    gender: Gender;
    birthDate: string;
};

export type BodyStatsInput = {
    heightFeet: number;
    heightInches: number;
    weight: number;
    goalWeight: number;
    activity: ActivityLevel;
};

export type TargetsInput = {
    calories: number;
    preset: MacroPreset | null;
    proteinG: number;
    carbsG: number;
    fatG: number;
};

export type SetupData = {
    profile?: ProfileInput;
    bodyStats?: BodyStatsInput;
    targets?: TargetsInput;
    timezone?: string;
};