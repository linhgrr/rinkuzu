export interface ImageUpload {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

export interface ImageUploadResult {
  id: string;
  url: string;
  displayUrl: string;
  thumbnailUrl: string;
  mediumUrl?: string;
  deleteUrl: string;
  width: number;
  height: number;
  size: number;
}

export class ImageStorageConfigurationError extends Error {
  constructor(message = 'Image upload not configured') {
    super(message);
    this.name = 'ImageStorageConfigurationError';
  }
}

export class ImageStorageUpstreamError extends Error {
  constructor(message = 'Image upload failed') {
    super(message);
    this.name = 'ImageStorageUpstreamError';
  }
}

export interface IImageStorage {
  upload(image: ImageUpload): Promise<ImageUploadResult>;
}
