import type { IImageStorage } from '@/interfaces/services/IImageStorage';
import { env } from '@/lib/env';
import { R2ImageStorage } from '@/lib/integrations/r2-image-storage';
import { s3Client } from '@/lib/s3';

const imageStorage = new R2ImageStorage({
  client: { send: (command) => s3Client.send(command) },
  config: {
    bucket: env.IMAGE_STORAGE_BUCKET,
    publicBaseUrl: env.IMAGE_PUBLIC_BASE_URL,
  },
});

export function getImageStorage(): IImageStorage {
  return imageStorage;
}
