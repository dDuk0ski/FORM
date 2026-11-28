import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pantry } from '@/api/pantry';
import type { PantryItemInput } from '@/types/pantry';

// pantry hooks: one for reading, one per write
const PANTRY_KEY = ['pantry'];

export function usePantry() {
    return useQuery({
        queryKey: PANTRY_KEY,
        queryFn: () => pantry.list(),
    });
}

// after any write, mark the list as stale so it re-fetches and the screen updates
function useRefreshPantry() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: PANTRY_KEY });
}

export function useAddPantryItem() {
    const refresh = useRefreshPantry();
    return useMutation({
        mutationFn: (input: PantryItemInput) => pantry.add(input),
        onSuccess: refresh,
    });
}

export function useUpdatePantryItem() {
    const refresh = useRefreshPantry();
    return useMutation({
        mutationFn: (vars: { id: string; patch: Partial<PantryItemInput> }) =>
            pantry.update(vars.id, vars.patch),
        onSuccess: refresh,
    });
}

export function useRemovePantryItem() {
    const refresh = useRefreshPantry();
    return useMutation({
        mutationFn: (id: string) => pantry.remove(id),
        onSuccess: refresh,
    });
}