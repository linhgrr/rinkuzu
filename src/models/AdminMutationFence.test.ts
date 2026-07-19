import { describe, expect, it } from 'vitest';

import AdminMutationFence from '@/models/AdminMutationFence';
import { ACTIVE_ADMIN_FENCE_ID } from '@/shared/constants/admin-invariant';

describe('AdminMutationFence model', () => {
  it('registers the singleton fence collection and document defaults', () => {
    expect(AdminMutationFence.modelName).toBe('AdminMutationFence');
    expect(AdminMutationFence.collection.name).toBe('adminmutationfences');

    const fence = new AdminMutationFence({
      _id: ACTIVE_ADMIN_FENCE_ID,
      revision: 0,
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    });
    expect(fence._id).toBe(ACTIVE_ADMIN_FENCE_ID);
    expect(fence.revision).toBe(0);
    expect(fence.updatedAt).toEqual(new Date('2026-07-19T00:00:00.000Z'));
  });

  it('rejects non-canonical fence ids and non-integer revisions', async () => {
    await expect(
      new AdminMutationFence({
        _id: 'other',
        revision: 0,
        updatedAt: new Date(),
      }).validate(),
    ).rejects.toThrow();

    await expect(
      new AdminMutationFence({
        _id: ACTIVE_ADMIN_FENCE_ID,
        revision: 1.5,
        updatedAt: new Date(),
      }).validate(),
    ).rejects.toThrow(/non-negative integer|integer/i);

    await expect(
      new AdminMutationFence({
        _id: ACTIVE_ADMIN_FENCE_ID,
        revision: -1,
        updatedAt: new Date(),
      }).validate(),
    ).rejects.toThrow();
  });

  it('does not declare timestamps bootstrap options', () => {
    const options = AdminMutationFence.schema.get('timestamps');
    expect(options).toBeFalsy();
  });
});
