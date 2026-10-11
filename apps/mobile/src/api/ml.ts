import {
  gapCloserFixture,
  nextSetFixture,
  predictMealFixture,
  readinessFixture,
  receiptFixture,
  todayFixture,
} from '@/mocks';
import type {
  ApiErrorBody,
  GapCloserRequest,
  GapCloserResponse,
  NextSetQuery,
  NextSetResponse,
  PredictMealRequest,
  PredictMealResponse,
  ReadinessQuery,
  ReadinessResponse,
  ReceiptRequest,
  ReceiptResponse,
  TodayQuery,
  TodayResponse,
} from '@/types/api';

import { env } from './env';
import { supabase } from './supabase';

// Typed wrappers for the ML service routes.
// POST /recompute is deliberately absent: it needs the service key and is called by the
// nightly job, never by the app. A service key must never ship in the app bundle.

const MOCK_DELAY_MS = 300;

/** Non-2xx response from the ML service, or a request the app could not send. */
export class MlApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'MlApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions<T> = {
  method: 'GET' | 'POST';
  path: string;
  /** Query-string params; undefined values are dropped. */
  query?: object;
  body?: unknown;
  fixture: T;
};

async function request<T>({ method, path, query, body, fixture }: RequestOptions<T>): Promise<T> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return fixture;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new MlApiError(401, 'no_session', 'Not signed in.');
  }

  const response = await fetch(env.mlUrl + path + toQueryString(query), {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new MlApiError(
      response.status,
      error?.error?.code ?? 'http_error',
      error?.error?.message ?? `${method} ${path} failed with ${response.status}.`,
    );
  }
  return (await response.json()) as T;
}

function toQueryString(query: object = {}): string {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export const ml = {
  getToday: (query: TodayQuery = {}) =>
    request<TodayResponse>({ method: 'GET', path: '/today', query, fixture: todayFixture }),

  gapCloser: (body: GapCloserRequest) =>
    request<GapCloserResponse>({
      method: 'POST',
      path: '/gap-closer',
      body,
      fixture: gapCloserFixture,
    }),

  predictMeal: (body: PredictMealRequest) =>
    request<PredictMealResponse>({
      method: 'POST',
      path: '/predict-meal',
      body,
      fixture: predictMealFixture,
    }),

  getNextSet: (query: NextSetQuery) =>
    request<NextSetResponse>({ method: 'GET', path: '/next-set', query, fixture: nextSetFixture }),

  getReadiness: (query: ReadinessQuery = {}) =>
    request<ReadinessResponse>({
      method: 'GET',
      path: '/readiness',
      query,
      fixture: readinessFixture,
    }),

  parseReceipt: (body: ReceiptRequest) =>
    request<ReceiptResponse>({ method: 'POST', path: '/receipt', body, fixture: receiptFixture }),
};
