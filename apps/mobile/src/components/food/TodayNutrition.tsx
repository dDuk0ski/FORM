import { Text } from 'react-native';

import { ErrorState, LoadingState } from '@/components';
import { useDailyNutrition, useRemoveLogEntry } from '@/hooks/useFoodLog';
import { useToday } from '@/hooks/useToday';
import { errorMessage } from '@/lib/errors';
import { todayLocal } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { IsoDate } from '@/types/api';

import { DailyNutritionCard } from './DailyNutritionCard';
import { FoodLogList } from './FoodLogList';

/**
 * Today's totals and logged foods. Consumed amounts are ALWAYS the sum of the logged
 * entries. Daily targets come from GET /today (ml.getToday); if that is slow or fails, the
 * totals still show, just without progress bars.
 *
 * Drop this into the Today tab, or any screen that should show the day's nutrition.
 */
export function TodayNutrition({ date }: { date?: IsoDate }) {
  const { colors, typography } = useTheme();
  const day = date ?? todayLocal();
  const { entries, totals, isLoading, isError, error, refetch } = useDailyNutrition(day);
  const today = useToday();
  const remove = useRemoveLogEntry();

  if (isLoading) {
    return <LoadingState label="Loading your log…" />;
  }
  if (isError) {
    return (
      <ErrorState
        title="Couldn't load your log"
        message={errorMessage(error, 'Try again in a moment.')}
        onRetry={() => void refetch()}
      />
    );
  }

  const targets = today.data?.targets ?? null;
  const targetsNote = targets
    ? today.data?.stub
      ? 'Targets are sample values until the nutrition service is connected.'
      : null
    : today.isError
      ? 'Targets are unavailable right now, so only totals are shown.'
      : null;

  return (
    <>
      <DailyNutritionCard totals={totals} targets={targets} targetsNote={targetsNote} />
      <FoodLogList
        entries={entries}
        onRemove={(entryId) => remove.mutate(entryId)}
        removingId={remove.isPending ? (remove.variables ?? null) : null}
      />
      {remove.isError ? (
        <Text accessibilityRole="alert" style={[typography.body, { color: colors.danger }]}>
          {errorMessage(remove.error, 'Could not remove that entry.')} Your log was not changed.
        </Text>
      ) : null}
    </>
  );
}
