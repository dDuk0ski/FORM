import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { foodService } from '@/api/foods';
import { sumMacros } from '@/lib/nutrition';
import type { IsoDate } from '@/types/api';
import type { FoodLogEntry } from '@/types/food';

export const foodLogKey = (date: IsoDate) => ['food-log', date] as const;
const FOOD_LOG_ROOT = ['food-log'] as const;
// Same key useToday uses. Invalidated after every write so the ML "remaining" numbers
// refresh (see the TODO(Today) in useToday.ts).
const ML_TODAY_ROOT = ['ml', 'today'] as const;

function refreshDerivedQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: FOOD_LOG_ROOT });
  void queryClient.invalidateQueries({ queryKey: ML_TODAY_ROOT });
}

/** Entries logged on one local day. */
export function useFoodLog(date: IsoDate) {
  return useQuery({
    queryKey: foodLogKey(date),
    queryFn: () => foodService.listLogEntries(date),
    retry: false,
  });
}

/**
 * The day's entries plus totals derived from them. Totals are never stored separately, so
 * they cannot drift from the log: change the entries and the totals follow.
 */
export function useDailyNutrition(date: IsoDate) {
  const { data, isLoading, isError, error, refetch } = useFoodLog(date);
  const entries = useMemo(() => data ?? [], [data]);
  const totals = useMemo(() => sumMacros(entries.map((entry) => entry.nutrients)), [entries]);
  return { entries, totals, isLoading, isError, error, refetch };
}

/**
 * Save a log entry. On success the cached log is updated immediately (so totals change
 * without waiting for a refetch), then the log and ML /today queries are invalidated.
 * Callers should disable their button while `isPending`; the entry id makes a retry safe.
 */
export function useLogFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: FoodLogEntry) => foodService.addLogEntry(entry),
    onSuccess: (saved) => {
      queryClient.setQueryData<FoodLogEntry[]>(foodLogKey(saved.date), (current) =>
        current === undefined
          ? undefined
          : [...current.filter((entry) => entry.id !== saved.id), saved],
      );
      refreshDerivedQueries(queryClient);
    },
  });
}

export function useRemoveLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => foodService.removeLogEntry(entryId),
    onSuccess: (_result, entryId) => {
      queryClient.setQueriesData<FoodLogEntry[]>({ queryKey: FOOD_LOG_ROOT }, (current) =>
        current?.filter((entry) => entry.id !== entryId),
      );
      refreshDerivedQueries(queryClient);
    },
  });
}
