import { env } from './env';
import { mockBarcodeService } from './barcode.mock';
import { createRealBarcodeService } from './barcode.real';
import type { BarcodeService } from './barcode.types';
import { supabase } from './supabase';

// The single seam between the scanner screen and wherever barcode lookups happen.
//
// Mock mode is the default (same EXPO_PUBLIC_USE_MOCKS rule as foods.ts): a few FAKE sample
// barcodes mapped to sample foods (barcode.mock.ts), and no network at all.
// Real mode (EXPO_PUBLIC_USE_MOCKS=0) calls the ML service's GET /barcode/{code} with the
// user's Supabase access token (barcode.real.ts). The app never calls Open Food Facts or any
// other URL directly; the server does that. Contract: docs/BACKEND_HANDOFF.md.

export {
  BARCODE_NOT_AVAILABLE_MESSAGE,
  BARCODE_SIGN_IN_AGAIN_MESSAGE,
  BARCODE_SIGN_IN_MESSAGE,
  BARCODE_UNAVAILABLE_MESSAGE,
  BarcodeLookupError,
  BarcodeNotAvailableError,
  type BarcodeService,
} from './barcode.types';

export function createBarcodeService(useMocks: boolean): BarcodeService {
  return useMocks
    ? mockBarcodeService
    : createRealBarcodeService({ auth: supabase.auth, baseUrl: env.mlUrl });
}

export const barcodeService: BarcodeService = createBarcodeService(env.useMocks);
