import { NextResponse } from 'next/server';
import type { StandardApiEnvelope } from '@/lib/api/envelope';
import { buildStandardErrorBody } from './error';
import { getApiErrorCodeFromStatus, getDefaultApiErrorMessage } from './error-codes';

export interface ApiOkExtras {
  meta?: Record<string, unknown>;
  headers?: HeadersInit;
}

export interface ServiceErrorResult {
  success: false;
  error: string;
  statusCode: number;
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
  return apiStatusErr(result.error, result.statusCode, meta);
}
