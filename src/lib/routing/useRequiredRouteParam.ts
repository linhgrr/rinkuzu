'use client';

import { useParams } from 'next/navigation';
import { readRequiredRouteParam } from './routeParams';

export function useRequiredRouteParam(key: string): string {
  return readRequiredRouteParam(useParams(), key);
}
