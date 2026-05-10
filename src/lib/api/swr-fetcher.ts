import { fetchApiSuccess } from '@/lib/api/client';

/**
 * Generic SWR fetcher that uses the existing fetchApiSuccess helper.
 * Returns the full response object on success.
 */
export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  const result = await fetchApiSuccess<T>(url);
  return result as unknown as T;
}

/**
 * SWR fetcher that extracts only the `.data` field from the response.
 * Use when you don't need extras like pagination metadata.
 */
export async function swrDataFetcher<T = unknown>(url: string): Promise<T> {
  const result = await fetchApiSuccess<T>(url);
  return result.data;
}
