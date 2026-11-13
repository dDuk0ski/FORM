import { localDateOf, localDayRangeUtc, nowUtcIso, todayLocal } from '@/lib/dates';

describe('dates', () => {
  it('formats the local calendar day', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('returns the current instant as ISO 8601 UTC', () => {
    expect(nowUtcIso(new Date(Date.UTC(2026, 9, 16, 12, 0, 0)))).toBe('2026-10-16T12:00:00.000Z');
  });

  it('finds the local day an instant falls on', () => {
    expect(localDateOf(new Date(2026, 9, 16, 0, 0, 1).toISOString())).toBe('2026-10-16');
    expect(localDateOf(new Date(2026, 9, 16, 23, 59, 59).toISOString())).toBe('2026-10-16');
    expect(localDateOf(new Date(2026, 9, 17, 0, 0, 0).toISOString())).toBe('2026-10-17');
  });

  it('bounds a local day from midnight (inclusive) to the next midnight (exclusive)', () => {
    const { start, end } = localDayRangeUtc('2026-10-16');
    expect(start).toBe(new Date(2026, 9, 16).toISOString());
    expect(end).toBe(new Date(2026, 9, 17).toISOString());
    expect(localDateOf(start)).toBe('2026-10-16');
    expect(localDateOf(end)).toBe('2026-10-17');
  });

  it('handles month and year boundaries', () => {
    expect(localDayRangeUtc('2026-12-31').end).toBe(new Date(2027, 0, 1).toISOString());
    expect(localDayRangeUtc('2026-02-28').end).toBe(new Date(2026, 2, 1).toISOString());
  });
});
