import type { ImageAssetDto } from '@/dtos/image';
import type { IImageService, UploadImageData } from '@/interfaces/services/IImageService';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
  type IImageStorage,
} from '@/interfaces/services/IImageStorage';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';

export class ImageService implements IImageService {
  constructor(private readonly imageStorage: IImageStorage) {}

  async uploadImage(image: UploadImageData): Promise<ServiceResult<ImageAssetDto>> {
    try {
      return {
        success: true,
        data: await this.imageStorage.upload(image),
      };
    } catch (error) {
      if (error instanceof ImageStorageConfigurationError) {
        return { success: false, error: error.message, statusCode: 500 };
      }
      if (error instanceof ImageStorageUpstreamError) {
        return { success: false, error: error.message, statusCode: 502 };
      }
      logger.error({ error }, 'Image upload error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }
}
