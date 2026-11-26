import { expandUpcE, isValidBarcode, normalizeBarcode } from '@/lib/barcode';

/** After a code is accepted, the same code is ignored for this long, even after release. */
export const SCAN_REPEAT_MS = 2000;

/**
 * Lets exactly one camera scan through. A camera reports the same barcode many times a
 * second, so after one is accepted every later scan is ignored until `release()` (the screen
 * is ready for another), and the same code stays ignored for SCAN_REPEAT_MS after it was
 * accepted. Synchronous, so two events in the same frame cannot both get through.
 */
export function createScanGuard(now: () => number = Date.now, repeatMs = SCAN_REPEAT_MS) {
  let locked = false;
  let last: { code: string; at: number } | null = null;
  return {
    accept(code: string): boolean {
      if (locked) {
        return false;
      }
      if (last && last.code === code && now() - last.at < repeatMs) {
        return false;
      }
      locked = true;
      last = { code, at: now() };
      return true;
    },
    release() {
      locked = false;
    },
  };
}

export type ScanGuard = ReturnType<typeof createScanGuard>;

/**
 * The code to look up for one camera result, or null to ignore it (a misread or a type we do
 * not support). UPC-E is expanded to its UPC-A first, because that is the number it encodes.
 */
export function codeFromScan(type: string, data: string): string | null {
  const code = normalizeBarcode(data);
  if (/upc_?e/i.test(type)) {
    const expanded = expandUpcE(code);
    if (expanded && isValidBarcode(expanded)) {
      return expanded;
    }
  }
  return isValidBarcode(code) ? code : null;
}
