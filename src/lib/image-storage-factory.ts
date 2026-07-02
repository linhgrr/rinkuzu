import { ImgBbImageStorage } from '@/lib/integrations/imgbb';

const imageStorage = new ImgBbImageStorage();

export function getImageStorage(): ImgBbImageStorage {
  return imageStorage;
}
