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
