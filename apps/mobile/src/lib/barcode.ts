// Pure barcode helpers. No React, no I/O.
//
// Supported: EAN-8 (8 digits), UPC-A (12) and EAN-13 (13), each ending in a GS1 check
// digit. UPC-E (the 8-digit short form of UPC-A) is handled by expanding it to UPC-A first,
// because its check digit is the UPC-A one. Leading zeros are significant and always kept.

export const BARCODE_LENGTHS = [8, 12, 13] as const;

/** Trim, and drop the spaces and hyphens people type between digit groups. */
export function normalizeBarcode(input: string): string {
  return input.trim().replace(/[\s-]+/g, '');
}

/** The GS1 check digit for `body` (every digit except the last). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  // Weights alternate 3, 1, 3, … starting from the rightmost digit of the body.
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += index % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** True for an EAN-8, UPC-A or EAN-13 made of digits only, with a correct check digit. */
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code)) {
    return false;
  }
  if (!(BARCODE_LENGTHS as readonly number[]).includes(code.length)) {
    return false;
  }
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * The same product as a 14-digit GTIN (left-padded with zeros), so a UPC-A and the EAN-13
 * a camera may report for it (with a leading 0) compare equal.
 */
export function toGtin14(code: string): string {
  return code.padStart(14, '0');
}

/**
 * Expand an 8-digit UPC-E (number system 0 or 1) to its 12-digit UPC-A. Returns null for
 * anything that is not a UPC-E. The result still needs isValidBarcode.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) {
    return null;
  }
  const system = code[0]!;
  const d = code.slice(1, 7);
  const check = code[7]!;
  const last = d[5]!;
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  } else if (last === '3') {
    body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  } else if (last === '4') {
    body = `${d.slice(0, 4)}00000${d[4]}`;
  } else {
    body = `${d.slice(0, 5)}0000${last}`;
  }
  return `${system}${body}${check}`;
}

export type BarcodeResult = { ok: true; code: string } | { ok: false; error: string };

/** Validate what the user typed into the barcode field, with a message safe to show. */
export function parseBarcode(input: string): BarcodeResult {
  const code = normalizeBarcode(input);
  if (code === '') {
    return { ok: false, error: 'Enter a barcode.' };
  }
  if (!/^\d+$/.test(code)) {
    return { ok: false, error: 'Use digits only.' };
  }
  if (!(BARCODE_LENGTHS as readonly number[]).includes(code.length)) {
    return { ok: false, error: 'A barcode has 8, 12 or 13 digits.' };
  }
  if (!isValidBarcode(code)) {
    return { ok: false, error: 'That barcode isn’t valid. Check the digits and try again.' };
  }
  return { ok: true, code };
}
