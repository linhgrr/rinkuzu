import { fetchApiData } from '@/lib/api/client';

const UPLOAD_PROXY_URL = '/api/image/upload';

interface UploadResult {
  url: string;
  displayUrl: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
  id: string;
}

export const uploadImageToImgBB = async (
  imageFile: File | Blob,
  imageName: string = '',
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('image', imageFile, imageName || 'image.jpg');
  if (imageName) formData.append('name', imageName);

  return fetchApiData<UploadResult>(UPLOAD_PROXY_URL, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });
};
