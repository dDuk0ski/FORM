import type { SupabaseClient } from '@supabase/supabase-js';

import { toEan13 } from '@/lib/barcode';
import type { Food, FoodMacros, NutrientValue, ServingOption } from '@/types/food';

import {
  BARCODE_SIGN_IN_MESSAGE,
  BarcodeLookupError,
  BarcodeNotAvailableError,
  type BarcodeService,
} from './barcode.types';

// Real-mode barcode lookup: GET {EXPO_PUBLIC_ML_URL}/barcode/{code} with the user's Supabase
// access token. The server checks its foods cache and, on a miss, asks Open Food Facts and
// saves the product. The app only ever calls the ML service URL, never Open Food Facts.
// Contract: docs/BACKEND_HANDOFF.md ("Barcode lookup"). Not used unless EXPO_PUBLIC_USE_MOCKS=0.

/** Long enough for a cache miss (the server allows Open Food Facts 10 s), short enough to retry. */
export const BARCODE_TIMEOUT_MS = 15_000;

type Numeric = number | string | null | undefined;

/** The part of the 200 body the app reads. Other `food` columns are ignored. */
interface BarcodeResponse {
  food?: {
    id?: unknown;
    name?: unknown;
    brand?: unknown;
    serving_g?: Numeric;
    serving_label?: unknown;
  } | null;
  macros?: {
    kcal_per_100g?: Numeric;
    protein_g_per_100g?: Numeric;
    carb_g_per_100g?: Numeric;
    fat_g_per_100g?: Numeric;
  } | null;
  cached?: boolean;
}

export interface RealBarcodeServiceOptions {
  /** Supabase auth, for the access token. Tests pass a fake. */
  auth: Pick<SupabaseClient['auth'], 'getSession'>;
  /** ML service base URL without a trailing slash (env.mlUrl). */
  baseUrl: string;
  /** Defaults to the global fetch, read at call time. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * A number, or null for unknown. Numeric strings parse (Postgres DECIMAL arrives as a
 * string). Missing, non-numeric, non-finite and negative values are unknown, never 0.
 */
function toAmount(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toMacros(macros: BarcodeResponse['macros']): FoodMacros {
  const value = (v: Numeric): NutrientValue => (macros ? toAmount(v) : null);
  return {
    kcal: value(macros?.kcal_per_100g),
    protein_g: value(macros?.protein_g_per_100g),
    carb_g: value(macros?.carb_g_per_100g),
    fat_g: value(macros?.fat_g_per_100g),
  };
}

function formatGrams(grams: number): string {
  return String(Math.round(grams * 10) / 10);
}

function toServings(servingGrams: Numeric): ServingOption[] {
  const grams = toAmount(servingGrams);
  if (grams === null || grams <= 0) {
    // No per-serving amount: the UI falls back to 100 g / custom grams, as for search results.
    return [];
  }
  return [{ id: 'default', label: `1 serving (${formatGrams(grams)} g)`, grams }];
}

/** The 200 body as a Food, or null when it is not a usable food (treated as a failure). */
export function toBarcodeFood(body: unknown): Food | null {
  const { food, macros } = (body ?? {}) as BarcodeResponse;
  if (!food || typeof food.name !== 'string' || food.name.trim() === '') {
    return null;
  }
  if (typeof food.id !== 'string' && typeof food.id !== 'number') {
    return null;
  }
  return {
    id: String(food.id),
    name: food.name,
    brand: typeof food.brand === 'string' && food.brand.trim() !== '' ? food.brand : null,
    macros_per_100g: toMacros(macros),
    // food.serving_label is deliberately ignored. The server currently fills it from the
    // product's package size (for example "400 g") while serving_g is the per-serving amount,
    // so the two disagree. The label is built from serving_g instead.
    servings: toServings(food.serving_g),
  };
}

export function createRealBarcodeService({
  auth,
  baseUrl,
  fetchFn,
  timeoutMs = BARCODE_TIMEOUT_MS,
}: RealBarcodeServiceOptions): BarcodeService {
  return {
    async lookupBarcode(code: string): Promise<Food | null> {
      let token: string | undefined;
      try {
        const { data } = await auth.getSession();
        token = data.session?.access_token;
      } catch {
        token = undefined;
      }
      if (!token) {
        throw new BarcodeNotAvailableError(BARCODE_SIGN_IN_MESSAGE);
      }

      const url = `${baseUrl}/barcode/${encodeURIComponent(toEan13(code))}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await (fetchFn ?? fetch)(url, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } catch {
        // Network failure or timeout (abort). Never surface the raw error.
        throw new BarcodeLookupError('unavailable', null);
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 404 || response.status === 400) {
        // 404: product not found. 400: not a code the server accepts. The screen shows
        // "We couldn't find that product" for both.
        return null;
      }
      if (response.status === 401) {
        throw new BarcodeLookupError('unauthorized', 401);
      }
      if (!response.ok) {
        throw new BarcodeLookupError('unavailable', response.status);
      }

      const body: unknown = await response.json().catch(() => null);
      const food = toBarcodeFood(body);
      if (!food) {
        throw new BarcodeLookupError('unavailable', response.status);
      }
      return food;
    },
  };
}
