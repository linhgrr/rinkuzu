import type { NextResponse } from 'next/server';

import type { ServiceResult } from '@/interfaces/services/types';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export function imageUploadResponse<T>(result: ServiceResult<T>): NextResponse {
  if (
    !result.success &&
    result.statusCode === 500 &&
    result.error === 'Image upload not configured'
  ) {
    return apiErr('configuration_error', result.error, 500);
  }
  return result.success ? apiOk(result.data) : apiServiceErr(result);
}
