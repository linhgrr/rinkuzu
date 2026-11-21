import { QuizImageError } from './quiz-image-error';

/**
 * On-device photo preparation (RIN-1782 c). A phone photo (4-12 MB, 4,000 px) is decoded,
 * turned upright from its EXIF orientation, resized and re-encoded as JPEG in the browser,
 * so five of them fit the 4.5 MB request-body cap of the web functions. Nothing here
 * uploads, stores or logs image data: the only thing that leaves is the returned blob.
 */

/** A photo larger than this is refused before any work is done. */
export const QUIZ_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const QUIZ_IMAGE_MAX_COUNT = 5;
/** Each prepared photo aims at this many bytes or fewer. */
export const QUIZ_IMAGE_TARGET_BYTES = 800 * 1024;
/** All prepared photos of one draft together: 5 x 800 KB, under the 4.5 MB body cap. */
export const QUIZ_IMAGE_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const QUIZ_IMAGE_MAX_EDGE = 2000;
const FALLBACK_EDGE = 1600;
const THUMBNAIL_EDGE = 240;
/** Photos prepared at once; a low-end phone runs out of memory above this. */
const PREPARE_CONCURRENCY = 2;

/** Encode attempts, best quality first, until one is within `QUIZ_IMAGE_TARGET_BYTES`. */
const ENCODE_STEPS: readonly { edge: number; quality: number }[] = [
  { edge: QUIZ_IMAGE_MAX_EDGE, quality: 0.85 },
  { edge: QUIZ_IMAGE_MAX_EDGE, quality: 0.7 },
  { edge: FALLBACK_EDGE, quality: 0.85 },
  { edge: FALLBACK_EDGE, quality: 0.7 },
];

const SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const SUPPORTED_EXTENSION = /\.(jpe?g|png|heic|heif|webp)$/i;

export interface PreparedQuizImage {
  /** JPEG, upright, long edge at most 2,000 px. */
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /**
   * Object URL of a ~240 px version for the photo list. The caller owns it and must call
   * `URL.revokeObjectURL` when the photo is removed or the list unmounts.
   */
  readonly thumbnailUrl: string;
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Surface {
  readonly context: Context2D;
  encode(quality: number): Promise<Blob>;
}

interface DecodedImage {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  release(): void;
}

/** Phones often send an empty or generic MIME type, so the extension counts too. */
function isSupportedType(file: File): boolean {
  return SUPPORTED_MIME.has(file.type.toLowerCase()) || SUPPORTED_EXTENSION.test(file.name);
}

function assertAccepted(file: File, fileIndex?: number): void {
  if (!isSupportedType(file)) throw new QuizImageError('unsupported_type', fileIndex);
  if (file.size > QUIZ_IMAGE_MAX_INPUT_BYTES) throw new QuizImageError('too_large', fileIndex);
}

async function decodeWithBitmap(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const release = () => URL.revokeObjectURL(url);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Current browsers apply the EXIF orientation to <img> and to drawImage of it.
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release };
  } catch (error) {
    release();
    throw error;
  }
}

async function decode(file: File, fileIndex?: number): Promise<DecodedImage> {
  let decoded: DecodedImage | undefined;
  if (typeof createImageBitmap === 'function') {
    decoded = await decodeWithBitmap(file).catch(() => undefined);
  }
  if (!decoded && typeof Image === 'function') {
    decoded = await decodeWithImageElement(file).catch(() => undefined);
  }
  if (!decoded || decoded.width < 1 || decoded.height < 1) {
    decoded?.release();
    throw new QuizImageError('undecodable', fileIndex);
  }
  return decoded;
}

function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context) {
      return {
        context,
        encode: (quality) => canvas.convertToBlob({ type: 'image/jpeg', quality }),
      };
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new QuizImageError('undecodable');
  return {
    context,
    encode: (quality) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new QuizImageError('undecodable'))),
          'image/jpeg',
          quality,
        );
      }),
  };
}

