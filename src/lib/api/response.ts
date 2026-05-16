import { NextResponse } from 'next/server';
import { buildStandardErrorBody } from './error';
import type { ServiceResult } from '@/interfaces/services/types';
import { getApiErrorCodeFromStatus, getDefaultApiErrorMessage } from './error-codes';

export function errorCodeFromStatus(status: number): string {
  return getApiErrorCodeFromStatus(status);
}

export function apiOk<T>(
  data: T,
  status = 200,
  extras?: {
    meta?: Record<string, unknown>;
    headers?: HeadersInit;
  },
): NextResponse {
  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(extras?.meta ? { meta: extras.meta } : {}),
    },
    {
      status,
      headers: extras?.headers,
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
  return NextResponse.json(buildStandardErrorBody({ code, message, detail, meta }), { status });
}

export function apiStatusErr(
  detail: string,
  status = 400,
  meta?: Record<string, unknown>,
): NextResponse {
  return apiErr(errorCodeFromStatus(status), detail, status, meta);
}

export function apiForward(payload: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(payload, { status });
}

export function apiServiceErr<T>(
  result: Pick<ServiceResult<T>, 'error' | 'statusCode'>,
  fallbackStatus = 400,
  meta?: Record<string, unknown>,
): NextResponse {
  return apiStatusErr(result.error ?? 'Request failed', result.statusCode || fallbackStatus, meta);
}
