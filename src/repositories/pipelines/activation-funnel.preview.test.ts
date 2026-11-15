import { describe, expect, it } from 'vitest';
import { attemptUnionStage } from '@/repositories/pipelines/activation-funnel';

describe('activation funnel and Premium preview attempts (RIN-1722)', () => {
  it('counts a preview attempt as a completed quiz: no stage filters on `preview`', () => {
    const stage = attemptUnionStage('attempts', new Date('2026-11-01'), new Date('2026-11-08'));
    expect(JSON.stringify(stage)).not.toContain('preview');
    // The union reads every attempt of a signed-in learner, so a preview attempt is included.
    expect(stage.$unionWith).toMatchObject({
      pipeline: [{ $match: { user: { $type: 'objectId' } } }, expect.anything(), expect.anything()],
    });
  });
});
