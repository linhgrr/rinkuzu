export type BrowserLocation = Pick<Location, 'replace'>;

export function replaceBrowserLocation(
  url: string,
  location: BrowserLocation = window.location,
): void {
  location.replace(url);
}
