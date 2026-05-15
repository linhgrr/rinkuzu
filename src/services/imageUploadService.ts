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
  imageFile: File | Buffer | Blob,
  imageName: string = '',
): Promise<UploadResult> => {
  const formData = new FormData();

  if (imageFile instanceof Buffer) {
    const blob = new Blob([imageFile], { type: 'image/jpeg' });
    formData.append('image', blob, imageName || 'image.jpg');
  } else {
    formData.append('image', imageFile as Blob, imageName || 'image.jpg');
  }

  if (imageName) {
    formData.append('name', imageName);
  }

  const response = await fetch(UPLOAD_PROXY_URL, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await response.json()) as {
    success: boolean;
    data?: UploadResult;
    error?: { message: string };
  };

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? 'Image upload failed');
  }

  return json.data;
};
