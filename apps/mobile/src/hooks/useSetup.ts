import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { setupApi } from '@/api/setup';
import type { SetupData } from '@/types/setup';

const SETUP_KEY = ['setup'];

export function useSetup() {
    return useQuery({
        queryKey: SETUP_KEY,
        queryFn: () => setupApi.get(),
    });
}

export function useSaveSetupStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (step: SetupData) => setupApi.saveStep(step),
        onSuccess: (merged) => queryClient.setQueryData(SETUP_KEY, merged),
    });
}