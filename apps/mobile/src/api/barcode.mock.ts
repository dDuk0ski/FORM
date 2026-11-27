import { isValidBarcode, toGtin14 } from '@/lib/barcode';
import { foodsFixture } from '@/mocks/foods';
import type { Food } from '@/types/food';

import type { BarcodeService } from './barcode.types';

// SAMPLE DATA for development only. These barcodes are FAKE: they all start with the GS1
// prefix 2, which GS1 reserves for in-store / restricted use and never assigns to a branded
// product, so none of them is a real product. Their check digits are valid so they pass the
// same validation as a real scan. Each points at a sample food that already exists in
// src/mocks/foods.ts (no new nutrition data). Any other code resolves to null (not found).
export const SAMPLE_BARCODES: Readonly<Record<string, string>> = {
  /** EAN-13 → Banana, raw */
  '2000000000015': 'f_0455',
  /** EAN-13 → Oats, rolled, dry */
  '2000000000022': 'f_0931',
  /** UPC-A → Greek yogurt, plain, nonfat */
  '200000000042': 'f_2041',
  /** EAN-8 → Whey protein powder */
  '20000004': 'f_7712',
};

/** A valid sample code that is deliberately not in SAMPLE_BARCODES, for "not found". */
export const SAMPLE_UNKNOWN_BARCODE = '2000000000992';

const MOCK_DELAY_MS = 300;

function delay(): Promise<void> {
  // No artificial latency under Jest.
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
}

// Keyed by GTIN-14 so a UPC-A matches the 13-digit form (leading 0) some cameras report.
const foodIdByGtin = new Map(
  Object.entries(SAMPLE_BARCODES).map(([code, foodId]) => [toGtin14(code), foodId]),
);

export const mockBarcodeService: BarcodeService = {
  async lookupBarcode(code: string): Promise<Food | null> {
    await delay();
    if (!isValidBarcode(code)) {
      return null;
    }
    const foodId = foodIdByGtin.get(toGtin14(code));
    return foodsFixture.find((food) => food.id === foodId) ?? null;
  },
};
