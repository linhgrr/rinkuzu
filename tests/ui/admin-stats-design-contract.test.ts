import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const chartSource = fs.readFileSync(
  'src/features/admin/stats/components/charts/TopCreatorsBarChart.tsx',
  'utf8',
);
const entitlementSource = fs.readFileSync(
  'src/features/admin/stats/components/EntitlementTelemetrySection.tsx',
  'utf8',
);

describe('admin stats design contract', () => {
  it('uses semantic borders for chart tooltips and telemetry row dividers', () => {
    for (const source of [chartSource, entitlementSource]) {
      expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    }

    expect(chartSource).toContain('border border-line bg-white');
    expect(entitlementSource).toContain('border-t border-line/50');
  });
});
