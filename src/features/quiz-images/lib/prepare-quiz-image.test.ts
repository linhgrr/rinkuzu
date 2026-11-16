import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareQuizImage, prepareQuizImages } from './prepare-quiz-image';
import { QuizImageError } from './quiz-image-error';

// jsdom has neither createImageBitmap nor canvas encoding, so both are stubbed. `encoded`
// records every encode so the quality steps can be asserted; `sizeFor` decides how big the
// blob is for a given canvas size and quality.
interface Encode {
  width: number;
  height: number;
  quality: number;
}
let encoded: Encode[];
let sizeFor: (e: Encode) => number;
let decodedSize: { width: number; height: number } | null;
let bitmapCalls: unknown[][];
let revoked: string[];
let inFlight: number;
let maxInFlight: number;

class FakeOffscreenCanvas {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  getContext() {
    return {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
      imageSmoothingQuality: 'low',
    };
  }
  async convertToBlob({ quality }: { type: string; quality: number }) {
    const e = { width: this.width, height: this.height, quality };
    encoded.push(e);
    return new Blob([new Uint8Array(sizeFor(e))], { type: 'image/jpeg' });
  }
}

const file = (name: string, type: string, bytes = 1000) =>
  new File([new Uint8Array(bytes)], name, { type });

beforeEach(() => {
  encoded = [];
  revoked = [];
  bitmapCalls = [];
  inFlight = 0;
  maxInFlight = 0;
  decodedSize = { width: 4032, height: 3024 };
  sizeFor = () => 300_000;
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  vi.stubGlobal('createImageBitmap', async (...args: unknown[]) => {
    bitmapCalls.push(args);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    if (!decodedSize) throw new DOMException('cannot decode', 'InvalidStateError');
    return { ...decodedSize, close: vi.fn() };
  });
  let n = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:thumb-${n++}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function reasonOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(QuizImageError);
  return (error as QuizImageError).reason;
}

describe('prepareQuizImage', () => {
  it('shrinks a 4,032 x 3,024 photo to a 2,000 px long edge and asks for the EXIF orientation', async () => {
    const photo = await prepareQuizImage(file('IMG_1.jpg', 'image/jpeg'));
    expect(photo.width).toBe(2000);
    expect(photo.height).toBe(1500);
    expect(photo.bytes).toBe(300_000);
    expect(photo.blob.type).toBe('image/jpeg');
    expect(bitmapCalls[0]?.[1]).toEqual({ imageOrientation: 'from-image' });
    expect(encoded[0]).toEqual({ width: 2000, height: 1500, quality: 0.85 });
  });

  it('keeps a portrait photo portrait (EXIF 6 arrives from the decoder as 3,024 x 4,032)', async () => {
    decodedSize = { width: 3024, height: 4032 };
    const photo = await prepareQuizImage(file('IMG_2.jpg', 'image/jpeg'));
    expect(photo.width).toBe(1500);
    expect(photo.height).toBe(2000);
  });

  it('never upscales a small photo', async () => {
    decodedSize = { width: 600, height: 400 };
    const photo = await prepareQuizImage(file('small.png', 'image/png'));
    expect([photo.width, photo.height]).toEqual([600, 400]);
  });

  it('steps down to 0.7 and then to a 1,600 px edge until it is within 800 KB', async () => {
    sizeFor = ({ width, quality }) =>
      width === 2000 ? 900_000 : quality === 0.85 ? 850_000 : 700_000;
    const photo = await prepareQuizImage(file('big.jpg', 'image/jpeg'));
    expect(encoded.slice(0, -1).map((e) => [e.width, e.quality])).toEqual([
      [2000, 0.85],
      [2000, 0.7],
      [1600, 0.85],
      [1600, 0.7],
    ]);
    expect(photo.bytes).toBe(700_000);
    expect(photo.width).toBe(1600);
    expect(photo.height).toBe(1200);
  });

  it('stops at the first encode within the limit', async () => {
    sizeFor = ({ quality }) => (quality === 0.85 ? 900_000 : 500_000);
    const photo = await prepareQuizImage(file('a.jpg', 'image/jpeg'));
    expect(encoded).toHaveLength(2 + 1); // two attempts for the photo, one for the thumbnail
    expect(photo.bytes).toBe(500_000);
  });

  it('returns a ~240 px thumbnail object URL the caller revokes', async () => {
    const photo = await prepareQuizImage(file('a.jpg', 'image/jpeg'));
    expect(photo.thumbnailUrl).toMatch(/^blob:thumb-/);
    expect(encoded.at(-1)).toMatchObject({ width: 240, height: 180 });
    expect(revoked).toEqual([]);
  });

  it.each([
    ['a phone that sends no type', 'IMG_3.JPG', ''],
    ['a generic type', 'IMG_4.heic', 'application/octet-stream'],
    ['HEIC by type', 'photo', 'image/heic'],
    ['HEIF by extension', 'x.HEIF', ''],
    ['WebP', 'x.webp', 'image/webp'],
  ])('accepts %s', async (_label, name, type) => {
    await expect(prepareQuizImage(file(name, type))).resolves.toMatchObject({ width: 2000 });
  });

  it('refuses a GIF as unsupported_type without decoding it', async () => {
    expect(await reasonOf(prepareQuizImage(file('a.gif', 'image/gif')))).toBe('unsupported_type');
    expect(await reasonOf(prepareQuizImage(file('notes.pdf', 'application/pdf')))).toBe(
      'unsupported_type',
    );
    expect(bitmapCalls).toHaveLength(0);
  });

  it('refuses a file over 10 MB as too_large', async () => {
    const big = file('big.jpg', 'image/jpeg', 11 * 1024 * 1024);
    expect(await reasonOf(prepareQuizImage(big))).toBe('too_large');
    expect(bitmapCalls).toHaveLength(0);
  });

  it('accepts a file of exactly 10 MB', async () => {
    const edge = file('edge.jpg', 'image/jpeg', 10 * 1024 * 1024);
    await expect(prepareQuizImage(edge)).resolves.toMatchObject({ width: 2000 });
  });

  it('reports a file the browser cannot decode as undecodable, not a crash', async () => {
    decodedSize = null;
    vi.stubGlobal('Image', undefined);
    expect(await reasonOf(prepareQuizImage(file('a.heic', 'image/heic')))).toBe('undecodable');
  });

  it('reports a zero-size decode as undecodable', async () => {
    decodedSize = { width: 0, height: 0 };
    vi.stubGlobal('Image', undefined);
    expect(await reasonOf(prepareQuizImage(file('a.jpg', 'image/jpeg')))).toBe('undecodable');
  });

  it('falls back to an <img> and decode() when createImageBitmap is missing', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    class FakeImage {
      naturalWidth = 3000;
      naturalHeight = 1000;
      src = '';
      decode = vi.fn(async () => undefined);
    }
    vi.stubGlobal('Image', FakeImage);
    const photo = await prepareQuizImage(file('a.jpg', 'image/jpeg'));
    expect([photo.width, photo.height]).toEqual([2000, 667]);
    // the temporary object URL for the <img> is revoked
    expect(revoked).toContain('blob:thumb-0');
  });

  it('falls back to an <img> when createImageBitmap rejects, and is undecodable if that fails too', async () => {
    decodedSize = null;
    class BrokenImage {
      src = '';
      decode = vi.fn(async () => {
        throw new DOMException('cannot decode', 'EncodingError');
      });
    }
    vi.stubGlobal('Image', BrokenImage);
    expect(await reasonOf(prepareQuizImage(file('a.heic', 'image/heic')))).toBe('undecodable');
    expect(revoked).toHaveLength(1);
  });

  it('fills a white ground so a transparent PNG does not turn black', async () => {
    const fills: string[] = [];
    class Recording extends FakeOffscreenCanvas {
      override getContext() {
        const context = super.getContext();
        return Object.defineProperty(context, 'fillStyle', {
          set: (v: string) => fills.push(v),
          get: () => '',
        });
      }
    }
    vi.stubGlobal('OffscreenCanvas', Recording);
    await prepareQuizImage(file('t.png', 'image/png'));
    expect(fills[0]).toBe('#ffffff');
  });

  it('uses a canvas element when OffscreenCanvas is missing', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
    const toBlob = vi.fn((cb: (b: Blob | null) => void, _type: string, quality: number) => {
      encoded.push({ width: 0, height: 0, quality });
      cb(new Blob([new Uint8Array(300_000)]));
    });
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => context, toBlob }),
    });
    const photo = await prepareQuizImage(file('a.jpg', 'image/jpeg'));
    expect(photo.bytes).toBe(300_000);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('turns an encode failure into undecodable', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
        toBlob: (cb: (b: Blob | null) => void) => cb(null),
      }),
    });
    expect(await reasonOf(prepareQuizImage(file('a.jpg', 'image/jpeg')))).toBe('undecodable');
  });
});

