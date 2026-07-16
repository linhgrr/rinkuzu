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
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getQuizService: () => ({
      getQuizById: getQuizByIdMock,
      updateQuiz: updateQuizMock,
      deleteQuiz: deleteQuizMock,
    }),
  },
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

  it('GET returns the quiz from the service for a valid id', async () => {
    getQuizByIdMock.mockResolvedValue({
      success: true,
      data: { id: QUIZ_ID, title: 'Algebra' },
    });

    const response = await GET(request, routeContext);

    expect(response.status).toBe(200);
    expect(getQuizByIdMock).toHaveBeenCalledWith(QUIZ_ID, 'user@example.com', 'user', 'user-1');
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
