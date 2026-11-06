import { fetchApiData } from '@/lib/api/client';
import type { ImageAssetDto } from '@/dtos/image';

const UPLOAD_PROXY_URL = '/api/image/upload';

export const uploadImage = async (
  imageFile: File | Blob,
  imageName: string = '',
): Promise<ImageAssetDto> => {
  const formData = new FormData();
  formData.append('image', imageFile, imageName || 'image.jpg');
  if (imageName) formData.append('name', imageName);

  return fetchApiData<ImageAssetDto>(UPLOAD_PROXY_URL, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });
};
