import type { Session } from '@supabase/supabase-js';

import type { AuthService, AuthSession } from '@/types/auth';

import { supabase } from './supabase';

// Real auth service. supabase.ts persists the session in AsyncStorage and refreshes the token,
// so a returning user is still signed in after a relaunch.

// keep the app's own small session type, so screens never depend on Supabase's shape
function toAuthSession(session: Session | null): AuthSession | null {
    if (!session) return null;
    return { user: { id: session.user.id, email: session.user.email ?? '' } };
}

// Supabase's messages are written for developers; these are the ones a user can hit
function friendlyError(error: { message: string; code?: string }): Error {
    switch (error.code) {
        case 'otp_expired':
            return new Error('Invalid or expired code');
        case 'invalid_credentials':
            return new Error('Invalid email or password');
        case 'email_not_confirmed':
            return new Error('Verify your email before logging in');
        case 'over_email_send_rate_limit':
        case 'over_request_rate_limit':
            return new Error('Too many attempts. Wait a minute and try again');
        case 'weak_password':
            return new Error('Choose a stronger password');
        default:
            return new Error(error.message);
    }
}

export const supabaseAuth: AuthService = {
    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw friendlyError(error);
        return toAuthSession(data.session);
    },

    // creates the account and sends the 6 digit code; the user isn't signed in until verifyEmail
    async signUp({ email, password }) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw friendlyError(error);
        // for an email that's already registered, Supabase returns a user with no identities
        // instead of an error, so nobody can probe which emails have accounts
        if (!data.user || data.user.identities?.length === 0) {
            throw new Error('An account with this email already exists');
        }
        return { id: data.user.id, email: data.user.email ?? email };
    },

    async signIn({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw friendlyError(error);
        return toAuthSession(data.session)!;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw friendlyError(error);
    },

    // checks the 6 digit code from the signup email; success signs the user in
    async verifyEmail({ email, code }) {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
        if (error) throw friendlyError(error);
        const session = toAuthSession(data.session);
        if (!session) throw new Error('Invalid or expired code');
        return session;
    },

    async resendCode(email) {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw friendlyError(error);
    },

    onChange(listener) {
        // don't call other supabase.auth methods inside this callback: supabase-js holds a
        // lock while it runs, so awaiting one there can hang
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            listener(toAuthSession(session));
        });
        return () => data.subscription.unsubscribe();
    },
};
