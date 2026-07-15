import { describe, expect, it } from 'vitest';
import { findRuntimeCycles, runtimeSpecifiers } from '../../scripts/check-runtime-cycles.mjs';

describe('runtime cycle guard', () => {
  it('ignores type-only imports and keeps runtime imports', () => {
    expect(
      runtimeSpecifiers(`
        import type { User } from './user';
        import { type Quiz } from './quiz';
        import { load } from './loader';
        export type { Result } from './result';
        export { run } from './runner';
      `),
    ).toEqual(['./loader', './runner']);
  });

  it('reports strongly connected runtime components', () => {
    const graph = new Map([
      ['a.ts', ['b.ts']],
      ['b.ts', ['c.ts']],
      ['c.ts', ['a.ts']],
      ['leaf.ts', []],
    ]);

    expect(findRuntimeCycles(graph)).toEqual([['a.ts', 'b.ts', 'c.ts']]);
  });
});
