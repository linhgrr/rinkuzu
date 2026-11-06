import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_UPLOAD_MAX_FILE_SIZE } from '@/dtos/image';

const { authMock, uploadImageMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadImageMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/image-factory', () => ({
  getImageService: () => ({
    uploadImage: uploadImageMock,
  }),
}));

import { POST } from '@/app/api/image/upload/route';

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function uploadRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost/api/image/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/image/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    uploadImageMock.mockResolvedValue({
      success: true,
      data: { url: 'https://cdn.rinkuzu.app/images/question/2026/image.png' },
    });
  });

  it('requires authentication before reading the form body', async () => {
    authMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set('image', new File(['bytes'], 'a.png', { type: 'image/png' }));

    const response = await POST(uploadRequest(formData), { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it('rejects missing files, non-images, and oversized payloads', async () => {
    const missing = new FormData();
    missing.set('image', 'not-a-file');
    const missingResponse = await POST(uploadRequest(missing), { params: Promise.resolve({}) });
    expect(missingResponse.status).toBe(400);
    await expect(missingResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'No image provided' },
    });

    const nonImage = new FormData();
    nonImage.set('image', new File(['pdf'], 'doc.pdf', { type: 'application/pdf' }));
    const nonImageResponse = await POST(uploadRequest(nonImage), {
      params: Promise.resolve({}),
    });
    expect(nonImageResponse.status).toBe(400);
    await expect(nonImageResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'File must be an image' },
    });

    const atLimit = new FormData();
    atLimit.set(
      'image',
      new File([new Uint8Array(IMAGE_UPLOAD_MAX_FILE_SIZE)], 'ok.png', {
        type: 'image/png',
      }),
    );
    expect((await POST(uploadRequest(atLimit), { params: Promise.resolve({}) })).status).toBe(200);
    expect(uploadImageMock).toHaveBeenCalledOnce();

    const oversized = new FormData();
    oversized.set(
      'image',
      new File([new Uint8Array(IMAGE_UPLOAD_MAX_FILE_SIZE + 1)], 'big.png', {
        type: 'image/png',
      }),
    );
    const oversizedResponse = await POST(uploadRequest(oversized), {
      params: Promise.resolve({}),
    });
    expect(oversizedResponse.status).toBe(400);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'File size must be less than 10MB' },
    });
    expect(uploadImageMock).toHaveBeenCalledOnce();
  });

  it('uploads image bytes with optional override name and returns the upload envelope', async () => {
    const formData = new FormData();
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
    formData.set('image', file);
    formData.set('name', 'override-name.jpg');

    const response = await POST(uploadRequest(formData), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(uploadImageMock).toHaveBeenCalledWith({
      kind: 'question',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      filename: 'override-name.jpg',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { url: 'https://cdn.rinkuzu.app/images/question/2026/image.png' },
    });
  });

  it('falls back to the file name when name is missing or empty', async () => {
    const formData = new FormData();
    formData.set('image', new File([new Uint8Array([9])], 'fallback.png', { type: 'image/png' }));
    formData.set('name', '');

    await POST(uploadRequest(formData), { params: Promise.resolve({}) });

    expect(uploadImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'fallback.png' }),
    );
  });

  it('maps service upload failures through the image response helper', async () => {
    uploadImageMock.mockResolvedValueOnce({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });
    const formData = new FormData();
    formData.set('image', new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));

    const response = await POST(uploadRequest(formData), { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'configuration_error' },
    });
  });

  it('returns 400 validation_error when storage rejects the decoded bytes', async () => {
    uploadImageMock.mockResolvedValueOnce({
      success: false,
      error: 'File must be an image',
      statusCode: 400,
    });
    const formData = new FormData();
    formData.set('image', new File(['<svg/>'], 'a.png', { type: 'image/png' }));

    const response = await POST(uploadRequest(formData), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'File must be an image' },
    });
  });
});
