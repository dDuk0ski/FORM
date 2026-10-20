import AsyncStorage from '@react-native-async-storage/async-storage';

import { FOOD_LOG_STORAGE_KEY, mockFoodService as service } from '@/api/foods.mock';
import { buildLogEntry } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import type { FoodLogEntry } from '@/types/food';

const banana = foodsFixture.find((food) => food.id === 'f_0455')!;

function makeEntry(id: string, date: string, loggedAt: string, quantity = 1): FoodLogEntry {
  return buildLogEntry({
    id,
    food: banana,
    serving: banana.servings[0]!,
    quantity,
    date,
    loggedAt,
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
    await expect(service.listLogEntries('2026-10-16')).resolves.toEqual([]);
  });

  it('adds an entry and lists it back', async () => {
    const entry = makeEntry('le_1', '2026-10-16', '2026-10-16T12:00:00.000Z');
    await expect(service.addLogEntry(entry)).resolves.toEqual(entry);
    await expect(service.listLogEntries('2026-10-16')).resolves.toEqual([entry]);
  });

  it('persists to storage, so it survives closing and reopening the app', async () => {
    const entry = makeEntry('le_1', '2026-10-16', '2026-10-16T12:00:00.000Z');
    await service.addLogEntry(entry);

    // The service keeps nothing in memory: a fresh read comes straight from storage.
    const raw = await AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY);
    expect(JSON.parse(raw ?? 'null')).toEqual([entry]);
    await expect(service.listLogEntries('2026-10-16')).resolves.toEqual([entry]);
  });

  it('is idempotent by id: saving the same id twice leaves one entry, latest wins', async () => {
    await service.addLogEntry(makeEntry('le_1', '2026-10-16', '2026-10-16T12:00:00.000Z', 1));
    await service.addLogEntry(makeEntry('le_1', '2026-10-16', '2026-10-16T12:00:05.000Z', 2));
    const entries = await service.listLogEntries('2026-10-16');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.serving_quantity).toBe(2);
  });

  it('lists only the requested day, oldest first', async () => {
    await service.addLogEntry(makeEntry('late', '2026-10-16', '2026-10-16T18:00:00.000Z'));
    await service.addLogEntry(makeEntry('other-day', '2026-10-15', '2026-10-15T09:00:00.000Z'));
    await service.addLogEntry(makeEntry('early', '2026-10-16', '2026-10-16T08:00:00.000Z'));
    const entries = await service.listLogEntries('2026-10-16');
    expect(entries.map((entry) => entry.id)).toEqual(['early', 'late']);
  });

  it('removes an entry, and ignores an unknown id', async () => {
    await service.addLogEntry(makeEntry('keep', '2026-10-16', '2026-10-16T08:00:00.000Z'));
    await service.addLogEntry(makeEntry('drop', '2026-10-16', '2026-10-16T09:00:00.000Z'));
    await service.removeLogEntry('drop');
    await service.removeLogEntry('never-existed');
    const entries = await service.listLogEntries('2026-10-16');
    expect(entries.map((entry) => entry.id)).toEqual(['keep']);
  });

  it('keeps every entry when several are added at the same moment', async () => {
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((id, index) =>
        service.addLogEntry(makeEntry(id, '2026-10-16', `2026-10-16T10:0${index}:00.000Z`)),
      ),
    );
    const entries = await service.listLogEntries('2026-10-16');
    expect(entries.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('reports unreadable saved data instead of silently overwriting it', async () => {
    await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, 'not json');
    await expect(service.listLogEntries('2026-10-16')).rejects.toMatchObject({
      code: 'corrupt_log',
    });
    await AsyncStorage.setItem(FOOD_LOG_STORAGE_KEY, JSON.stringify([{ nope: true }]));
    await expect(service.addLogEntry(makeEntry('x', '2026-10-16', 'z'))).rejects.toMatchObject({
      code: 'corrupt_log',
    });
    // The bad data is still there, untouched.
    await expect(AsyncStorage.getItem(FOOD_LOG_STORAGE_KEY)).resolves.toBe(
      JSON.stringify([{ nope: true }]),
    );
  });
});
