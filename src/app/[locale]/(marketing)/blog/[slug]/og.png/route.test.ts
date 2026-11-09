import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET, generateStaticParams, revalidate } from './route';

// RIN-1330: each blog post gets a generated 1200x630 share card from the real
// content in content/blog, with a font that covers Vietnamese.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const cardFor = (locale: string, slug: string): Promise<Response> =>
  GET(new Request(`https://example.test/${locale}/blog/${slug}/og.png`), {
    params: Promise.resolve({ locale, slug }),
  });

/** Width and height from the PNG IHDR chunk. */
const pngSize = (bytes: Uint8Array): { width: number; height: number } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describe('blog post share image route', () => {
  it('pre-renders one card per article, on the post page cadence', () => {
    expect(generateStaticParams()).toEqual(
      expect.arrayContaining([{ slug: 'cach-on-thi-trac-nghiem-hieu-qua' }]),
    );
    expect(revalidate).toBe(3600);
  });

  it.each([
    ['vi', 'cach-on-thi-trac-nghiem-hieu-qua'],
    ['en', 'how-personalized-quiz-difficulty-works'],
  ])('renders a 1200x630 PNG for /%s/blog/%s', async (locale, slug) => {
    const response = await cardFor(locale, slug);
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });

    // Set OG_CARD_DIR to look at the cards (PR evidence).
    if (process.env['OG_CARD_DIR']) {
      writeFileSync(path.join(process.env['OG_CARD_DIR'], `${locale}-${slug}.png`), bytes);
    }
  });

  it('returns 404 for a post that does not exist', async () => {
    expect((await cardFor('en', 'no-such-post')).status).toBe(404);
  });
});
