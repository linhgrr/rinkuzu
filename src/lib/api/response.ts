import { NextResponse } from 'next/server';
import type { StandardApiEnvelope } from '@/lib/api/envelope';
import { buildStandardErrorBody } from './error';
import { getApiErrorCodeFromStatus, getDefaultApiErrorMessage } from './error-codes';

const PRIVATE_ERROR_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
} as const;

export interface ApiOkExtras {
  meta?: Record<string, unknown>;
  headers?: HeadersInit;
}

export interface ServiceErrorResult {
  success: false;
  error: string;
  statusCode: number;
  code?: string;
}

function errorCodeFromStatus(status: number): string {
  return getApiErrorCodeFromStatus(status);
}

export function apiOk<T>(data: T, status = 200, extras?: ApiOkExtras): NextResponse {
  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(extras?.meta ? { meta: extras.meta } : {}),
    },
    {
      status,
      ...(extras?.headers !== undefined ? { headers: extras.headers } : {}),
    },
  );
}

export function apiErr(
  code: string,
  detail: string,
  status = 400,
  meta?: Record<string, unknown>,
  message: string = getDefaultApiErrorMessage(code),
): NextResponse {
  return NextResponse.json(
    buildStandardErrorBody({
      code,
      message,
      detail,
      ...(meta !== undefined ? { meta } : {}),
    }),
    { status, headers: PRIVATE_ERROR_HEADERS },
  );
}

function apiStatusErr(detail: string, status = 400, meta?: Record<string, unknown>): NextResponse {
  return apiErr(errorCodeFromStatus(status), detail, status, meta);
}

export function apiForward(payload: StandardApiEnvelope<unknown>, status: number): NextResponse {
  return NextResponse.json(payload, { status });
}

export function apiServiceErr(
  result: ServiceErrorResult,
  meta?: Record<string, unknown>,
): NextResponse {
  if (result.code) {
    return apiErr(result.code, result.error, result.statusCode, meta);
  }
  return apiStatusErr(result.error, result.statusCode, meta);
}
