import type { IsoDate, IsoDateTime } from '@/types/api';

/** The user's local calendar day as "YYYY-MM-DD" (what GET /today defaults to). */
export function todayLocal(now: Date = new Date()): IsoDate {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Current instant as an ISO 8601 UTC string. */
export function nowUtcIso(now: Date = new Date()): IsoDateTime {
  return now.toISOString();
}

/** The user's local calendar day that an ISO 8601 UTC timestamp falls on. */
export function localDateOf(isoUtc: IsoDateTime): IsoDate {
  return todayLocal(new Date(isoUtc));
}

/**
 * The UTC instants that bound one local calendar day: from local midnight (inclusive) to
 * the next local midnight (exclusive). A real food_logs query filters `logged_at` between
 * these two values, because food_logs has no date column.
 *
 * The day is the one on THIS DEVICE. Whether the app should use profiles.timezone instead
 * is an open team question (see docs/BACKEND_HANDOFF.md).
 */
export function localDayRangeUtc(date: IsoDate): { start: IsoDateTime; end: IsoDateTime } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return {
    start: new Date(year, month - 1, day).toISOString(),
    end: new Date(year, month - 1, day + 1).toISOString(),
  };
}
