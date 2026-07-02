import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IImageStorage,
  ImageUpload,
  ImageUploadResult,
} from '@/interfaces/services/IImageStorage';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
} from '@/interfaces/services/IImageStorage';
import { ImageService } from '@/services/image/ImageService';

class ImageStorageStub implements IImageStorage {
  upload = vi.fn<(image: ImageUpload) => Promise<ImageUploadResult>>();
}

const image = {
  bytes: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
  filename: 'question.png',
};

const uploaded: ImageUploadResult = {
  id: 'image-id',
  url: 'https://images.example/original.png',
  displayUrl: 'https://images.example/display.png',
  thumbnailUrl: 'https://images.example/thumb.png',
  mediumUrl: 'https://images.example/medium.png',
  deleteUrl: 'https://images.example/delete/image-id',
  width: 800,
  height: 600,
  size: 4096,
};

describe('ImageService', () => {
  let storage: ImageStorageStub;
  let service: ImageService;

  beforeEach(() => {
    storage = new ImageStorageStub();
    service = new ImageService(storage);
  });

  it('returns the provider-neutral image asset DTO', async () => {
    storage.upload.mockResolvedValue(uploaded);

    await expect(service.uploadImage(image)).resolves.toEqual({
      success: true,
      data: uploaded,
    });
    expect(storage.upload).toHaveBeenCalledWith(image);
  });

  it('maps known storage failures without leaking provider errors', async () => {
    storage.upload
      .mockRejectedValueOnce(new ImageStorageConfigurationError())
      .mockRejectedValueOnce(new ImageStorageUpstreamError());

    await expect(service.uploadImage(image)).resolves.toEqual({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });
    await expect(service.uploadImage(image)).resolves.toEqual({
      success: false,
      error: 'Image upload failed',
      statusCode: 502,
    });
  });
});
