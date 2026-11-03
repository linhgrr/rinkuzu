import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@/lib/logger';

import { AdminTestAccountService } from './AdminTestAccountService';

const USER_ID = '507f1f77bcf86cd799439011';
const ACTOR = { id: '507f1f77bcf86cd799439012', email: 'admin@example.test' };

function setup(previous: boolean | null = false) {
  const users = {
    setTestAccount: vi.fn().mockResolvedValue(previous === null ? null : { previous }),
    revertTestAccount: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return { users, audit, service: new AdminTestAccountService({ users, audit }) };
}

describe('AdminTestAccountService.setTestAccount', () => {
  it('writes the flag and records one audit entry with the actor and no PII', async () => {
    const { users, audit, service } = setup(false);

    const result = await service.setTestAccount(USER_ID, true, ACTOR);

    expect(result).toEqual({
      success: true,
      data: { id: USER_ID, isTestAccount: true, changed: true },
    });
    expect(users.setTestAccount).toHaveBeenCalledWith(USER_ID, true);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith({
      actorId: ACTOR.id,
      actorEmail: ACTOR.email,
      action: 'user.test_account.set',
      entityType: 'user',
      entityId: USER_ID,
      details: { isTestAccount: 'true', previous: 'false' },
    });
  });

  it('audits clearing the flag', async () => {
    const { audit, service } = setup(true);

    const result = await service.setTestAccount(USER_ID, false, ACTOR);

    expect(result).toMatchObject({ success: true, data: { isTestAccount: false, changed: true } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ details: { isTestAccount: 'false', previous: 'true' } }),
    );
  });

  it('is idempotent: an unchanged value returns 200 data with changed false and no audit entry', async () => {
    const { audit, service } = setup(true);

    const result = await service.setTestAccount(USER_ID, true, ACTOR);

    expect(result).toEqual({
      success: true,
      data: { id: USER_ID, isTestAccount: true, changed: false },
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user without auditing', async () => {
    const { audit, service } = setup(null);

    expect(await service.setTestAccount(USER_ID, true, ACTOR)).toMatchObject({
      success: false,
      statusCode: 404,
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('reverts the flag when the audit write fails, so no change stands unaudited', async () => {
    const { users, audit, service } = setup(false);
    audit.record.mockRejectedValueOnce(new Error('audit down'));

    expect(await service.setTestAccount(USER_ID, true, ACTOR)).toMatchObject({
      success: false,
      statusCode: 500,
    });
    expect(users.revertTestAccount).toHaveBeenCalledWith(USER_ID, true, false);
  });

  it('still returns 500 and logs the failed revert when the revert also fails', async () => {
    const { users, audit, service } = setup(false);
    audit.record.mockRejectedValueOnce(new Error('audit down'));
    const revertError = new Error('revert down');
    users.revertTestAccount.mockRejectedValueOnce(revertError);

    expect(await service.setTestAccount(USER_ID, true, ACTOR)).toMatchObject({
      success: false,
      statusCode: 500,
    });
    expect(logger.error).toHaveBeenCalledWith(
      { error: revertError, userId: USER_ID },
      'Test account flag revert failed',
    );
  });

  it('maps a failed flag write to 500', async () => {
    const { users, audit, service } = setup(false);
    users.setTestAccount.mockRejectedValueOnce(new Error('db down'));

    expect(await service.setTestAccount(USER_ID, true, ACTOR)).toMatchObject({
      success: false,
      statusCode: 500,
    });
    expect(audit.record).not.toHaveBeenCalled();
  });
});
