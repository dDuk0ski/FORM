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

// what both auth services (mock and Supabase) provide, so hooks don't care which one runs
export type AuthService = {
    getSession(): Promise<AuthSession | null>;
    signUp(credentials: Credentials): Promise<AuthUser>;
    signIn(credentials: Credentials): Promise<AuthSession>;
    signOut(): Promise<void>;
    verifyEmail(input: VerifyEmailInput): Promise<AuthSession>;
    resendCode(email: string): Promise<void>;
    /** Calls listener whenever the session changes (sign in, sign out, token refresh). Returns an unsubscribe function. */
    onChange(listener: (session: AuthSession | null) => void): () => void;
};