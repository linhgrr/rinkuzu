import { describe, expect, it } from 'vitest';
import { imageUploadResponse } from '@/lib/api/image-response';

describe('imageUploadResponse', () => {
  it('returns the uploaded data on success', async () => {
    const response = imageUploadResponse({
      success: true,
      data: { url: 'https://cdn.test/a.png' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { url: 'https://cdn.test/a.png' },
    });
  });

  it('maps missing image configuration to a stable configuration error', async () => {
    const response = imageUploadResponse({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'configuration_error' },
    });
  });

  it('preserves other service failures', async () => {
    const response = imageUploadResponse({
      success: false,
      code: 'image_upload_failed',
      error: 'Upload failed',
      statusCode: 502,
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'image_upload_failed' },
    });
  });
});
