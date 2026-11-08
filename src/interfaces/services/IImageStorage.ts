/** Which product surface the image belongs to; it becomes part of the stored object key. */
export type ImageKind = 'question' | 'avatar';

export interface ImageUpload {
  kind: ImageKind;
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

/** The bytes are not a supported raster image (JPEG, PNG, WebP or GIF). */
export class ImageStorageInvalidImageError extends Error {
  constructor(message = 'File must be an image') {
    super(message);
    this.name = 'ImageStorageInvalidImageError';
  }
}

export interface IImageStorage {
  upload(image: ImageUpload): Promise<ImageUploadResult>;
  /**
   * Optional best-effort remote delete when the provider delete URL is known.
   * Implementations must be idempotent for already-deleted resources when possible
   * and must not require Mongo transaction participation.
   */
  deleteByUrl?(deleteUrl: string): Promise<void>;
}
