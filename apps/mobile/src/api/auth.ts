import type { AuthSession, AuthUser, Credentials, VerifyEmailInput } from '@/types/auth';

// Mock auth service. Keeps the session in memory so it resets on app reload (you start signed out)
// TODO(auth): replace each function body with supabase calls

let session: AuthSession | null = null;

export const auth = {
    async getSession(): Promise<AuthSession | null> {
        return session;
    },

    async signUp(credentials: Credentials): Promise<AuthUser> {
        return { id: `mock-${Date.now()}`, email: credentials.email }; // TEMP: datetime as unique id
    },

    // creates the account but does not sign the user in yet
    async signIn(credentials: Credentials): Promise<AuthSession> {
        // TEMP: any email works but a short password fails so errors can be tested
        if (credentials.password.length < 8) throw new Error('Invalid email or password');
        session = { user: { id: 'u1', email: credentials.email } };
        return session;
    },

    async signOut(): Promise<void> {
        session = null;
    },

    async verifyEmail(input: VerifyEmailInput): Promise<AuthSession> {
        // TEMP: any 6 digit code works except 000000 so errors can be tested
        if (input.code === '000000') throw new Error('Invalid or expired code');
        session = { user: { id: 'u1', email: input.email } };
        return session;
    },

    async resendCode(email: string): Promise<void> {
        void email; // mock: nothing to send.
    },
};