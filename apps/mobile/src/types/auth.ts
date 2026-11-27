export type AuthUser = {
    id: string;
    email: string;
};

export type AuthSession = {
    user: AuthUser;
};

// what the create account and login screens collect
export type Credentials = {
    email: string;
    password: string;
};

// what the verify email screen sends
export type VerifyEmailInput = {
    email: string;
    code: string;
};