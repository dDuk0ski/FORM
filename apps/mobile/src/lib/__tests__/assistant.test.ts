import {
  getAvailability,
  isAssistantAvailable,
  labelPer100g,
  parseNutritionLabel,
  parseReceipt,
  recognizeText,
  sanitizeLabel,
  sanitizeReceipt,
  summarizeDay,
  type DaySummaryInput,
  type NutritionLabel,
} from '@/lib/assistant';

// The native module is mocked; `mockModule` can be swapped per test, and null stands for a
// build without the module (Expo Go, older binaries).
const native = {
  availability: jest.fn(),
  summarizeDay: jest.fn(),
  parseNutritionLabel: jest.fn(),
  parseReceipt: jest.fn(),
  recognizeText: jest.fn(),
};
let mockModule: typeof native | null = native;
jest.mock('../../../modules/form-assistant', () => ({
  __esModule: true,
  get default() {
    return mockModule;
  },
}));

const day: DaySummaryInput = {
  date: '2026-10-09',
  targets: { kcal: 2680, protein_g: 175, carb_g: 300, fat_g: 85 },
  consumed: { kcal: 2068, protein_g: 127, carb_g: 242, fat_g: 61 },
  remaining: { kcal: 612, protein_g: 48, carb_g: 58, fat_g: 24 },
  rationale: 'Weight trend fell 0.4 kg over 14 days.',
  workout_done: null,
  readiness_score: 71,
};

const LABEL_OCR = `Nutrition Facts
Serving size 1 cup (240 g)
Calories 150
Total Fat 8 g
Total Carbohydrate 12 g
Protein 8 g`;

beforeEach(() => {
  jest.clearAllMocks();
  mockModule = native;
  native.availability.mockReturnValue('available');
});

describe('availability', () => {
  it('is unsupported when the native module is missing', () => {
    mockModule = null;
    expect(getAvailability()).toBe('unsupported');
    expect(isAssistantAvailable()).toBe(false);
  });

  it.each(['deviceNotEligible', 'appleIntelligenceNotEnabled', 'modelNotReady'] as const)(
    'passes %s through',
    (value) => {
      native.availability.mockReturnValue(value);
      expect(getAvailability()).toBe(value);
      expect(isAssistantAvailable()).toBe(false);
    },
  );

  it('treats an unknown value or a throw as not eligible', () => {
    native.availability.mockReturnValue('somethingNew');
    expect(getAvailability()).toBe('deviceNotEligible');
    native.availability.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(getAvailability()).toBe('deviceNotEligible');
  });
});

describe('fallback when the model is unavailable', () => {
  it.each(['unsupported', 'appleIntelligenceNotEnabled'] as const)(
    'every model call resolves to null (%s) without calling native',
    async (state) => {
      if (state === 'unsupported') mockModule = null;
      else native.availability.mockReturnValue(state);

      await expect(summarizeDay(day)).resolves.toBeNull();
      await expect(parseNutritionLabel(LABEL_OCR)).resolves.toBeNull();
      await expect(parseReceipt('MILK 2%  3.49')).resolves.toBeNull();
      expect(native.summarizeDay).not.toHaveBeenCalled();
      expect(native.parseNutritionLabel).not.toHaveBeenCalled();
      expect(native.parseReceipt).not.toHaveBeenCalled();
    },
  );

  it('native errors resolve to null instead of throwing', async () => {
    native.summarizeDay.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'ERR_ASSISTANT_REFUSED' }),
    );
    native.parseNutritionLabel.mockResolvedValue('not json');
    native.parseReceipt.mockRejectedValue(new Error('too long'));
    await expect(summarizeDay(day)).resolves.toBeNull();
    await expect(parseNutritionLabel(LABEL_OCR)).resolves.toBeNull();
    await expect(parseReceipt('MILK')).resolves.toBeNull();
  });

  it('OCR still works when only the model is unavailable', async () => {
    native.availability.mockReturnValue('deviceNotEligible');
    native.recognizeText.mockResolvedValue('  Nutrition Facts\nProtein 8 g ');
    await expect(recognizeText('file:///tmp/label.jpg')).resolves.toBe(
      'Nutrition Facts\nProtein 8 g',
    );
  });

  it('OCR resolves to null without the module, on error, or with no text', async () => {
    native.recognizeText.mockRejectedValueOnce(new Error('bad image'));
    await expect(recognizeText('file:///x.jpg')).resolves.toBeNull();
    native.recognizeText.mockResolvedValueOnce('   ');
    await expect(recognizeText('file:///x.jpg')).resolves.toBeNull();
    mockModule = null;
    await expect(recognizeText('file:///x.jpg')).resolves.toBeNull();
  });
});

describe('summarizeDay', () => {
  it('sends the day as JSON and trims the reply', async () => {
    native.summarizeDay.mockResolvedValue('  You have 612 kcal left. Aim for 48 g protein.  ');
    await expect(summarizeDay(day)).resolves.toBe('You have 612 kcal left. Aim for 48 g protein.');
    expect(JSON.parse(native.summarizeDay.mock.calls[0][0])).toEqual(day);
  });

  it('keeps at most three sentences, and an empty reply is null', async () => {
    native.summarizeDay.mockResolvedValue('One. Two! Three? Four.');
    await expect(summarizeDay(day)).resolves.toBe('One. Two! Three?');
    native.summarizeDay.mockResolvedValue('   ');
    await expect(summarizeDay(day)).resolves.toBeNull();
  });
});

