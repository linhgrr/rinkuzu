import type { ApiResponseError } from './client';

type ApiErrorListener = (error: ApiResponseError) => void;

const listeners = new Set<ApiErrorListener>();

/** Publishes client-side API failures without coupling transports to React UI. */
export function reportApiError(error: ApiResponseError): void {
  if (typeof window === 'undefined') return;
  listeners.forEach((listener) => listener(error));
}

export function subscribeToApiErrors(listener: ApiErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
