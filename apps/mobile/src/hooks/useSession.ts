import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { auth } from '@/api/auth';
import type { Credentials, VerifyEmailInput } from '@/types/auth';

// auth hooks: one for reading the session, one per write
const SESSION_KEY = ['session'];

export function useSession() {
    return useQuery({
        queryKey: SESSION_KEY,
        queryFn: () => auth.getSession(),
    });
}

export function useSignUp() {
    return useMutation({
        mutationFn: (credentials: Credentials) => auth.signUp(credentials),
    });
}

export function useSignIn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (credentials: Credentials) => auth.signIn(credentials),
        onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session)
    });
}

export function useSignOut() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => auth.signOut(),
        onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
    });
}

export function useVerifyEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: VerifyEmailInput) => auth.verifyEmail(input),
        // a verified email means a signed in user, so the cache gets the new session
        onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
    });
}

export function useResendCode() {
    return useMutation({
        mutationFn: (email: string) => auth.resendCode(email),
    });
}