/** Long edge capped at `maxEdge`, never upscaled, both sides at least 1 px. */
function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawScaled(
  image: DecodedImage,
  maxEdge: number,
): Surface & { size: { width: number; height: number } } {
  const size = fitWithin(image.width, image.height, maxEdge);
  const surface = createSurface(size.width, size.height);
  // JPEG has no alpha: a transparent PNG would turn black without a white ground.
  surface.context.fillStyle = '#ffffff';
  surface.context.fillRect(0, 0, size.width, size.height);
  surface.context.imageSmoothingQuality = 'high';
  surface.context.drawImage(image.source, 0, 0, size.width, size.height);
  return { ...surface, size };
}

async function encodeWithinTarget(image: DecodedImage) {
  let drawnEdge = 0;
  let drawn: ReturnType<typeof drawScaled> | undefined;
  let last: { blob: Blob; width: number; height: number } | undefined;
  for (const step of ENCODE_STEPS) {
    // Both 2,000 px steps share one drawing; only the 1,600 px steps draw again.
    if (!drawn || drawnEdge !== step.edge) {
      drawn = drawScaled(image, step.edge);
      drawnEdge = step.edge;
    }
    const blob = await drawn.encode(step.quality);
    last = { blob, ...drawn.size };
    if (blob.size <= QUIZ_IMAGE_TARGET_BYTES) break;
  }
  if (!last) throw new QuizImageError('undecodable');
  return last;
}

async function makeThumbnail(image: DecodedImage): Promise<string> {
  const blob = await drawScaled(image, THUMBNAIL_EDGE).encode(0.7);
  return URL.createObjectURL(blob);
}

/**
 * Prepares one photo: JPEG, PNG, HEIC/HEIF or WebP up to 10 MB in; upright JPEG of at most
 * 2,000 px on the long edge (never upscaled) and about 800 KB out. A file the browser
 * cannot decode (HEIC on desktop Chrome/Firefox and most Android) is `undecodable`.
 * The caller revokes `thumbnailUrl`.
 */
export async function prepareQuizImage(file: File, fileIndex?: number): Promise<PreparedQuizImage> {
  assertAccepted(file, fileIndex);
  const image = await decode(file, fileIndex);
  try {
    const { blob, width, height } = await encodeWithinTarget(image);
    const thumbnailUrl = await makeThumbnail(image);
    return { blob, width, height, bytes: blob.size, thumbnailUrl };
  } catch (error) {
    // A canvas that cannot be made or encoded (out of memory) is a photo we cannot use.
    throw error instanceof QuizImageError ? error : new QuizImageError('undecodable', fileIndex);
  } finally {
    image.release();
  }
}

function revokeAll(prepared: readonly (PreparedQuizImage | undefined)[]): void {
  for (const photo of prepared) if (photo) URL.revokeObjectURL(photo.thumbnailUrl);
}

/** Runs `task` over `items`, `limit` at a time, results in input order; stops at the first error. */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<{ results: (R | undefined)[]; error: unknown }> {
  const results: (R | undefined)[] = new Array(items.length).fill(undefined);
  let next = 0;
  let failure: { error: unknown } | undefined;
  const worker = async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await task(items[index] as T, index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return { results, error: failure?.error };
}

/**
 * Prepares the photos a learner just picked. `existingCount` and `existingBytes` describe
 * the photos already in the list, so the 5-photo and 4 MB limits apply to the whole set.
 * At most two photos are prepared at once. On any error the thumbnails already made are
 * revoked and nothing is returned. Results keep the order of `files`.
 */
export async function prepareQuizImages(
  files: readonly File[],
  existingCount: number,
  existingBytes = 0,
): Promise<PreparedQuizImage[]> {
  if (existingCount + files.length > QUIZ_IMAGE_MAX_COUNT) throw new QuizImageError('too_many');
  // Cheap checks for every photo first, so a bad one costs no decoding.
  files.forEach((file, index) => assertAccepted(file, index));

  const { results, error } = await mapWithLimit(files, PREPARE_CONCURRENCY, (file, index) =>
    prepareQuizImage(file, index),
  );
  if (error) {
    revokeAll(results);
    throw error;
  }
  const prepared = results.filter((photo): photo is PreparedQuizImage => photo !== undefined);
  const total = prepared.reduce((sum, photo) => sum + photo.bytes, existingBytes);
  if (total > QUIZ_IMAGE_MAX_TOTAL_BYTES) {
    revokeAll(prepared);
    throw new QuizImageError('total_too_large');
  }
  return prepared;
}
