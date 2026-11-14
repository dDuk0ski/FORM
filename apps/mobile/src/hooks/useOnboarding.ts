import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboarding } from '@/api/onboarding';

// onboarding hooks: one for reading the flag, one for finishing
const ONBOARDING_KEY = ['onboarding-complete'];

// query: is onboarding done?
export function useOnboardingStatus() {
    return useQuery({
        queryKey: ONBOARDING_KEY,
        queryFn: () => onboarding.isComplete(),
    });
}

// flag onboarding as done
export function useCompleteOnboarding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => onboarding.complete(),
        onSuccess: () => queryClient.setQueryData(ONBOARDING_KEY, true),
    });
}