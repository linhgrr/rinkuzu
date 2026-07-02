import { ImageService } from '@/services/image/ImageService';
import { getImageStorage } from '@/lib/image-storage-factory';

let imageService: ImageService | undefined;

export function getImageService(): ImageService {
  imageService ??= new ImageService(getImageStorage());
  return imageService;
}
