import {
  expandUpcE,
  gs1CheckDigit,
  isValidBarcode,
  normalizeBarcode,
  parseBarcode,
  toGtin14,
} from '@/lib/barcode';

// Published GS1 examples with known-good check digits.
const EAN13 = '4006381333931';
const UPCA = '036000291452';
const EAN8 = '96385074';

describe('normalizeBarcode', () => {
  it('trims and removes spaces and hyphens', () => {
    expect(normalizeBarcode('  0 36000-29145 2 ')).toBe(UPCA);
  });

  it('keeps leading zeros', () => {
    expect(normalizeBarcode('000000000017')).toBe('000000000017');
  });

  it('leaves letters in place so validation can reject them', () => {
    expect(normalizeBarcode('40063813339a1')).toBe('40063813339a1');
  });
});

describe('gs1CheckDigit', () => {
  it('computes the check digit for each supported length', () => {
    expect(gs1CheckDigit(EAN13.slice(0, -1))).toBe(1);
    expect(gs1CheckDigit(UPCA.slice(0, -1))).toBe(2);
    expect(gs1CheckDigit(EAN8.slice(0, -1))).toBe(4);
  });
});

describe('isValidBarcode', () => {
  it('accepts EAN-13, UPC-A and EAN-8 with correct check digits', () => {
    expect(isValidBarcode(EAN13)).toBe(true);
    expect(isValidBarcode(UPCA)).toBe(true);
    expect(isValidBarcode(EAN8)).toBe(true);
  });

  it('accepts a code with leading zeros', () => {
    expect(isValidBarcode('000000000017')).toBe(true);
  });

  it('rejects a bad check digit', () => {
    expect(isValidBarcode('4006381333932')).toBe(false);
    expect(isValidBarcode('036000291453')).toBe(false);
    expect(isValidBarcode('96385075')).toBe(false);
  });

  it('rejects wrong lengths', () => {
    expect(isValidBarcode('')).toBe(false);
    expect(isValidBarcode('1234567')).toBe(false);
    expect(isValidBarcode('12345678901')).toBe(false);
    expect(isValidBarcode('12345678901234')).toBe(false);
  });

  it('rejects letters and symbols', () => {
    expect(isValidBarcode('40063813339a1')).toBe(false);
    expect(isValidBarcode('4006381-33931')).toBe(false);
  });
});

describe('toGtin14', () => {
  it('makes a UPC-A and its 13-digit form compare equal', () => {
    expect(toGtin14(UPCA)).toBe(toGtin14(`0${UPCA}`));
    expect(toGtin14(EAN8)).toBe('00000096385074');
  });
});

describe('expandUpcE', () => {
  it('expands a UPC-E to a valid UPC-A', () => {
    expect(expandUpcE('01234565')).toBe('012345000065');
    expect(isValidBarcode('012345000065')).toBe(true);
  });

  it('returns null for anything that is not a UPC-E', () => {
    expect(expandUpcE('21234565')).toBeNull();
    expect(expandUpcE('0123456')).toBeNull();
    expect(expandUpcE('0123456a')).toBeNull();
  });
});

describe('parseBarcode', () => {
  it('returns the normalized code when valid', () => {
    expect(parseBarcode(' 0360-0029-1452 ')).toEqual({ ok: true, code: UPCA });
  });

  it('explains each kind of invalid input', () => {
    expect(parseBarcode('   ')).toEqual({ ok: false, error: 'Enter a barcode.' });
    expect(parseBarcode('abc')).toEqual({ ok: false, error: 'Use digits only.' });
    expect(parseBarcode('12345')).toEqual({
      ok: false,
      error: 'A barcode has 8, 12 or 13 digits.',
    });
    expect(parseBarcode('4006381333932')).toEqual({
      ok: false,
      error: 'That barcode isn’t valid. Check the digits and try again.',
    });
  });
});
