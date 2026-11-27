import type { Food } from '@/types/food';

/** Everything the scanner screen needs from a barcode data source. */
export interface BarcodeService {
  /**
   * The food for a valid EAN-8 / UPC-A / EAN-13 code. Resolves to null when the code is not
   * known; rejects only on failure.
   */
  lookupBarcode(code: string): Promise<Food | null>;
}

// Every message below is safe to show to the user as is. Raw server text never reaches the UI.

/** Default message of BarcodeNotAvailableError. */
export const BARCODE_NOT_AVAILABLE_MESSAGE = 'Barcode lookup is not connected to the server yet.';
/** Real mode with no Supabase session: the server needs a signed-in user. */
export const BARCODE_SIGN_IN_MESSAGE = 'Sign in to look up barcodes.';
/** The server rejected the access token (401). */
export const BARCODE_SIGN_IN_AGAIN_MESSAGE = 'Sign in again to look up barcodes.';
/** Server error (500, 502, anything unexpected), network failure or timeout. */
export const BARCODE_UNAVAILABLE_MESSAGE =
  'Barcode lookup is unavailable right now. Try again, or search by name.';

/**
 * Barcode lookup cannot run for this user right now (real mode with no session). The
 * message is safe to show to the user.
 */
export class BarcodeNotAvailableError extends Error {
  readonly code = 'barcode_not_available';

  constructor(message: string = BARCODE_NOT_AVAILABLE_MESSAGE) {
    super(message);
    this.name = 'BarcodeNotAvailableError';
  }
}

export type BarcodeLookupErrorCode = 'unauthorized' | 'unavailable';

/** The server lookup failed. The message is safe to show to the user. */
export class BarcodeLookupError extends Error {
  readonly code: BarcodeLookupErrorCode;
  /** HTTP status when the server answered; null for network failures and timeouts. */
  readonly status: number | null;

  constructor(code: BarcodeLookupErrorCode, status: number | null) {
    super(code === 'unauthorized' ? BARCODE_SIGN_IN_AGAIN_MESSAGE : BARCODE_UNAVAILABLE_MESSAGE);
    this.name = 'BarcodeLookupError';
    this.code = code;
    this.status = status;
  }
}
