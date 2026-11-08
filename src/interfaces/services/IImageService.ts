import type { ImageAssetDto } from '@/dtos/image';
import type { ImageKind } from '@/interfaces/services/IImageStorage';
import type { ServiceResult } from '@/interfaces/services/types';

export interface UploadImageData {
  kind: ImageKind;
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

export interface IImageService {
  uploadImage(image: UploadImageData): Promise<ServiceResult<ImageAssetDto>>;
}
