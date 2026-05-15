import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadImageToImgBB } from './imageUploadService';

describe('uploadImageToImgBB', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts FormData to the proxy route and returns normalized result', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'img-1',
            url: 'https://i.ibb.co/original.jpg',
            displayUrl: 'https://i.ibb.co/display.jpg',
            thumbnailUrl: 'https://i.ibb.co/thumb.jpg',
            mediumUrl: 'https://i.ibb.co/medium.jpg',
            deleteUrl: 'https://i.ibb.co/delete/img-1',
            width: 1200,
            height: 630,
            size: 2048,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const file = new File(['image-bytes'], 'quiz-image.jpg', { type: 'image/jpeg' });
    const result = await uploadImageToImgBB(file, 'quiz-image.jpg');

    expect(result.displayUrl).toBe('https://i.ibb.co/display.jpg');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/image/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) throw new Error('Expected fetch to be called');

    const [, requestInit] = firstCall;
    expect(requestInit?.headers).toBeUndefined();
    expect((requestInit?.body as FormData).get('name')).toBe('quiz-image.jpg');
    expect((requestInit?.body as FormData).get('image')).toBeTruthy();
  });
});
