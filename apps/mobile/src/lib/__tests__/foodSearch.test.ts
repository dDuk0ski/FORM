import { filterFoods, normalizeQuery } from '@/lib/foodSearch';
import { foodsFixture } from '@/mocks/foods';

const base = foodsFixture[0]!;

const ids = (query: string, limit?: number) =>
  filterFoods(foodsFixture, query, limit).map((food) => food.id);

describe('normalizeQuery', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeQuery('  Greek   YOGURT ')).toBe('greek yogurt');
  });
});

describe('filterFoods', () => {
  it('returns nothing until the query has two characters', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
    expect(ids('b')).toEqual([]);
  });

  it('finds a food by name, ignoring case', () => {
    expect(ids('banana')).toEqual(['f_0455']);
    expect(ids('CHICKEN')).toEqual(['f_1177']);
  });

  it('matches the whole query as one phrase, like search_foods', () => {
    expect(ids('greek yogurt')).toEqual(['f_2041']);
    expect(ids('yogurt greek')).toEqual([]);
    expect(ids('greek banana')).toEqual([]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(ids('zzzz')).toEqual([]);
  });

  it('ranks names that start with the query first, then shorter names', () => {
    expect(ids('oat')[0]).toBe('f_0931');
    const rice = filterFoods(foodsFixture, 'rice').map((food) => food.name);
    expect(rice).toEqual(['Brown rice, cooked', 'White rice, cooked']);
  });

  it('respects the limit and never returns more than 25', () => {
    expect(ids('rice', 1)).toHaveLength(1);
    const many = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `x${i}`, name: `Oat ${i}` }));
    expect(filterFoods(many, 'oat', 100)).toHaveLength(25);
  });

  it('matches the brand too, after every name match', () => {
    const foods = [
      { ...base, id: 'brand-only', name: 'Protein bar', brand: 'Oatly' },
      { ...base, id: 'name-inner', name: 'Toasted oat flakes', brand: null },
      { ...base, id: 'name-prefix-long', name: 'Oat milk, barista edition', brand: null },
      { ...base, id: 'name-prefix-short', name: 'Oat milk', brand: 'Oatly' },
    ];
    expect(filterFoods(foods, 'oat').map((food) => food.id)).toEqual([
      'name-prefix-short',
      'name-prefix-long',
      'name-inner',
      'brand-only',
    ]);
    expect(filterFoods(foods, 'OATLY').map((food) => food.id)).toEqual([
      'name-prefix-short',
      'brand-only',
    ]);
  });
});

describe('sample food data', () => {
  it('has unique ids and at least one positive serving per food', () => {
    expect(new Set(foodsFixture.map((food) => food.id)).size).toBe(foodsFixture.length);
    for (const food of foodsFixture) {
      expect(food.servings.length).toBeGreaterThan(0);
      for (const serving of food.servings) {
        expect(serving.grams).toBeGreaterThan(0);
      }
    }
  });

  it('has calories roughly consistent with its macros (4/4/9 kcal per gram)', () => {
    // Catches typos in the sample data. Fiber counts as carbs but gives far fewer than
    // 4 kcal/g, so high-fiber foods (broccoli, apple) run up to ~20% under the estimate.
    for (const food of foodsFixture) {
      const { kcal, protein_g, carb_g, fat_g } = food.macros_per_100g;
      // Every sample food has all four values known; none may be null.
      if (kcal === null || protein_g === null || carb_g === null || fat_g === null) {
        throw new Error(`${food.name} has an unknown macro in the sample data`);
      }
      const estimate = 4 * protein_g + 4 * carb_g + 9 * fat_g;
      expect(Math.abs(estimate - kcal) / kcal).toBeLessThan(0.25);
    }
  });
});
