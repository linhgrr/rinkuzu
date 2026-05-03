export type RouteParamValue = string | string[] | undefined;
export type RouteParams = Record<string, RouteParamValue>;

export function readRequiredRouteParam(params: RouteParams, key: string): string {
  const rawValue = params[key];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value || value === 'undefined' || value === 'null') {
    throw new Error(`Missing required route param: ${key}`);
  }

  return value;
}

export function routePathSegment(value: string): string {
  if (!value || value === 'undefined' || value === 'null') {
    throw new Error('Cannot build a route with an empty path segment');
  }

  return encodeURIComponent(value);
}
