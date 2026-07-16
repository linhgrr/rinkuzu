import { describe, expect, it } from 'vitest';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
} from '@/interfaces/services/IImageStorage';
import { toImageStorageFailure } from '@/services/image-storage-error';

describe('toImageStorageFailure', () => {
  it('maps storage configuration and upstream failures to stable service status codes', () => {
    expect(toImageStorageFailure(new ImageStorageConfigurationError())).toEqual({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });
    expect(toImageStorageFailure(new ImageStorageUpstreamError('Storage unavailable'))).toEqual({
      success: false,
      error: 'Storage unavailable',
      statusCode: 502,
    });
  });

  it('does not hide unrelated failures', () => {
    expect(toImageStorageFailure(new Error('unexpected'))).toBeNull();
  });
});
