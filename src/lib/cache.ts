import { cache } from 'react';
import connectDB from '@/lib/mongoose';

/**
 * React.cache utilities for server-side deduplication
 *
 * React.cache automatically deduplicates requests made during a single render pass.
 * This means if the same cached function is called multiple times with the same args
 * during a server render, it will only execute once.
 *
 * Usage:
 * - Use these cached functions in Server Components
 * - They will automatically dedupe requests during SSR
 * - Cache is cleared between requests (per-request cache)
 *
 * @see https://react.dev/reference/react/cache
 */

/**
 * Cached database connection
 * Ensures we don't create multiple connections during a single render
 */
export const getDB = cache(async () => {
  await connectDB();
  return true;
});

/**
 * Generic cached fetch wrapper for external APIs
 * Deduplicates fetch requests with the same URL during a render
 */
export const cachedFetch = cache(async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
});

/**
 * Cached JSON fetcher for internal API routes
 * Use this for fetching from your own API routes during SSR
 */
export const cachedInternalFetch = cache(async <T>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = new URL(path, baseUrl);

  const response = await fetch(url.toString(), {
    ...options,
    cache: 'no-store', // Always fresh for internal API
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
});
