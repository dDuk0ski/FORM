import { createSupabaseFoodService, type FoodsClient } from '@/api/foods.supabase';
import { FoodServiceError } from '@/api/foods.types';
import type { NewFoodLog } from '@/types/food';

// A fake Supabase client: records every query-builder call and answers from `respond`.
// No network, no live database.
type Call = { table: string; steps: [string, unknown[]][] };
type Result = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(respond: (call: Call) => Result) {
  const calls: Call[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];
  let rpcResult: Result = { data: [], error: null };

  const from = (table: string) => {
    const call: Call = { table, steps: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'order', 'upsert', 'update', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => {
        call.steps.push([method, args]);
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(respond(call)).then(resolve, reject);
    return builder;
  };
  const rpc = (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve(rpcResult);
  };

  return {
    client: { from, rpc } as unknown as FoodsClient,
    calls,
    rpcCalls,
    setRpc: (r: Result) => {
      rpcResult = r;
    },
  };
}

const ok = (data: unknown): Result => ({ data, error: null });

const entryRow = {
  id: 'log-1',
  food_id: 'food-1',
  food_name: 'Egg, whole, raw',
  local_date: '2026-11-08',
  logged_at: '2026-11-08T12:00:00Z',
  meal: 'breakfast',
  source: 'manual',
  grams: '88',
  serving_label: '1 medium',
  serving_quantity: '2',
  kcal: '125.84',
  protein_g: 11.0528,
  carb_g: null,
  fat_g: '8.3688',
};

const newLog: NewFoodLog = {
  id: 'log-1',
  food_id: 'food-1',
  logged_at: '2026-11-08T12:00:00Z',
  grams: 88,
  meal: 'breakfast',
  source: 'manual',
  serving_label: '1 medium',
  serving_quantity: 2,
};

describe('Supabase FoodService', () => {
  it('searches with search_foods capped at 25 and keeps unknown macros null', async () => {
    const fake = fakeClient(() => ok(null));
    fake.setRpc(
      ok([
        {
          id: 'food-1',
          name: 'Egg, whole, raw',
          brand: null,
          serving_g: '44.0',
          serving_label: '1 medium',
          kcal_per_100g: '143',
          protein_g_per_100g: 12.56,
          carb_g_per_100g: null,
          fat_g_per_100g: '9.51',
        },
      ]),
    );
    const foods = await createSupabaseFoodService(fake.client).searchFoods('  EGG ');

    expect(fake.rpcCalls).toEqual([
      { fn: 'search_foods', args: { query: 'egg', max_results: 25 } },
    ]);
    expect(foods[0]).toEqual({
      id: 'food-1',
      name: 'Egg, whole, raw',
      brand: null,
      macros_per_100g: { kcal: 143, protein_g: 12.56, carb_g: null, fat_g: 9.51 },
      servings: [{ id: 'default', label: '1 medium', grams: 44 }],
    });
  });

  it('keeps the server order and the brand for brand-only matches', async () => {
    const fake = fakeClient(() => ok(null));
    const row = (id: string, name: string, brand: string | null) => ({
      id,
      name,
      brand,
      serving_g: null,
      serving_label: null,
      kcal_per_100g: null,
      protein_g_per_100g: null,
      carb_g_per_100g: null,
      fat_g_per_100g: null,
    });
    fake.setRpc(ok([row('a', 'Oat milk', 'Oatly'), row('b', 'Protein bar', 'Oatly')]));
    const foods = await createSupabaseFoodService(fake.client).searchFoods('oatly');

    expect(foods.map((food) => [food.id, food.brand])).toEqual([
      ['a', 'Oatly'],
      ['b', 'Oatly'],
    ]);
    // No serving on the row: no default serving, and unknown macros stay null.
    expect(foods[1]!.servings).toEqual([]);
    expect(foods[1]!.macros_per_100g).toEqual({
      kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    });
  });

  it('does not call the server for a query shorter than 2 characters', async () => {
    const fake = fakeClient(() => ok(null));
    expect(await createSupabaseFoodService(fake.client).searchFoods('e')).toEqual([]);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('loads a food from foods plus food_macros, and null for an unknown id', async () => {
    const fake = fakeClient((call) =>
      call.table === 'foods'
        ? ok({ id: 'food-1', name: 'Rice', brand: null, serving_g: null, serving_label: null })
        : ok(null),
    );
    const food = await createSupabaseFoodService(fake.client).getFood('food-1');
    expect(fake.calls.map((c) => c.table)).toEqual(['foods', 'food_macros']);
    expect(fake.calls[1]?.steps).toContainEqual(['eq', ['food_id', 'food-1']]);
    expect(food?.macros_per_100g).toEqual({
      kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    });
    expect(food?.servings).toEqual([]);

    const missing = fakeClient(() => ok(null));
    expect(await createSupabaseFoodService(missing.client).getFood('nope')).toBeNull();
  });

  it('lists entries from food_log_entries by local_date, ordered by logged_at', async () => {
    const fake = fakeClient(() => ok([entryRow]));
    const entries = await createSupabaseFoodService(fake.client).listLogEntries('2026-11-08');

    expect(fake.calls[0]?.table).toBe('food_log_entries');
    expect(fake.calls[0]?.steps).toContainEqual(['eq', ['local_date', '2026-11-08']]);
    expect(fake.calls[0]?.steps).toContainEqual(['order', ['logged_at', { ascending: true }]]);
    expect(entries).toEqual([
      {
        id: 'log-1',
        food_id: 'food-1',
        food_name: 'Egg, whole, raw',
        date: '2026-11-08',
        logged_at: '2026-11-08T12:00:00Z',
        meal: 'breakfast',
        source: 'manual',
        serving_label: '1 medium',
        serving_quantity: 2,
        grams: 88,
        nutrients: { kcal: 125.8, protein_g: 11.1, carb_g: null, fat_g: 8.4 },
      },
    ]);
  });

  it('rejects a row with a null meal instead of guessing one', async () => {
    const fake = fakeClient(() => ok([{ ...entryRow, meal: null }]));
    await expect(
      createSupabaseFoodService(fake.client).listLogEntries('2026-11-08'),
    ).rejects.toMatchObject({ code: 'unexpected_row' });
  });

  it('inserts into food_logs without user_id, then reads the row back from the view', async () => {
    const fake = fakeClient((call) => (call.table === 'food_logs' ? ok(null) : ok(entryRow)));
    const entry = await createSupabaseFoodService(fake.client).addLogEntry(newLog);

    const [insert, readBack] = fake.calls;
    expect(insert?.table).toBe('food_logs');
    const [method, [row, options]] = insert!.steps[0] as [
      string,
      [Record<string, unknown>, unknown],
    ];
    expect(method).toBe('upsert');
    expect(row).toEqual({
      id: 'log-1',
      food_id: 'food-1',
      grams: 88,
      meal: 'breakfast',
      source: 'manual',
      serving_label: '1 medium',
      serving_quantity: 2,
      logged_at: '2026-11-08T12:00:00Z',
    });
    expect(row).not.toHaveProperty('user_id');
    expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(readBack?.table).toBe('food_log_entries');
    expect(readBack?.steps).toContainEqual(['eq', ['id', 'log-1']]);
    expect(entry.nutrients.carb_g).toBeNull();
  });

  it('reports the missing user_id default as not ready, without retrying', async () => {
    const fake = fakeClient(() => ({
      data: null,
      error: { code: '23502', message: 'null value in column "user_id"' },
    }));
    const add = createSupabaseFoodService(fake.client).addLogEntry(newLog);
    await expect(add).rejects.toBeInstanceOf(FoodServiceError);
    await expect(add).rejects.toMatchObject({ code: 'not_ready' });
    expect(fake.calls).toHaveLength(1);
  });

  it('maps an unknown food id to unknown_food', async () => {
    const fake = fakeClient(() => ({ data: null, error: { code: '23503', message: 'fk' } }));
    await expect(createSupabaseFoodService(fake.client).addLogEntry(newLog)).rejects.toMatchObject({
      code: 'unknown_food',
    });
  });

  it('soft-deletes by setting deleted_at on a not-yet-deleted row', async () => {
    const fake = fakeClient(() => ok(null));
    await createSupabaseFoodService(fake.client).removeLogEntry('log-1');

    const steps = fake.calls[0]!.steps;
    expect(fake.calls[0]?.table).toBe('food_logs');
    expect(steps[0]?.[0]).toBe('update');
    expect(steps[0]?.[1][0]).toEqual({ deleted_at: expect.any(String) });
    expect(steps).toContainEqual(['eq', ['id', 'log-1']]);
    expect(steps).toContainEqual(['is', ['deleted_at', null]]);
  });
});
