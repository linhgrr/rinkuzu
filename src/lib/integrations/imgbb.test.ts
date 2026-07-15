import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImgBbImageStorage } from '@/lib/integrations/imgbb';
import { ImageStorageUpstreamError } from '@/interfaces/services/IImageStorage';

vi.mock('@/lib/env', () => ({
  env: { IMGBB_API_KEY: 'test-imgbb-key' },
}));

const payload = {
  success: true,
  data: {
    id: 'image-id',
    url: 'https://images.example/original.png',
    display_url: 'https://images.example/display.png',
    delete_url: 'https://images.example/delete/image-id',
    thumb: { url: 'https://images.example/thumb.png' },
    medium: { url: 'https://images.example/medium.png' },
    width: 800,
    height: 600,
    size: 4096,
  },
};

describe('ImgBbImageStorage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(payload),
      }),
    );
  });

  it('validates and maps the ImgBB response', async () => {
    const storage = new ImgBbImageStorage();

    await expect(
      storage.upload({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        filename: 'image.png',
      }),
    ).resolves.toEqual({
      id: 'image-id',
      url: 'https://images.example/original.png',
      displayUrl: 'https://images.example/display.png',
      thumbnailUrl: 'https://images.example/thumb.png',
      mediumUrl: 'https://images.example/medium.png',
      deleteUrl: 'https://images.example/delete/image-id',
      width: 800,
      height: 600,
      size: 4096,
    });
  });

  it('rejects malformed successful responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const storage = new ImgBbImageStorage();

    await expect(
      storage.upload({
        bytes: new Uint8Array(),
        contentType: 'image/png',
        filename: 'image.png',
      }),
    ).rejects.toBeInstanceOf(ImageStorageUpstreamError);
  });

  it('omits an absent optional medium image URL', async () => {
    const withoutMedium = {
      ...payload,
      data: { ...payload.data, medium: undefined },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(withoutMedium), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await new ImgBbImageStorage().upload({
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      filename: 'image.png',
    });

    expect(result).not.toHaveProperty('mediumUrl');
  });
});
