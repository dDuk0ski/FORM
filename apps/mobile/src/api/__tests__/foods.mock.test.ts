import AsyncStorage from '@react-native-async-storage/async-storage';

import { FOOD_LOG_STORAGE_KEY, mockFoodService as service } from '@/api/foods.mock';
import { buildCustomGramsLog, buildServingLog, hydrateLogEntry } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import type { NewFoodLog } from '@/types/food';

const banana = foodsFixture.find((food) => food.id === 'f_0455')!;

// Local times, so the tests behave the same in any time zone: the app counts an entry
// toward the local day its logged_at falls on.
const DAY = '2026-10-16';
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();

function makeLog(id: string, loggedAt: string, quantity = 1): NewFoodLog {
  return buildServingLog({
    id,
    food: banana,
    serving: banana.servings[0]!,
    quantity,
    loggedAt,
    meal: 'breakfast',
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mock food service: foods', () => {
  it('finds foods by text', async () => {
    const results = await service.searchFoods('banana');
    expect(results.map((food) => food.id)).toEqual(['f_0455']);
  });

  it('resolves to an empty list, not an error, when nothing matches', async () => {
    await expect(service.searchFoods('zzzz')).resolves.toEqual([]);
  });

  it('gets a food by id, or null when unknown', async () => {
    await expect(service.getFood('f_0455')).resolves.toMatchObject({ name: 'Banana, raw' });
    await expect(service.getFood('nope')).resolves.toBeNull();
  });
});

describe('mock food service: food log', () => {
  it('starts empty', async () => {
    await expect(service.listLogEntries(DAY)).resolves.toEqual([]);
  });

  it('adds a log and lists it back joined to its food', async () => {
    const log = makeLog('le_1', at(16, 12));
    const expected = hydrateLogEntry(log, banana);
    await expect(service.addLogEntry(log)).resolves.toEqual(expected);
    await expect(service.listLogEntries(DAY)).resolves.toEqual([expected]);
    expect(expected).toMatchObject({ food_name: 'Banana, raw', date: DAY, grams: 118 });
  });

  it('stores only the log row: no food name and no nutrient copies', async () => {
    const log = makeLog('le_1', at(16, 12));
    await service.addLogEntry(log);

    // The service keeps nothing in memory: a fresh read comes straight from storage.
    const raw = await AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY);
    expect(JSON.parse(raw ?? 'null')).toEqual([{ ...log, deleted_at: null }]);
    expect(raw).not.toContain('food_name');
    expect(raw).not.toContain('nutrients');
    expect(raw).not.toContain('user_id');
    await expect(service.listLogEntries(DAY)).resolves.toHaveLength(1);
  });

  it('is idempotent by id: saving the same id twice leaves one entry, latest wins', async () => {
    await service.addLogEntry(makeLog('le_1', at(16, 12), 1));
    await service.addLogEntry(makeLog('le_1', at(16, 12, 1), 2));
    const entries = await service.listLogEntries(DAY);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.serving_quantity).toBe(2);
  });

  it('lists only the requested local day, oldest first', async () => {
    await service.addLogEntry(makeLog('late', at(16, 18)));
    await service.addLogEntry(makeLog('other-day', at(15, 9)));
    await service.addLogEntry(makeLog('early', at(16, 8)));
    const entries = await service.listLogEntries(DAY);
    expect(entries.map((entry) => entry.id)).toEqual(['early', 'late']);
  });

  it('keeps meal and source, and custom grams with no serving', async () => {
    const custom = buildCustomGramsLog({
      id: 'custom',
      food: banana,
      grams: 150,
      loggedAt: at(16, 12),
      meal: 'dinner',
    });
    await service.addLogEntry(custom);
    const [entry] = await service.listLogEntries(DAY);
    expect(entry).toMatchObject({
      meal: 'dinner',
      source: 'manual',
      serving_label: null,
      serving_quantity: null,
      grams: 150,
    });
  });

  it('soft deletes: the entry disappears from the list but the row is kept', async () => {
    await service.addLogEntry(makeLog('keep', at(16, 8)));
    await service.addLogEntry(makeLog('drop', at(16, 9)));
    await service.removeLogEntry('drop');
    await service.removeLogEntry('never-existed');

    const entries = await service.listLogEntries(DAY);
    expect(entries.map((entry) => entry.id)).toEqual(['keep']);

    const rows = JSON.parse((await AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY)) ?? '[]');
    const dropped = rows.find((row: { id: string }) => row.id === 'drop');
    expect(dropped.deleted_at).toEqual(expect.any(String));
    expect(rows.find((row: { id: string }) => row.id === 'keep').deleted_at).toBeNull();
  });

  it('keeps every entry when several are added at the same moment', async () => {
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((id, index) =>
        service.addLogEntry(makeLog(id, at(16, 10, index))),
      ),
    );
    const entries = await service.listLogEntries(DAY);
    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('rejects a food it does not know, and saves nothing', async () => {
    await expect(
      service.addLogEntry({ ...makeLog('x', at(16, 12)), food_id: 'nope' }),
    ).rejects.toMatchObject({ code: 'unknown_food' });
    await expect(service.listLogEntries(DAY)).resolves.toEqual([]);
  });

  it('reports unreadable saved data instead of silently overwriting it', async () => {
    await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, 'not json');
    await expect(service.listLogEntries(DAY)).rejects.toMatchObject({
      code: 'corrupt_log',
    });
    await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify([{ nope: true }]));
    await expect(service.addLogEntry(makeLog('x', at(16, 12)))).rejects.toMatchObject({
      code: 'corrupt_log',
    });
    // The bad data is still there, untouched.
    await expect(AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY)).resolves.toBe(
      JSON.stringify([{ nope: true }]),
    );
  });
});
