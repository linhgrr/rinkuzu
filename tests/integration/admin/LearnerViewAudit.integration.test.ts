import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { AdminActionAudit } from '@/models/Communication';
import { integrationDatabaseUri } from '../../setup/integration-db';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));

import { GET } from '@/app/api/admin/personal-learning/subjects/route';

describe('admin learner view audit integration', () => {
  const adminId = new Types.ObjectId().toHexString();
  const learnerId = new Types.ObjectId().toHexString();
  const routeContext = { params: Promise.resolve({}) };

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await AdminActionAudit.deleteMany({ entityId: learnerId });
    await mongoose.disconnect();
  }, 10_000);

  beforeEach(() => {
    authMock.mockResolvedValue({
      user: { id: adminId, email: 'admin@example.test', role: 'admin' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            subjects: [
              {
                job_id: 'job-1',
                filename: 'notes.pdf',
                pipeline_status: 'completed',
                progress_status: null,
                accuracy: 0,
                progress_percent: 0,
                last_activity_at: null,
              },
            ],
            next_cursor: null,
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
  });

  it('persists exactly one audit record per successful view', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/admin/personal-learning/subjects?user_id=${learnerId}&window=7d`,
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    const records = await AdminActionAudit.find({ entityId: learnerId }).lean();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actorEmail: 'admin@example.test',
      action: 'personal_learning.learner_view',
      entityType: 'user',
      entityId: learnerId,
      details: { window: '7d', page: 'first' },
    });
    expect(String(records[0]?.actorId)).toBe(adminId);
  });
});
