import type { ImageAssetDto } from '@/dtos/image';
import type { ServiceResult } from '@/interfaces/services/types';

export interface UploadImageData {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

export interface IImageService {
  uploadImage(image: UploadImageData): Promise<ServiceResult<ImageAssetDto>>;
}
