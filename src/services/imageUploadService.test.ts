import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadImageToImgBB } from './imageUploadService';

describe('uploadImageToImgBB', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts FormData with fetch and leaves multipart boundary handling to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          status: 200,
          data: {
            id: 'img-1',
            title: 'quiz-image',
            url_viewer: 'https://imgbb.com/view/img-1',
            url: 'https://i.ibb.co/original.jpg',
            display_url: 'https://i.ibb.co/display.jpg',
            width: 1200,
            height: 630,
            size: 2048,
            time: 123,
            expiration: 0,
            image: {
              filename: 'quiz-image.jpg',
              name: 'quiz-image',
              mime: 'image/jpeg',
              extension: 'jpg',
              url: 'https://i.ibb.co/original.jpg',
            },
            thumb: {
              filename: 'quiz-image-thumb.jpg',
              name: 'quiz-image-thumb',
              mime: 'image/jpeg',
              extension: 'jpg',
              url: 'https://i.ibb.co/thumb.jpg',
            },
            medium: {
              filename: 'quiz-image-medium.jpg',
              name: 'quiz-image-medium',
              mime: 'image/jpeg',
              extension: 'jpg',
              url: 'https://i.ibb.co/medium.jpg',
            },
            delete_url: 'https://i.ibb.co/delete/img-1',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const file = new File(['image-bytes'], 'quiz-image.jpg', { type: 'image/jpeg' });
    const result = await uploadImageToImgBB(file, 'quiz-image.jpg');

    expect(result.displayUrl).toBe('https://i.ibb.co/display.jpg');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.imgbb.com/1/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected fetch to be called');
    }

    const [, requestInit] = firstCall;
    expect(requestInit?.headers).toBeUndefined();
    expect((requestInit?.body as FormData).get('name')).toBe('quiz-image.jpg');
    expect((requestInit?.body as FormData).get('key')).toBeTruthy();
  });
});
