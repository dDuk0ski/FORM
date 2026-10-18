import { filterFoods, normalizeQuery } from '@/lib/foodSearch';
import { foodsFixture } from '@/mocks/foods';

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

  it('requires every word, in any order', () => {
    expect(ids('greek yogurt')).toEqual(['f_2041']);
    expect(ids('yogurt greek')).toEqual(['f_2041']);
    expect(ids('greek banana')).toEqual([]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(ids('zzzz')).toEqual([]);
  });

  it('ranks names that start with the query first, then alphabetically', () => {
    expect(ids('oat')[0]).toBe('f_0931');
    const rice = filterFoods(foodsFixture, 'rice').map((food) => food.name);
    expect(rice).toEqual(['Brown rice, cooked', 'White rice, cooked']);
  });

  it('respects the limit', () => {
    expect(ids('rice', 1)).toHaveLength(1);
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
      const estimate = 4 * protein_g + 4 * carb_g + 9 * fat_g;
      expect(Math.abs(estimate - kcal) / kcal).toBeLessThan(0.25);
    }
  });
});
