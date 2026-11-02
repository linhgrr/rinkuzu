// A fixed locale keeps server and client output identical; a bare
// toLocaleString() follows the runtime's locale and can break hydration.
const countFormat = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
