import { env } from './env';
import { mockBarcodeService } from './barcode.mock';
import { BarcodeNotAvailableError, type BarcodeService } from './barcode.types';

// The single seam between the scanner screen and wherever barcode lookups happen.
//
// Mock mode is the default (same EXPO_PUBLIC_USE_MOCKS rule as foods.ts): a few FAKE sample
// barcodes mapped to sample foods (barcode.mock.ts). Real mode is NOT connected: there is no
// server barcode route yet and no agreed contract, so it rejects with
// BarcodeNotAvailableError. The app never calls Open Food Facts or any other URL directly;
// when the server endpoint is agreed, implement it here and nothing in src/app or
// src/components needs to change. See docs/BACKEND_HANDOFF.md.

export {
  BARCODE_NOT_AVAILABLE_MESSAGE,
  BarcodeNotAvailableError,
  type BarcodeService,
} from './barcode.types';

/** Real mode until the server lookup exists: always rejects, never touches the network. */
export const unavailableBarcodeService: BarcodeService = {
  lookupBarcode: () => Promise.reject(new BarcodeNotAvailableError()),
};

export function createBarcodeService(useMocks: boolean): BarcodeService {
  return useMocks ? mockBarcodeService : unavailableBarcodeService;
}

export const barcodeService: BarcodeService = createBarcodeService(env.useMocks);
