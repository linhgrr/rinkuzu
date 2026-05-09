import { NextResponse } from 'next/server';
import { buildStandardErrorBody } from './error';

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true as const, data }, { status });
}

export function apiErr(
  code: string,
  detail: string,
  status = 400,
  extras?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(buildStandardErrorBody(code, detail, extras), { status });
}
