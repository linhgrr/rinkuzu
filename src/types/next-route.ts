export type AsyncRouteParams<T extends Record<string, string | string[]>> = {
  params: Promise<T>;
};
