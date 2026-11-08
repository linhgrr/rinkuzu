import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp, { type Metadata } from 'sharp';
import {
  ImageStorageConfigurationError,
  ImageStorageInvalidImageError,
  ImageStorageUpstreamError,
  type IImageStorage,
  type ImageUpload,
  type ImageUploadResult,
} from '@/interfaces/services/IImageStorage';

const IMAGE_OBJECT_ROOT = 'images';
const MAX_INPUT_PIXELS = 40_000_000;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const OWNED_KEY_PATTERN =
  /^images\/(?:question|avatar)\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/;

const FORMATS = {
  jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
  png: { extension: 'png', contentType: 'image/png' },
  webp: { extension: 'webp', contentType: 'image/webp' },
  gif: { extension: 'gif', contentType: 'image/gif' },
} as const;
type SupportedFormat = keyof typeof FORMATS;

export interface R2ImageStorageConfig {
  /** Public image bucket; undefined until SRE configures it (uploads fail closed). */
  bucket: string | undefined;
  /** Public origin serving the bucket, without a trailing slash. */
  publicBaseUrl: string | undefined;
}

/** The two S3 calls the adapter makes; the factory adapts the shared `s3Client`. */
export interface ImageObjectClient {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

export interface R2ImageStorageDeps {
  client: ImageObjectClient;
  config: R2ImageStorageConfig;
  now?: () => Date;
  newId?: () => string;
}

interface NormalizedImage {
  body: Buffer;
  format: SupportedFormat;
  width: number;
  height: number;
}

function isSupportedFormat(format: string | undefined): format is SupportedFormat {
  return format !== undefined && Object.hasOwn(FORMATS, format);
}

/**
 * Decode the bytes, accept only raster JPEG/PNG/WebP/GIF, apply EXIF orientation and
 * re-encode in the same format. sharp drops all metadata (EXIF, GPS, ICC comments) unless
 * asked to keep it, so the stored object carries pixels only.
 */
async function normalizeImage(bytes: Uint8Array): Promise<NormalizedImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageStorageInvalidImageError();
  }
  const format = metadata.format;
  if (!isSupportedFormat(format) || !metadata.width || !metadata.height) {
    throw new ImageStorageInvalidImageError();
  }

  try {
    if (format === 'gif') {
      // GIFs carry no EXIF orientation; re-encode every frame to keep the animation.
      const { data, info } = await sharp(bytes, {
        animated: true,
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .gif()
        .toBuffer({ resolveWithObject: true });
      return {
        body: data,
        format,
        width: info.width,
        // Read without `animated`, metadata describes one frame; info.height stacks every frame.
        height: metadata.height,
      };
    }

    const pipeline = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    const encoded =
      format === 'jpeg'
        ? pipeline.jpeg({ quality: 90 })
        : format === 'png'
          ? pipeline.png()
          : pipeline.webp({ quality: 90 });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return { body: data, format, width: info.width, height: info.height };
  } catch {
    throw new ImageStorageInvalidImageError();
  }
}

/** Question images and avatars in the public R2 bucket served on `cdn.rinkuzu.app`. */
export class R2ImageStorage implements IImageStorage {
  private readonly client: ImageObjectClient;
  private readonly config: R2ImageStorageConfig;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(deps: R2ImageStorageDeps) {
    this.client = deps.client;
    this.config = deps.config;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? randomUUID;
  }

  private requireConfig(): { bucket: string; publicBaseUrl: string } {
    const { bucket, publicBaseUrl } = this.config;
    if (!bucket || !publicBaseUrl) throw new ImageStorageConfigurationError();
    return { bucket, publicBaseUrl };
  }

  async upload(image: ImageUpload): Promise<ImageUploadResult> {
    const { bucket, publicBaseUrl } = this.requireConfig();
    const normalized = await normalizeImage(image.bytes);
    const { extension, contentType } = FORMATS[normalized.format];
    const year = this.now().getUTCFullYear();
    const key = `${IMAGE_OBJECT_ROOT}/${image.kind}/${year}/${this.newId()}.${extension}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: normalized.body,
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        }),
      );
    } catch {
      throw new ImageStorageUpstreamError();
    }

    const url = `${publicBaseUrl}/${key}`;
    return {
      id: key,
      url,
      displayUrl: url,
      thumbnailUrl: url,
      deleteUrl: url,
      width: normalized.width,
      height: normalized.height,
      size: normalized.body.byteLength,
    };
  }

  /**
   * Delete an image this adapter stored. URLs outside `<publicBaseUrl>/images/` (other
   * hosts included) are no-ops; a missing object counts as deleted.
   */
  async deleteByUrl(deleteUrl: string): Promise<void> {
    const { bucket, publicBaseUrl } = this.config;
    if (!bucket || !publicBaseUrl || typeof deleteUrl !== 'string') return;
    const prefix = `${publicBaseUrl}/`;
    if (!deleteUrl.startsWith(prefix)) return;
    const key = deleteUrl.slice(prefix.length);
    if (!OWNED_KEY_PATTERN.test(key)) return;

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NoSuchKey' || name === 'NotFound') return;
      throw new ImageStorageUpstreamError('Image delete failed');
    }
  }
}
