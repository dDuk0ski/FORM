import {
  BARCODE_SIGN_IN_AGAIN_MESSAGE,
  BARCODE_SIGN_IN_MESSAGE,
  BARCODE_UNAVAILABLE_MESSAGE,
  BarcodeLookupError,
  BarcodeNotAvailableError,
  createBarcodeService,
} from '@/api/barcode';
import { mockBarcodeService } from '@/api/barcode.mock';
import { BARCODE_TIMEOUT_MS, createRealBarcodeService } from '@/api/barcode.real';
import { env } from '@/api/env';
import { supabase } from '@/api/supabase';

// FAKE sample values throughout. None of these numbers, names or codes describe a real
// product. Codes use the GS1 prefix 2 (in-store use only, never a branded product).
const EAN13 = '2000000000015';
const UPCA = '200000000042';
const EAN8 = '20000004';
const BASE_URL = 'https://ml.example.test';
const TOKEN = 'fake-access-token';

const FULL_BODY = {
  food: {
    id: 'food-uuid-1',
    name: 'Sample crunchy cereal',
    brand: 'Sample Brand',
    serving_g: 30,
    serving_label: '400 g',
    barcode: EAN13,
    source: 'open_food_facts',
    data_tier: 'community',
  },
  macros: {
    kcal_per_100g: 111,
    protein_g_per_100g: 22,
    carb_g_per_100g: 33,
    fat_g_per_100g: 4.4,
  },
  cached: false,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function fakeAuth(token: string | null) {
  return {
    getSession: jest.fn().mockResolvedValue({
      data: { session: token ? { access_token: token } : null },
      error: null,
    }),
  } as unknown as Parameters<typeof createRealBarcodeService>[0]['auth'];
}

function setup(response: Response | Promise<Response>, token: string | null = TOKEN) {
  const fetchFn = jest.fn().mockReturnValue(Promise.resolve(response));
  const service = createRealBarcodeService({
    auth: fakeAuth(token),
    baseUrl: BASE_URL,
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  return { service, fetchFn };
}

function withBody(overrides: { food?: object; macros?: object | null }) {
  return {
    ...FULL_BODY,
    food: { ...FULL_BODY.food, ...overrides.food },
    macros: overrides.macros === null ? null : { ...FULL_BODY.macros, ...overrides.macros },
  };
}

describe('real barcode service: mapping', () => {
  it('maps a full response to a Food', async () => {
    const { service } = setup(jsonResponse(200, FULL_BODY));
    await expect(service.lookupBarcode(EAN13)).resolves.toEqual({
      id: 'food-uuid-1',
      name: 'Sample crunchy cereal',
      brand: 'Sample Brand',
      macros_per_100g: { kcal: 111, protein_g: 22, carb_g: 33, fat_g: 4.4 },
      servings: [{ id: 'default', label: '1 serving (30 g)', grams: 30 }],
    });
  });

  it('treats macros: null as all four unknown', async () => {
    const { service } = setup(jsonResponse(200, withBody({ macros: null })));
    const food = await service.lookupBarcode(EAN13);
    expect(food?.macros_per_100g).toEqual({
      kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    });
  });

  it('parses numeric strings', async () => {
    const body = withBody({
      food: { serving_g: '30.0' },
      macros: {
        kcal_per_100g: '111',
        protein_g_per_100g: '22.5',
        carb_g_per_100g: '33',
        fat_g_per_100g: '0',
      },
    });
    const { service } = setup(jsonResponse(200, body));
    const food = await service.lookupBarcode(EAN13);
    expect(food?.macros_per_100g).toEqual({ kcal: 111, protein_g: 22.5, carb_g: 33, fat_g: 0 });
    expect(food?.servings).toEqual([{ id: 'default', label: '1 serving (30 g)', grams: 30 }]);
  });

  it('keeps a single null macro null, not 0', async () => {
    const { service } = setup(jsonResponse(200, withBody({ macros: { fat_g_per_100g: null } })));
    const food = await service.lookupBarcode(EAN13);
    expect(food?.macros_per_100g).toEqual({ kcal: 111, protein_g: 22, carb_g: 33, fat_g: null });
  });

  it('treats non-numeric, non-finite and negative values as unknown', async () => {
    const body = withBody({
      macros: {
        kcal_per_100g: 'abc',
        protein_g_per_100g: -1,
        carb_g_per_100g: 'Infinity',
        fat_g_per_100g: '',
      },
    });
    const { service } = setup(jsonResponse(200, body));
    const food = await service.lookupBarcode(EAN13);
    expect(food?.macros_per_100g).toEqual({
      kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    });
  });

  it('builds the serving label from serving_g and ignores the server serving_label', async () => {
    const { service } = setup(jsonResponse(200, withBody({ food: { serving_g: 27.5 } })));
    const food = await service.lookupBarcode(EAN13);
    expect(food?.servings).toEqual([{ id: 'default', label: '1 serving (27.5 g)', grams: 27.5 }]);
    expect(JSON.stringify(food)).not.toContain('400 g');
  });

  it('has no servings when serving_g is null or not positive', async () => {
    for (const serving_g of [null, 0, -5]) {
      const { service } = setup(jsonResponse(200, withBody({ food: { serving_g } })));
      const food = await service.lookupBarcode(EAN13);
      expect(food?.servings).toEqual([]);
    }
  });

  it('maps a missing or empty brand to null', async () => {
    const { service } = setup(jsonResponse(200, withBody({ food: { brand: null } })));
    await expect(service.lookupBarcode(EAN13)).resolves.toMatchObject({ brand: null });
  });

  it('rejects with the unavailable message for a 200 body without a usable food', async () => {
    const { service } = setup(jsonResponse(200, { food: null, macros: null, cached: false }));
    await expect(service.lookupBarcode(EAN13)).rejects.toThrow(BARCODE_UNAVAILABLE_MESSAGE);
  });
});

describe('real barcode service: request', () => {
  it('sends a 12-digit UPC-A with a leading 0', async () => {
    const { service, fetchFn } = setup(jsonResponse(200, FULL_BODY));
    await service.lookupBarcode(UPCA);
    expect(fetchFn.mock.calls[0][0]).toBe(`${BASE_URL}/barcode/0${UPCA}`);
  });

  it('sends EAN-13 and EAN-8 as they are', async () => {
    const { service, fetchFn } = setup(jsonResponse(200, FULL_BODY));
    await service.lookupBarcode(EAN13);
    await service.lookupBarcode(EAN8);
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      `${BASE_URL}/barcode/${EAN13}`,
      `${BASE_URL}/barcode/${EAN8}`,
    ]);
  });

  it('encodes the code in the path', async () => {
    const { service, fetchFn } = setup(jsonResponse(404, { detail: 'Product not found.' }));
    await service.lookupBarcode('12/34');
    expect(fetchFn.mock.calls[0][0]).toBe(`${BASE_URL}/barcode/12%2F34`);
  });

  it('calls only env.mlUrl, with the Supabase access token as a Bearer header', async () => {
    jest.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: TOKEN } },
      error: null,
    } as never);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, FULL_BODY));
    try {
      await createBarcodeService(false).lookupBarcode(EAN13);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe(`${env.mlUrl}/barcode/${EAN13}`);
      expect(String(url).startsWith(`${env.mlUrl}/`)).toBe(true);
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('rejects with "Sign in to look up barcodes." and never calls fetch without a session', async () => {
    const { service, fetchFn } = setup(jsonResponse(200, FULL_BODY), null);
    const lookup = service.lookupBarcode(EAN13);
    await expect(lookup).rejects.toBeInstanceOf(BarcodeNotAvailableError);
    await expect(lookup).rejects.toThrow(BARCODE_SIGN_IN_MESSAGE);
    expect(BARCODE_SIGN_IN_MESSAGE).toBe('Sign in to look up barcodes.');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('real barcode service: statuses and failures', () => {
  it.each([404, 400])('resolves to null for %i', async (status) => {
    const { service } = setup(jsonResponse(status, { detail: 'Product not found.' }));
    await expect(service.lookupBarcode(EAN13)).resolves.toBeNull();
  });

  it('rejects 401 with "Sign in again to look up barcodes."', async () => {
    const { service } = setup(jsonResponse(401, { detail: 'Invalid authentication token' }));
    const lookup = service.lookupBarcode(EAN13);
    await expect(lookup).rejects.toBeInstanceOf(BarcodeLookupError);
    await expect(lookup).rejects.toThrow(BARCODE_SIGN_IN_AGAIN_MESSAGE);
    expect(BARCODE_SIGN_IN_AGAIN_MESSAGE).toBe('Sign in again to look up barcodes.');
  });

  it.each([502, 500, 503])('rejects %i with the user-safe unavailable message', async (status) => {
    const detail = `SECRET_SERVER_DETAIL ${status}`;
    const { service } = setup(jsonResponse(status, { detail }));
    const error = await service.lookupBarcode(EAN13).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BarcodeLookupError);
    expect((error as Error).message).toBe(
      'Barcode lookup is unavailable right now. Try again, or search by name.',
    );
    expect((error as Error).message).not.toContain('SECRET_SERVER_DETAIL');
  });

  it('rejects a network failure with the unavailable message, not the raw error', async () => {
    const { service } = setup(Promise.reject(new TypeError('Network request failed at 10.0.0.1')));
    const error = await service.lookupBarcode(EAN13).catch((e: unknown) => e);
    expect((error as Error).message).toBe(BARCODE_UNAVAILABLE_MESSAGE);
    expect((error as Error).message).not.toContain('10.0.0.1');
  });

  it('times out after 15 s and rejects with the unavailable message', async () => {
    jest.useFakeTimers();
    try {
      const fetchFn = jest.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          }),
      );
      const service = createRealBarcodeService({
        auth: fakeAuth(TOKEN),
        baseUrl: BASE_URL,
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      const settled = jest.fn();
      const lookup = service.lookupBarcode(EAN13).catch((e: unknown) => {
        settled();
        return e;
      });

      await jest.advanceTimersByTimeAsync(BARCODE_TIMEOUT_MS - 1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(settled).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      const error = await lookup;
      expect(BARCODE_TIMEOUT_MS).toBe(15_000);
      expect(error).toBeInstanceOf(BarcodeLookupError);
      expect((error as Error).message).toBe(BARCODE_UNAVAILABLE_MESSAGE);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('mock mode', () => {
  it('never calls fetch', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = createBarcodeService(true);
    expect(service).toBe(mockBarcodeService);
    await service.lookupBarcode(EAN13);
    await service.lookupBarcode(UPCA);
    await service.lookupBarcode('2000000000992');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
