import {
  BarcodeNotAvailableError,
  createBarcodeService,
  unavailableBarcodeService,
} from '@/api/barcode';
import { SAMPLE_BARCODES, SAMPLE_UNKNOWN_BARCODE, mockBarcodeService } from '@/api/barcode.mock';
import { isValidBarcode } from '@/lib/barcode';
import { foodsFixture } from '@/mocks/foods';

describe('mock barcode service', () => {
  it('only uses valid, clearly fake (GS1 prefix 2) sample codes for existing sample foods', () => {
    for (const [code, foodId] of Object.entries(SAMPLE_BARCODES)) {
      expect(isValidBarcode(code)).toBe(true);
      expect(code.startsWith('2')).toBe(true);
      expect(foodsFixture.some((food) => food.id === foodId)).toBe(true);
    }
    expect(isValidBarcode(SAMPLE_UNKNOWN_BARCODE)).toBe(true);
    expect(SAMPLE_BARCODES[SAMPLE_UNKNOWN_BARCODE]).toBeUndefined();
  });

  it('finds the sample food for each sample code', async () => {
    await expect(mockBarcodeService.lookupBarcode('2000000000015')).resolves.toMatchObject({
      id: 'f_0455',
    });
    await expect(mockBarcodeService.lookupBarcode('20000004')).resolves.toMatchObject({
      id: 'f_7712',
    });
  });

  it('matches a UPC-A reported in its 13-digit form', async () => {
    await expect(mockBarcodeService.lookupBarcode('0200000000042')).resolves.toMatchObject({
      id: 'f_2041',
    });
  });

  it('resolves to null for an unknown or invalid code', async () => {
    await expect(mockBarcodeService.lookupBarcode(SAMPLE_UNKNOWN_BARCODE)).resolves.toBeNull();
    await expect(mockBarcodeService.lookupBarcode('abc')).resolves.toBeNull();
  });
});

describe('barcode service switch', () => {
  it('uses the mock service in mock mode', () => {
    expect(createBarcodeService(true)).toBe(mockBarcodeService);
  });

  it('rejects with BarcodeNotAvailableError in real mode, without any network call', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = createBarcodeService(false);
    expect(service).toBe(unavailableBarcodeService);

    const lookup = service.lookupBarcode('2000000000015');
    await expect(lookup).rejects.toBeInstanceOf(BarcodeNotAvailableError);
    await expect(lookup).rejects.toThrow('Barcode lookup is not connected to the server yet.');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('defaults to mock mode when EXPO_PUBLIC_USE_MOCKS is unset', () => {
    jest.isolateModules(() => {
      const original = process.env.EXPO_PUBLIC_USE_MOCKS;
      delete process.env.EXPO_PUBLIC_USE_MOCKS;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/api/barcode') as typeof import('@/api/barcode');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mock = require('@/api/barcode.mock') as typeof import('@/api/barcode.mock');
      expect(fresh.barcodeService).toBe(mock.mockBarcodeService);
      if (original !== undefined) {
        process.env.EXPO_PUBLIC_USE_MOCKS = original;
      }
    });
  });

  it('uses the unavailable service when EXPO_PUBLIC_USE_MOCKS=0', () => {
    jest.isolateModules(() => {
      const original = process.env.EXPO_PUBLIC_USE_MOCKS;
      process.env.EXPO_PUBLIC_USE_MOCKS = '0';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fresh = require('@/api/barcode') as typeof import('@/api/barcode');
        expect(fresh.barcodeService).toBe(fresh.unavailableBarcodeService);
      } finally {
        if (original === undefined) {
          delete process.env.EXPO_PUBLIC_USE_MOCKS;
        } else {
          process.env.EXPO_PUBLIC_USE_MOCKS = original;
        }
      }
    });
  });
});
