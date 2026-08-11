import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getQuizByIdMock,
  updateQuizMock,
  deleteQuizMock,
  getSignedPDFUrlMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuizByIdMock: vi.fn(),
  updateQuizMock: vi.fn(),
  deleteQuizMock: vi.fn(),
  getSignedPDFUrlMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    getQuizById: getQuizByIdMock,
    updateQuiz: updateQuizMock,
    deleteQuiz: deleteQuizMock,
  }),
}));
vi.mock('@/lib/s3', () => ({
  BUCKET_NAME: 'test-bucket',
  getSignedPDFUrl: getSignedPDFUrlMock,
}));

import { createQuizIdRoute } from '@/app/api/quizzes/[id]/quiz-id-route';
import { DELETE, GET, PUT } from '@/app/api/quizzes/[id]/route';

const QUIZ_ID = '507f1f77bcf86cd799439011';
const request = new NextRequest(`http://localhost/api/quizzes/${QUIZ_ID}`);
const routeContext = { params: Promise.resolve({ id: QUIZ_ID }) };

function authSession() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' as const },
  };
}

describe('createQuizIdRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(authSession());
  });

  it('rejects invalid quiz id params before invoking the handler', async () => {
    const handle = vi.fn();
    const route = createQuizIdRoute({ handle });

    const response = await route(request, { params: Promise.resolve({ id: 'invalid' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: expect.objectContaining({
        code: 'validation_error',
      }),
    });
    expect(body.error.meta?.fields).toBeDefined();
    expect(handle).not.toHaveBeenCalled();
  });

  it('passes the request, validated quiz id, and authenticated auth context', async () => {
    const handle = vi.fn().mockResolvedValue(new Response('ok'));
    const route = createQuizIdRoute({ handle });

    await route(request, routeContext);

    expect(handle).toHaveBeenCalledWith({
      request,
      quizId: QUIZ_ID,
      userId: 'user-1',
      email: 'user@example.com',
      session: expect.objectContaining({
        user: expect.objectContaining({
          id: 'user-1',
          email: 'user@example.com',
          role: 'user',
        }),
      }),
    });
  });
});

