import { describe, expect, it } from 'vitest';

import qualityConfig from '../../vitest.quality.config';
import qualityEslintConfig from '../../vitest.quality-eslint.config';

// `npm run test:quality` runs both configs. A file listed by the serial
// quality-eslint project must be excluded from the parallel quality project,
// or it runs twice and its parallel copy times out under load (RIN-1210).
describe('vitest quality projects', () => {
  it('excludes every quality-eslint file from the parallel quality project', () => {
    const serialFiles = qualityEslintConfig.test?.include ?? [];
    const parallelExclude = qualityConfig.test?.exclude ?? [];

    expect(serialFiles.length).toBeGreaterThan(0);
    for (const file of serialFiles) {
      expect(parallelExclude).toContain(file);
    }
  });
});
