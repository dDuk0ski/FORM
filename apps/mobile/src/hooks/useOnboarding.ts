import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboarding } from '@/api/onboarding';

// onboarding hooks: one for reading the flag, one for finishing
const ONBOARDING_KEY = ['onboarding-complete'];

// query: is onboarding done? keyed by user so a new sign in doesn't reuse the last answer
export function useOnboardingStatus(userId: string | undefined) {
    return useQuery({
        queryKey: [...ONBOARDING_KEY, userId],
        queryFn: () => onboarding.isComplete(),
        enabled: userId != null,
    });
}

// flag onboarding as done
export function useCompleteOnboarding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => onboarding.complete(),
        // re-check instead of assuming, the root layout moves on once it's true
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY }),
    });
}
