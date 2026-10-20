import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { foodService } from '@/api/foods';
import { useDailyNutrition, useLogFood, useRemoveLogEntry } from '@/hooks/useFoodLog';
import { EMPTY_MACROS, buildLogEntry, sumMacros } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import { createWrapper } from '@/test-utils/providers';
import type { FoodLogEntry } from '@/types/food';

const DAY = '2026-10-16';
const banana = foodsFixture.find((food) => food.id === 'f_0455')!;
const oats = foodsFixture.find((food) => food.id === 'f_0931')!;

let seconds = 0;
function entry(id: string, food = banana, quantity = 1, date = DAY): FoodLogEntry {
  seconds += 1; // each entry gets a later timestamp, so list order is the order logged
  return buildLogEntry({
    id,
    food,
    serving: food.servings[0]!,
    quantity,
    date,
    loggedAt: `${date}T12:00:${String(seconds).padStart(2, '0')}.000Z`,
  });
}

function setup(date = DAY) {
  const { queryClient, wrapper } = createWrapper();
  const hook = renderHook(
    () => ({ day: useDailyNutrition(date), add: useLogFood(), remove: useRemoveLogEntry() }),
    { wrapper },
  );
  return { queryClient, ...hook };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('daily nutrition', () => {
  it('starts at zero for an empty day', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    expect(result.current.day.entries).toEqual([]);
    expect(result.current.day.totals).toEqual(EMPTY_MACROS);
  });

  it('updates totals as soon as a food is logged', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));

    const first = entry('le_1', banana, 1);
    act(() => result.current.add.mutate(first));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
    expect(result.current.day.totals).toEqual(first.nutrients);

    const second = entry('le_22', oats, 1.5);
    act(() => result.current.add.mutate(second));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(2));
    expect(result.current.day.totals).toEqual(sumMacros([first.nutrients, second.nutrients]));
  });

  it('keeps cache and storage consistent after a write settles', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    act(() => result.current.add.mutate(entry('le_1')));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    // Once the invalidation refetch finishes, the cache still matches what is stored.
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
    await expect(foodService.listLogEntries(DAY)).resolves.toEqual(result.current.day.entries);
  });

  it('refreshes the ML today query after logging', async () => {
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    const spy = jest.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.add.mutate(entry('le_1')));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['ml', 'today'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['food-log'] });
  });

  it('does not touch totals when the save fails', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    jest.spyOn(foodService, 'addLogEntry').mockRejectedValueOnce(new Error('Storage is full'));

    act(() => result.current.add.mutate(entry('le_1')));
    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(result.current.day.entries).toEqual([]);
    expect(result.current.day.totals).toEqual(EMPTY_MACROS);

    // Retrying the same entry afterwards works.
    act(() => result.current.add.mutate(entry('le_1')));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
  });

  it('logging the same entry id twice counts it once', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    const once = entry('le_1');
    act(() => result.current.add.mutate(once));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    act(() => result.current.add.mutate(once));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
    expect(result.current.day.totals).toEqual(once.nutrients);
  });

  it('ignores entries logged for a different day', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    act(() => result.current.add.mutate(entry('le_1', banana, 1, '2026-10-15')));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    expect(result.current.day.entries).toEqual([]);
    expect(result.current.day.totals).toEqual(EMPTY_MACROS);
  });

  it('lowers totals when an entry is removed', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isLoading).toBe(false));
    const keep = entry('le_1', banana, 1);
    const drop = entry('le_22', oats, 1);
    act(() => result.current.add.mutate(keep));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
    act(() => result.current.add.mutate(drop));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(2));

    act(() => result.current.remove.mutate('le_22'));
    await waitFor(() => expect(result.current.day.entries).toHaveLength(1));
    expect(result.current.day.totals).toEqual(keep.nutrients);
  });

  it('reports a failed load instead of showing zeros', async () => {
    jest.spyOn(foodService, 'listLogEntries').mockRejectedValueOnce(new Error('Could not read'));
    const { result } = setup();
    await waitFor(() => expect(result.current.day.isError).toBe(true));
  });
});
