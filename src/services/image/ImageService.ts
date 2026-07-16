import type { ImageAssetDto } from '@/dtos/image';
import type { IImageService, UploadImageData } from '@/interfaces/services/IImageService';
import type { IImageStorage } from '@/interfaces/services/IImageStorage';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { toImageStorageFailure } from '@/services/image-storage-error';

export class ImageService implements IImageService {
  constructor(private readonly imageStorage: IImageStorage) {}

  async uploadImage(image: UploadImageData): Promise<ServiceResult<ImageAssetDto>> {
    try {
      return {
        success: true,
        data: await this.imageStorage.upload(image),
      };
    } catch (error) {
      const storageFailure = toImageStorageFailure(error);
      if (storageFailure) return storageFailure;
      logger.error({ error }, 'Image upload error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }
}
