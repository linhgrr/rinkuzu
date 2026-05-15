const API_URL = 'https://api.imgbb.com/1/upload';
const API_KEY = '***REMOVED***';

interface ImgBBResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: number;
    expiration: number;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

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
  try {
    console.warn(`Uploading image "${imageName}" to ImgBB...`);

    const formData = new FormData();
    formData.append('key', API_KEY);

    if (imageFile instanceof Buffer) {
      const bytes = Uint8Array.from(imageFile);
      const blob = new Blob([bytes.buffer], { type: 'image/jpeg' });
      formData.append('image', blob, imageName || 'quiz-image.jpg');
    } else {
      const browserFile = imageFile as Blob;
      formData.append('image', browserFile, imageName || 'quiz-image.jpg');
    }

    if (imageName) {
      formData.append('name', imageName);
    }

    const response = await fetch(API_URL, {
      // EXTERNAL: ImgBB multipart upload
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
    const responseData = (await response.json()) as ImgBBResponse;

    if (!response.ok || !responseData.success) {
      throw new Error(`ImgBB upload failed: ${JSON.stringify(responseData)}`);
    }

    const d = responseData.data as ImgBBResponse['data'];
    const result: UploadResult = {
      url: d.url ?? d.display_url,
      displayUrl: d.display_url ?? d.url,
      thumbnailUrl: d.thumb?.url ?? d.display_url ?? d.url,
      mediumUrl: d.medium?.url,
      deleteUrl: d.delete_url,
      width: d.width,
      height: d.height,
      size: d.size,
      id: d.id,
    };

    console.warn(`Image uploaded successfully: ${result.displayUrl}`);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';

    console.error('ImgBB upload failed:', message);
    throw new Error(`Failed to upload image to ImgBB: ${message}`);
  }
};
