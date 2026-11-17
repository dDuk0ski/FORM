export type Gender = 'male' | 'female' | 'other';

export type ProfileInput = {
    name: string;
    gender: Gender;
};

export type SetupData = {
    profile?: ProfileInput;
};