export type StandardSuccessEnvelope<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
> = {
  success: true;
  data: T;
  meta?: Meta | null;
};

export interface StandardErrorEnvelope {
  success: false;
  error: {
    code?: string;
    message?: string;
    detail?: string;
    meta?: unknown;
  };
}

export type StandardApiEnvelope<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
> = StandardSuccessEnvelope<T, Meta> | StandardErrorEnvelope;

export function isRecord(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload);
}

export function isStandardSuccessEnvelope<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
>(payload: unknown): payload is StandardSuccessEnvelope<T, Meta> {
  return isRecord(payload) && payload['success'] === true && 'data' in payload;
}

export function isStandardErrorEnvelope(payload: unknown): payload is StandardErrorEnvelope {
  return isRecord(payload) && payload['success'] === false && isRecord(payload['error']);
}
