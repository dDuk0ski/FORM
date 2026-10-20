import {
  EMPTY_MACROS,
  buildLogEntry,
  formatGrams,
  formatKcal,
  formatQuantity,
  macrosForServing,
  newEntryId,
  parseQuantity,
  scaleMacros,
  servingGrams,
  sumMacros,
  targetProgress,
} from '@/lib/nutrition';
import type { Food } from '@/types/food';

// Clean numbers so expected values are exact by hand.
const food: Food = {
  id: 'f_test',
  name: 'Test food',
  brand: null,
  macros_per_100g: { kcal: 200, protein_g: 10, carb_g: 20, fat_g: 5 },
  servings: [
    { id: 'piece', label: '1 piece (40 g)', grams: 40 },
    { id: '100g', label: '100 g', grams: 100 },
  ],
};
const piece = food.servings[0]!;
const hundred = food.servings[1]!;

describe('scaleMacros', () => {
  it('returns the per-100 g values for 100 g', () => {
    expect(scaleMacros(food.macros_per_100g, 100)).toEqual(food.macros_per_100g);
  });

  it('scales every nutrient by grams / 100', () => {
    expect(scaleMacros(food.macros_per_100g, 60)).toEqual({
      kcal: 120,
      protein_g: 6,
      carb_g: 12,
      fat_g: 3,
    });
  });

  it('rounds to one decimal', () => {
    // 89 kcal per 100 g x 118 g = 105.02
    expect(scaleMacros({ kcal: 89, protein_g: 1.1, carb_g: 22.8, fat_g: 0.3 }, 118)).toEqual({
      kcal: 105,
      protein_g: 1.3,
      carb_g: 26.9,
      fat_g: 0.4,
    });
  });

  it('returns zeros for zero grams', () => {
    expect(scaleMacros(food.macros_per_100g, 0)).toEqual(EMPTY_MACROS);
  });
});

describe('servings', () => {
  it('multiplies serving grams by quantity', () => {
    expect(servingGrams(piece, 1.5)).toBe(60);
    expect(servingGrams(hundred, 2)).toBe(200);
  });

  it('computes macros for a serving and quantity', () => {
    expect(macrosForServing(food, piece, 1.5)).toEqual({
      kcal: 120,
      protein_g: 6,
      carb_g: 12,
      fat_g: 3,
    });
  });

  it('gives the same nutrition for 100 g and for the equivalent number of pieces', () => {
    expect(macrosForServing(food, piece, 2.5)).toEqual(macrosForServing(food, hundred, 1));
  });
});

describe('sumMacros', () => {
  it('is zero for an empty list', () => {
    expect(sumMacros([])).toEqual(EMPTY_MACROS);
  });

  it('adds each nutrient', () => {
    expect(
      sumMacros([
        { kcal: 100, protein_g: 5, carb_g: 10, fat_g: 2 },
        { kcal: 50, protein_g: 1, carb_g: 3, fat_g: 4 },
      ]),
    ).toEqual({ kcal: 150, protein_g: 6, carb_g: 13, fat_g: 6 });
  });

  it('does not leak floating point noise', () => {
    const total = sumMacros([
      { kcal: 0.1, protein_g: 0.1, carb_g: 0.1, fat_g: 0.1 },
      { kcal: 0.2, protein_g: 0.2, carb_g: 0.2, fat_g: 0.2 },
    ]);
    expect(total.kcal).toBe(0.3);
    expect(total.protein_g).toBe(0.3);
  });

  it('equals the sum of the entries it is built from', () => {
    const a = buildLogEntry(entryInput('a', piece, 1));
    const b = buildLogEntry(entryInput('b', hundred, 2));
    expect(sumMacros([a.nutrients, b.nutrients])).toEqual({
      kcal: 80 + 400,
      protein_g: 4 + 20,
      carb_g: 8 + 40,
      fat_g: 2 + 10,
    });
  });
});

describe('parseQuantity', () => {
  it.each([
    ['1', 1],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['1,5', 1.5],
    ['  2 ', 2],
    ['0.1', 0.1],
    ['100', 100],
  ])('accepts %j', (input, expected) => {
    expect(parseQuantity(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   ', 'abc', '-1', '0', '0.05', '1e3', '1.2.3', '1 2', '+1', '100.1', '101'])(
    'rejects %j with a message',
    (input) => {
      const result = parseQuantity(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.length).toBeGreaterThan(0);
      }
    },
  );

  it('asks for an amount when empty', () => {
    expect(parseQuantity('')).toEqual({ ok: false, error: 'Enter an amount.' });
  });

  it('caps a single entry at 5000 g', () => {
    expect(parseQuantity('50', hundred)).toEqual({ ok: true, value: 50 });
    const tooBig = parseQuantity('51', hundred);
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) {
      expect(tooBig.error).toContain('5000');
    }
  });
});

describe('targetProgress', () => {
  it('returns the fraction of the target reached', () => {
    expect(targetProgress(50, 100)).toBe(0.5);
    expect(targetProgress(120, 100)).toBe(1.2);
    expect(targetProgress(0, 100)).toBe(0);
  });

  it('returns null when there is no usable target', () => {
    expect(targetProgress(50, undefined)).toBeNull();
    expect(targetProgress(50, null)).toBeNull();
    expect(targetProgress(50, 0)).toBeNull();
    expect(targetProgress(50, -10)).toBeNull();
  });
});

describe('buildLogEntry', () => {
  it('snapshots food, serving, grams and calculated nutrients', () => {
    expect(buildLogEntry(entryInput('le_1', piece, 1.5))).toEqual({
      id: 'le_1',
      food_id: 'f_test',
      food_name: 'Test food',
      date: '2026-10-16',
      logged_at: '2026-10-16T14:30:00.000Z',
      serving_label: '1 piece (40 g)',
      serving_quantity: 1.5,
      grams: 60,
      nutrients: { kcal: 120, protein_g: 6, carb_g: 12, fat_g: 3 },
    });
  });

  it('never includes a user id', () => {
    expect(Object.keys(buildLogEntry(entryInput('le_1', piece, 1)))).not.toContain('user_id');
  });
});

describe('newEntryId', () => {
  it('returns a different id every time', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newEntryId()));
    expect(ids.size).toBe(1000);
  });
});

describe('formatting', () => {
  it('formats quantities without float noise', () => {
    expect(formatQuantity(1.5000000001)).toBe('1.5');
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3');
  });

  it('formats grams with at most one decimal', () => {
    expect(formatGrams(12)).toBe('12');
    expect(formatGrams(12.34)).toBe('12.3');
  });

  it('rounds calories to whole numbers', () => {
    expect(formatKcal(104.6)).toBe('105');
    expect(formatKcal(0)).toBe('0');
  });
});

function entryInput(id: string, serving: typeof piece, quantity: number) {
  return {
    id,
    food,
    serving,
    quantity,
    date: '2026-10-16',
    loggedAt: '2026-10-16T14:30:00.000Z',
  };
}
