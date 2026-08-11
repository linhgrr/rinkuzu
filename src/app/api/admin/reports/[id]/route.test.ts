import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, updateReportStatusMock, deleteReportMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  updateReportStatusMock: vi.fn(),
  deleteReportMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getAdminService: () => ({
    updateReportStatus: updateReportStatusMock,
    deleteReport: deleteReportMock,
  }),
}));

import { DELETE, dynamic, PATCH } from '@/app/api/admin/reports/[id]/route';

const reportId = '507f1f77bcf86cd799439011';
const routeContext = { params: Promise.resolve({ id: reportId }) };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function patchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
  });

  it('is force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  describe('PATCH', () => {
    it('validates the report id and body before updating', async () => {
      const badId = await PATCH(patchRequest({ status: 'resolved' }), {
        params: Promise.resolve({ id: 'not-an-object-id' }),
      });
      expect(badId.status).toBe(400);
      expect(updateReportStatusMock).not.toHaveBeenCalled();

      const badBody = await PATCH(patchRequest({ status: 'open' }), routeContext);
      expect(badBody.status).toBe(400);
      expect(updateReportStatusMock).not.toHaveBeenCalled();
    });

    it('updates report status and maps service failures', async () => {
      updateReportStatusMock
        .mockResolvedValueOnce({
          success: true,
          data: { id: reportId, status: 'resolved' },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Report not found',
          statusCode: 404,
        });

      const ok = await PATCH(
        patchRequest({ status: 'resolved', adminNotes: 'fixed' }),
        routeContext,
      );
      expect(ok.status).toBe(200);
      expect(updateReportStatusMock).toHaveBeenCalledWith(
        reportId,
        { status: 'resolved', adminNotes: 'fixed' },
        'admin@example.com',
      );

      const missing = await PATCH(patchRequest({ status: 'dismissed' }), routeContext);
      expect(missing.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('deletes a report and maps service failures', async () => {
      deleteReportMock
        .mockResolvedValueOnce({
          success: true,
          data: { id: reportId, deleted: true },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Report not found',
          statusCode: 404,
        });

      const request = new NextRequest(`http://localhost/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });

      const ok = await DELETE(request, routeContext);
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toMatchObject({
        success: true,
        meta: { message: 'Report deleted successfully' },
      });
      expect(deleteReportMock).toHaveBeenCalledWith(reportId);

      const missing = await DELETE(request, routeContext);
      expect(missing.status).toBe(404);
    });
  });
});
