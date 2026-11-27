import type { Food } from '@/types/food';

/** Everything the scanner screen needs from a barcode data source. */
export interface BarcodeService {
  /**
   * The food for a valid EAN-8 / UPC-A / EAN-13 code. Resolves to null when the code is not
   * known; rejects only on failure.
   */
  lookupBarcode(code: string): Promise<Food | null>;
}

export const BARCODE_NOT_AVAILABLE_MESSAGE = 'Barcode lookup is not connected to the server yet.';

/**
 * Thrown by the real-mode service until the server lookup exists. The message is safe to
 * show to the user.
 */
export class BarcodeNotAvailableError extends Error {
  readonly code = 'barcode_not_available';

  constructor() {
    super(BARCODE_NOT_AVAILABLE_MESSAGE);
    this.name = 'BarcodeNotAvailableError';
  }
}
