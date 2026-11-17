export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very active';

export type ProfileInput = {
    name: string;
    gender: Gender;
};

export type BodyStatsInput = {
    heightFeet: number;
    heightInches: number;
    weight: number;
    goalWeight: number;
    activity: ActivityLevel;
};

export type SetupData = {
    profile?: ProfileInput;
    bodyStats?: BodyStatsInput;
};