describe('/api/quizzes/[id] handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(authSession());
  });

  it('GET rejects unauthenticated callers without invoking the service', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request, routeContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'unauthorized' },
    });
    expect(getQuizByIdMock).not.toHaveBeenCalled();
  });

  it('PUT rejects unauthenticated callers without invoking the service', async () => {
    authMock.mockResolvedValue(null);
    const putRequest = new NextRequest(`http://localhost/api/quizzes/${QUIZ_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    const response = await PUT(putRequest, routeContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'unauthorized' },
    });
    expect(updateQuizMock).not.toHaveBeenCalled();
  });

  it('DELETE rejects unauthenticated callers without invoking the service', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(request, routeContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'unauthorized' },
    });
    expect(deleteQuizMock).not.toHaveBeenCalled();
  });

  it('GET returns the quiz from the service for a valid id', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'Algebra' },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(getQuizByIdMock).toHaveBeenCalledWith(QUIZ_ID, 'user-1', 'user');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: QUIZ_ID, title: 'Algebra' },
    });
  });

  it('GET rejects invalid params without calling the service', async () => {
    const response = await GET(request, { params: Promise.resolve({ id: 'not-an-object-id' }) });

    expect(response.status).toBe(400);
    expect(getQuizByIdMock).not.toHaveBeenCalled();
  });

  it('GET maps service failures', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: false,
      code: 'not_found',
      error: 'Quiz not found',
      statusCode: 404,
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.objectContaining({ code: 'not_found', detail: 'Quiz not found' }),
    });
  });

  it('GET refreshes signed PDF URLs when a bucket marker is present', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: QUIZ_ID,
        title: 'With PDF',
        pdfUrl: 'https://cdn.example.com/test-bucket/quizzes/doc.pdf?sig=old',
      },
    });
    getSignedPDFUrlMock.mockResolvedValue('https://cdn.example.com/signed/doc.pdf');

    const response = await GET(request, routeContext);

    expect(getSignedPDFUrlMock).toHaveBeenCalledWith('quizzes/doc.pdf?sig=old');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { pdfUrl: 'https://cdn.example.com/signed/doc.pdf' },
    });
  });

  it('PUT updates the quiz with validated body and auth context', async () => {
    updateQuizMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'Updated' },
    });
    const putRequest = new NextRequest(`http://localhost/api/quizzes/${QUIZ_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    const response = await PUT(putRequest, routeContext);

    expect(response.status).toBe(200);
    expect(updateQuizMock).toHaveBeenCalledWith(QUIZ_ID, { title: 'Updated' }, 'user-1', 'user');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: QUIZ_ID, title: 'Updated' },
    });
  });

  it('PUT rejects invalid params without calling the service', async () => {
    const putRequest = new NextRequest('http://localhost/api/quizzes/bad', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    const response = await PUT(putRequest, { params: Promise.resolve({ id: 'bad' }) });

    expect(response.status).toBe(400);
    expect(updateQuizMock).not.toHaveBeenCalled();
  });

  it('PUT rejects invalid body without calling the service', async () => {
    const putRequest = new NextRequest(`http://localhost/api/quizzes/${QUIZ_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PUT(putRequest, routeContext);

    expect(response.status).toBe(400);
    expect(updateQuizMock).not.toHaveBeenCalled();
  });

  it('DELETE deletes the quiz and preserves success metadata', async () => {
    deleteQuizMock.mockResolvedValue({
      success: true,
      data: { deleted: true },
    });

    const response = await DELETE(request, routeContext);

    expect(response.status).toBe(200);
    expect(deleteQuizMock).toHaveBeenCalledWith(QUIZ_ID, 'user-1', 'user');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true },
      meta: { message: 'Quiz deleted successfully' },
    });
  });

  it('DELETE rejects invalid params without calling the service', async () => {
    const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(400);
    expect(deleteQuizMock).not.toHaveBeenCalled();
  });

  it('DELETE maps service failures', async () => {
    deleteQuizMock.mockResolvedValue({
      success: false,
      code: 'forbidden',
      error: 'Not allowed',
      statusCode: 403,
    });

    const response = await DELETE(request, routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.objectContaining({ code: 'forbidden', detail: 'Not allowed' }),
    });
  });
});

describe('/api/quizzes/[id] mutation-sensitive branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(authSession());
  });

  function putRequest(body: unknown) {
    return new NextRequest(`http://localhost/api/quizzes/${QUIZ_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('GET skips signed URL work when pdfUrl is absent', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'No PDF' },
    });

    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { id: QUIZ_ID, title: 'No PDF' },
    });
    expect(body.data).not.toHaveProperty('pdfUrl');
    expect(getSignedPDFUrlMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('GET tolerates null quiz data without optional-chain pdfUrl access throwing', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: null,
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: null,
    });
    expect(getSignedPDFUrlMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('GET leaves pdfUrl unchanged when the bucket marker is absent', async () => {
    const originalPdfUrl = 'https://cdn.example.com/other-prefix/quizzes/doc.pdf';
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: QUIZ_ID,
        title: 'External PDF',
        pdfUrl: originalPdfUrl,
      },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(getSignedPDFUrlMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { pdfUrl: originalPdfUrl },
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('GET does not call getSignedPDFUrl when the key after the bucket marker is empty', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: QUIZ_ID,
        title: 'Empty key',
        pdfUrl: 'https://cdn.example.com/test-bucket/',
      },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(getSignedPDFUrlMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { pdfUrl: 'https://cdn.example.com/test-bucket/' },
    });
  });

  it('GET falls back when signed URL refresh fails and still returns the quiz', async () => {
    const originalPdfUrl = 'https://cdn.example.com/test-bucket/quizzes/doc.pdf';
    const refreshError = new Error('s3 unavailable');
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: QUIZ_ID,
        title: 'With PDF',
        pdfUrl: originalPdfUrl,
      },
    });
    getSignedPDFUrlMock.mockRejectedValue(refreshError);

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(getSignedPDFUrlMock).toHaveBeenCalledWith('quizzes/doc.pdf');
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: refreshError },
      'Failed to refresh signed URL for quiz',
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: QUIZ_ID,
        title: 'With PDF',
        pdfUrl: originalPdfUrl,
      },
    });
  });

  it('GET maps unexpected service throws to 500 internal_error', async () => {
    const boom = new Error('get quiz boom');
    getQuizByIdMock.mockRejectedValue(boom);

    const response = await GET(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'internal_error',
        message: 'Internal server error',
        detail: 'Internal server error',
      },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith({ error: boom }, 'Get quiz error');
    expect(getSignedPDFUrlMock).not.toHaveBeenCalled();
  });

  it('PUT rejects invalid body with exact validation_error status and body', async () => {
    const response = await PUT(putRequest({}), routeContext);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('validation_error');
    expect(body.error.detail).toBe('No quiz fields provided');
    expect(body.error.meta).toEqual({ _: 'No quiz fields provided' });
    expect(updateQuizMock).not.toHaveBeenCalled();
  });

  it('PUT maps service failures with exact status and body', async () => {
    updateQuizMock.mockResolvedValue({
      success: false,
      code: 'not_found',
      error: 'Quiz not found',
      statusCode: 404,
    });

    const response = await PUT(putRequest({ title: 'Updated' }), routeContext);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'not_found',
        detail: 'Quiz not found',
      },
    });
    expect(body.error.code).toBe('not_found');
    expect(updateQuizMock).toHaveBeenCalledWith(QUIZ_ID, { title: 'Updated' }, 'user-1', 'user');
  });

  it('PUT maps unexpected service throws to 500 internal_error', async () => {
    const boom = new Error('update quiz boom');
    updateQuizMock.mockRejectedValue(boom);

    const response = await PUT(putRequest({ title: 'Updated' }), routeContext);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'internal_error',
        message: 'Internal server error',
        detail: 'Internal server error',
      },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith({ error: boom }, 'Update quiz error');
  });

  it('DELETE maps unexpected service throws to 500 internal_error', async () => {
    const boom = new Error('delete quiz boom');
    deleteQuizMock.mockRejectedValue(boom);

    const response = await DELETE(request, routeContext);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'internal_error',
        message: 'Internal server error',
        detail: 'Internal server error',
      },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith({ error: boom }, 'Delete quiz error');
  });

  it('forwards admin security context to GET, PUT, and DELETE service calls', async () => {
    authMock.mockResolvedValue({
      user: { id: 'admin-9', email: 'admin@example.com', role: 'admin' as const },
    });
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'Admin view' },
    });
    updateQuizMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'Admin update' },
    });
    deleteQuizMock.mockResolvedValue({
      success: true,
      data: { deleted: true },
    });

    await GET(request, routeContext);
    await PUT(putRequest({ title: 'Admin update' }), routeContext);
    await DELETE(request, routeContext);

    expect(getQuizByIdMock).toHaveBeenCalledWith(QUIZ_ID, 'admin-9', 'admin');
    expect(updateQuizMock).toHaveBeenCalledWith(
      QUIZ_ID,
      { title: 'Admin update' },
      'admin-9',
      'admin',
    );
    expect(deleteQuizMock).toHaveBeenCalledWith(QUIZ_ID, 'admin-9', 'admin');
    expect(getQuizByIdMock).toHaveBeenCalledTimes(1);
    expect(updateQuizMock).toHaveBeenCalledTimes(1);
    expect(deleteQuizMock).toHaveBeenCalledTimes(1);
  });
});