describe('prepareQuizImages', () => {
  const jpegs = (n: number) => Array.from({ length: n }, (_, i) => file(`p${i}.jpg`, 'image/jpeg'));

  it('prepares the photos in order, two at a time', async () => {
    const result = await prepareQuizImages(jpegs(5), 0);
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.thumbnailUrl)).toHaveLength(5);
    expect(maxInFlight).toBe(2);
  });

  it('keeps the input order even when later photos finish first', async () => {
    const sizes = [
      { width: 4000, height: 1000 },
      { width: 1000, height: 4000 },
      { width: 800, height: 600 },
    ];
    let call = 0;
    vi.stubGlobal('createImageBitmap', async () => {
      const size = sizes[call++] as { width: number; height: number };
      await new Promise((resolve) => setTimeout(resolve, size.width === 4000 ? 30 : 1));
      return { ...size, close: vi.fn() };
    });
    const result = await prepareQuizImages(jpegs(3), 0);
    expect(result.map((p) => [p.width, p.height])).toEqual([
      [2000, 500],
      [500, 2000],
      [800, 600],
    ]);
  });

  it('counts the photos already in the list: a sixth is too_many', async () => {
    expect(await reasonOf(prepareQuizImages(jpegs(2), 4))).toBe('too_many');
    expect(await reasonOf(prepareQuizImages(jpegs(6), 0))).toBe('too_many');
    expect(bitmapCalls).toHaveLength(0);
    await expect(prepareQuizImages(jpegs(1), 4)).resolves.toHaveLength(1);
  });

  it('checks type and size of every photo before decoding any, and names the photo', async () => {
    const files = [
      file('a.jpg', 'image/jpeg'),
      file('b.gif', 'image/gif'),
      file('c.jpg', 'image/jpeg'),
    ];
    const error = await prepareQuizImages(files, 0).catch((e: unknown) => e);
    expect(error).toMatchObject({ reason: 'unsupported_type', fileIndex: 1 });
    expect(bitmapCalls).toHaveLength(0);
  });

  it('refuses a set over 4 MB as total_too_large and revokes the thumbnails it made', async () => {
    // photos that cannot be squeezed under 800 KB: five of them overflow the 4 MB
    sizeFor = () => 900_000;
    expect(await reasonOf(prepareQuizImages(jpegs(5), 0))).toBe('total_too_large');
    // five thumbnails were created for the photos (the 240 px encodes use the same stub size)
    expect(revoked).toHaveLength(5);
  });

  it('counts the bytes of photos already in the list toward the 4 MB', async () => {
    sizeFor = () => 300_000;
    await expect(prepareQuizImages(jpegs(1), 4, 3 * 1024 * 1024)).resolves.toHaveLength(1);
    expect(await reasonOf(prepareQuizImages(jpegs(1), 4, 4 * 1024 * 1024 - 100))).toBe(
      'total_too_large',
    );
  });

  it('revokes finished thumbnails and stops starting new photos when one is undecodable', async () => {
    let call = 0;
    vi.stubGlobal('createImageBitmap', async () => {
      const n = call++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (n === 1) throw new DOMException('cannot decode', 'InvalidStateError');
      return { width: 800, height: 600, close: vi.fn() };
    });
    vi.stubGlobal('Image', undefined);
    const error = await prepareQuizImages(jpegs(5), 0).catch((e: unknown) => e);
    expect(error).toMatchObject({ reason: 'undecodable', fileIndex: 1 });
    expect(call).toBeLessThan(5);
    expect(revoked.length).toBeGreaterThan(0);
  });

  it('accepts an empty list as nothing to prepare', async () => {
    await expect(prepareQuizImages([], 0)).resolves.toEqual([]);
  });
});