describe('nutrition label', () => {
  it('keeps nulls as null and never turns them into 0', async () => {
    native.parseNutritionLabel.mockResolvedValue(
      JSON.stringify({
        basis: 'per_serving',
        serving_size_g: 240,
        kcal: 150,
        protein_g: 8,
        carb_g: 12,
        fat_g: 8,
        fiber_g: null,
        sodium_mg: null,
        confidence: 0.9,
      }),
    );
    const label = await parseNutritionLabel(LABEL_OCR);
    expect(label).toEqual({
      basis: 'per_serving',
      serving_size_g: 240,
      kcal: 150,
      protein_g: 8,
      carb_g: 12,
      fat_g: 8,
      fiber_g: null,
      sodium_mg: null,
      confidence: 0.9,
    });
  });

  it('drops a value whose nutrient is not in the OCR text (a guessed 0)', () => {
    const label = sanitizeLabel(
      { basis: 'per_serving', fiber_g: 0, sodium_mg: 0, protein_g: 8 },
      LABEL_OCR,
    );
    expect(label?.fiber_g).toBeNull();
    expect(label?.sodium_mg).toBeNull();
    expect(label?.protein_g).toBe(8);
  });

  it('keeps a printed 0', () => {
    expect(sanitizeLabel({ fat_g: 0 }, 'Total Fat 0 g')?.fat_g).toBe(0);
  });

  it('rejects junk values and clamps confidence', () => {
    const label = sanitizeLabel(
      { basis: 'weird', kcal: -5, protein_g: 'lots', carb_g: '12', fat_g: Infinity, confidence: 7 },
      LABEL_OCR,
    );
    expect(label).toMatchObject({
      basis: 'per_serving',
      kcal: null,
      protein_g: null,
      carb_g: 12,
      fat_g: null,
      confidence: 1,
    });
    expect(sanitizeLabel({}, LABEL_OCR)?.confidence).toBe(0);
    expect(sanitizeLabel([], LABEL_OCR)).toBeNull();
    expect(sanitizeLabel(null, LABEL_OCR)).toBeNull();
  });

  it('treats a 0 g serving size as unknown', () => {
    expect(sanitizeLabel({ serving_size_g: 0 }, LABEL_OCR)?.serving_size_g).toBeNull();
  });

  it('skips native for empty OCR text', async () => {
    await expect(parseNutritionLabel('  ')).resolves.toBeNull();
    expect(native.parseNutritionLabel).not.toHaveBeenCalled();
  });

  describe('labelPer100g', () => {
    const perServing: NutritionLabel = {
      basis: 'per_serving',
      serving_size_g: 40,
      kcal: 150,
      protein_g: 5,
      carb_g: 27,
      fat_g: 2.5,
      fiber_g: null,
      sodium_mg: 0,
      confidence: 0.8,
    };

    it('scales per-serving values and keeps nulls null', () => {
      expect(labelPer100g(perServing)).toEqual({
        ...perServing,
        basis: 'per_100g',
        kcal: 375,
        protein_g: 12.5,
        carb_g: 67.5,
        fat_g: 6.3,
        fiber_g: null,
        sodium_mg: 0,
      });
    });

    it('is null without a serving size, unchanged when already per 100 g', () => {
      expect(labelPer100g({ ...perServing, serving_size_g: null })).toBeNull();
      const per100 = { ...perServing, basis: 'per_100g' as const };
      expect(labelPer100g(per100)).toBe(per100);
    });
  });
});

describe('receipt', () => {
  it('parses lines and computes grams from mass units', async () => {
    native.parseReceipt.mockResolvedValue(
      JSON.stringify([
        { name: 'Greek yogurt', quantity: 500, unit: 'g', grams_estimate: 450 },
        { name: 'Chicken breast', quantity: 1.5, unit: 'LB', grams_estimate: null },
        { name: 'Bananas', quantity: 6, unit: 'each', grams_estimate: 720 },
        { name: 'Eggs', quantity: 1, unit: 'pack', grams_estimate: null },
      ]),
    );
    await expect(parseReceipt('GRK YGRT 500G ...')).resolves.toEqual([
      { name: 'Greek yogurt', quantity: 500, unit: 'g', grams_estimate: 500 },
      { name: 'Chicken breast', quantity: 1.5, unit: 'lb', grams_estimate: 680 },
      { name: 'Bananas', quantity: 6, unit: 'each', grams_estimate: 720 },
      { name: 'Eggs', quantity: 1, unit: 'pack', grams_estimate: null },
    ]);
  });

  it('drops nameless lines and defaults a missing quantity or unit', () => {
    expect(
      sanitizeReceipt([
        { name: '  ', quantity: 1, unit: 'each' },
        null,
        { name: 'Oats', quantity: 0, unit: '', grams_estimate: 0 },
        { name: 'Milk', quantity: 'two', grams_estimate: -1 },
      ]),
    ).toEqual([
      { name: 'Oats', quantity: 1, unit: 'each', grams_estimate: null },
      { name: 'Milk', quantity: 1, unit: 'each', grams_estimate: null },
    ]);
    expect(sanitizeReceipt({ items: [] })).toBeNull();
  });
});
