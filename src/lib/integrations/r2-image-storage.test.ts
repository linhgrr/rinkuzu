import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
  ImageStorageConfigurationError,
  ImageStorageInvalidImageError,
  ImageStorageUpstreamError,
} from '@/interfaces/services/IImageStorage';
import {
  type ImageObjectClient,
  R2ImageStorage,
  type R2ImageStorageConfig,
} from '@/lib/integrations/r2-image-storage';

const BASE_URL = 'https://cdn.example.test';
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const config: R2ImageStorageConfig = { bucket: 'images-bucket', publicBaseUrl: BASE_URL };

function solid(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  });
}

async function jpegWithExif(): Promise<Uint8Array> {
  // Orientation 6 = rotate 90° clockwise on display; the stored image must be upright.
  return solid(40, 20)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Copyright: 'Fake Person', Artist: 'Fake Camera' } })
    .toBuffer();
}

async function animatedGif(): Promise<Uint8Array> {
  const frame = await solid(10, 10).raw().toBuffer();
  const frames = Buffer.concat([frame, Buffer.alloc(frame.length, 255)]);
  return sharp(frames, { raw: { width: 10, height: 20, channels: 3, pageHeight: 10 } })
    .gif({ loop: 0, delay: [100, 100] })
    .toBuffer();
}

type SendMock = Mock<ImageObjectClient['send']>;

function sentCommand<T>(send: SendMock, type: new (...args: never[]) => T): T {
  const command: unknown = send.mock.calls[0]?.[0];
  expect(command).toBeInstanceOf(type);
  return command as T;
}

describe('R2ImageStorage', () => {
  let send: SendMock;
  let storage: R2ImageStorage;

  beforeEach(() => {
    send = vi.fn<ImageObjectClient['send']>().mockResolvedValue({});
    storage = new R2ImageStorage({
      client: { send },
      config,
      now: () => new Date('2026-11-06T10:00:00Z'),
      newId: () => ID,
    });
  });

  it('stores a JPEG under images/<kind>/<yyyy>/ with immutable caching and no EXIF', async () => {
    const result = await storage.upload({
      kind: 'question',
      bytes: await jpegWithExif(),
      contentType: 'image/jpeg',
      filename: 'photo.jpg',
    });

    const key = `images/question/2026/${ID}.jpg`;
    const put = sentCommand(send, PutObjectCommand);
    expect(put.input).toMatchObject({
      Bucket: 'images-bucket',
      Key: key,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const body = put.input.Body as Buffer;
    const metadata = await sharp(body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect([metadata.width, metadata.height]).toEqual([20, 40]);

    expect(result).toEqual({
      id: key,
      url: `${BASE_URL}/${key}`,
      displayUrl: `${BASE_URL}/${key}`,
      thumbnailUrl: `${BASE_URL}/${key}`,
      deleteUrl: `${BASE_URL}/${key}`,
      width: 20,
      height: 40,
      size: body.byteLength,
    });
  });

  it('uses the decoded format, not the declared MIME, and keeps GIF animation', async () => {
    const png = await solid(8, 8).png().toBuffer();
    await storage.upload({
      kind: 'avatar',
      bytes: png,
      contentType: 'image/jpeg',
      filename: 'avatar',
    });
    expect(sentCommand(send, PutObjectCommand).input).toMatchObject({
      Key: `images/avatar/2026/${ID}.png`,
      ContentType: 'image/png',
    });

    send.mockClear();
    const result = await storage.upload({
      kind: 'question',
      bytes: await animatedGif(),
      contentType: 'image/gif',
      filename: 'a.gif',
    });
    const body = sentCommand(send, PutObjectCommand).input.Body as Buffer;
    const metadata = await sharp(body, { animated: true }).metadata();
    expect(metadata.format).toBe('gif');
    expect(metadata.pages).toBe(2);
    expect([result.width, result.height]).toEqual([10, 10]);
  });

  it.each([
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')],
    ['text renamed .png', Buffer.from('definitely not an image')],
  ])('rejects %s without writing to storage', async (_label, bytes) => {
    await expect(
      storage.upload({ kind: 'question', bytes, contentType: 'image/png', filename: 'x.png' }),
    ).rejects.toBeInstanceOf(ImageStorageInvalidImageError);
    expect(send).not.toHaveBeenCalled();
  });

  it('maps a failed PutObject to an upstream error', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(
      storage.upload({
        kind: 'question',
        bytes: await solid(4, 4).png().toBuffer(),
        contentType: 'image/png',
        filename: 'x.png',
      }),
    ).rejects.toBeInstanceOf(ImageStorageUpstreamError);
  });

  it.each([
    { bucket: undefined, publicBaseUrl: BASE_URL },
    { bucket: 'images-bucket', publicBaseUrl: undefined },
  ])('fails closed when configuration is missing (%o)', async (missing) => {
    const unconfigured = new R2ImageStorage({ client: { send }, config: missing });
    await expect(
      unconfigured.upload({
        kind: 'avatar',
        bytes: await solid(4, 4).png().toBuffer(),
        contentType: 'image/png',
        filename: 'a',
      }),
    ).rejects.toBeInstanceOf(ImageStorageConfigurationError);
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes owned image URLs and treats a missing object as deleted', async () => {
    const url = `${BASE_URL}/images/avatar/2026/${ID}.webp`;
    await storage.deleteByUrl(url);
    expect(sentCommand(send, DeleteObjectCommand).input).toEqual({
      Bucket: 'images-bucket',
      Key: `images/avatar/2026/${ID}.webp`,
    });

    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'NoSuchKey' }));
    await expect(storage.deleteByUrl(url)).resolves.toBeUndefined();

    send.mockRejectedValueOnce(new Error('network'));
    await expect(storage.deleteByUrl(url)).rejects.toBeInstanceOf(ImageStorageUpstreamError);
  });

  it.each([
    'https://i.ibb.co/abc123/photo.png',
    'https://ibb.co/delete/abc123',
    `https://evil.example/images/question/2026/${ID}.png`,
    `${BASE_URL}/premium/assets/${ID}.png`,
    `${BASE_URL}/images/question/2026/../../premium/${ID}.png`,
    `${BASE_URL}.evil.example/images/question/2026/${ID}.png`,
    '',
  ])('ignores foreign or malformed URL %s', async (url) => {
    await storage.deleteByUrl(url);
    expect(send).not.toHaveBeenCalled();
  });
});
