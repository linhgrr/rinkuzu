import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rateMock, recordMock } = vi.hoisted(() => ({
  rateMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/lib/auth-rate-limit', () => ({ checkAuthRateLimit: rateMock }));
vi.mock('@/lib/upload-counter-factory', () => ({
  getUploadCounterService: () => ({ recordRejection: recordMock }),
}));

import { dynamic, POST } from '@/app/api/upload-rejections/route';

const ALLOWED = { allowed: true, remaining: 29, resetSeconds: 600, limit: 30 };
const DENIED = { allowed: false, retryAfterSeconds: 600, limit: 30 };
const VALID = { ext: 'docx', reason: 'wrong_type', surface: 'create_pdf', sizeBucket: '1-5MB' };

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/upload-rejections', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload-rejections (RIN-1785)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateMock.mockResolvedValue(ALLOWED);
    recordMock.mockResolvedValue(undefined);
  });

  it('counts a valid rejection without sign-in and answers 204', async () => {
    expect(dynamic).toBe('force-dynamic');
    const response = await POST(request(VALID));
    expect(response.status).toBe(204);
    expect(recordMock).toHaveBeenCalledWith(VALID);
    expect(rateMock).toHaveBeenCalledWith('upload_rejection_ip', '203.0.113.7');
  });

  it('lower-cases the extension and maps an odd one to other', async () => {
    await POST(request({ ...VALID, ext: 'DOCX' }));
    await POST(request({ ...VALID, ext: 'my file!' }));
    await POST(request({ ...VALID, ext: 'toolongext1' }));
    await POST(request({ ...VALID, ext: '' }));
    expect(recordMock.mock.calls.map(([input]) => input.ext)).toEqual([
      'docx',
      'other',
      'other',
      'other',
    ]);
  });

  it.each([
    ['an unknown reason', { ...VALID, reason: 'because' }],
    ['an unknown surface', { ...VALID, surface: 'admin' }],
    ['an unknown size bucket', { ...VALID, sizeBucket: '3MB' }],
    ['a missing field', { ext: 'pdf', reason: 'wrong_type', surface: 'try_pdf' }],
    ['extra fields such as a file name', { ...VALID, fileName: 'secret.docx' }],
  ])('returns 400 for %s and counts nothing', async (_label, body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('answers 204 and counts nothing beyond the per-IP limit', async () => {
    rateMock.mockResolvedValueOnce(DENIED);
    const response = await POST(request(VALID));
    expect(response.status).toBe(204);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('counts nothing for our own agents, and does not spend their rate limit', async () => {
    const response = await POST(request(VALID, { 'user-agent': 'Mozilla/5.0 rinkuzu-agent/qa' }));
    expect(response.status).toBe(204);
    expect(recordMock).not.toHaveBeenCalled();
    expect(rateMock).not.toHaveBeenCalled();
  });
});
