import { describe, expect, it } from 'vitest';
import { buildLocalizedMetadata, siteUrl } from './seo';

function imageUrlOf(metadata: ReturnType<typeof buildLocalizedMetadata>): string {
  const images = metadata.openGraph?.images;
  const first = Array.isArray(images) ? images[0] : images;
  return typeof first === 'object' && first !== null && 'url' in first
    ? String(first.url)
    : String(first);
}

const base = {
  locale: 'vi',
  path: '/quiz/biology-basics',
  title: 'Biology basics | RinKuzu',
  description: 'Cells',
};

describe('buildLocalizedMetadata OG image (RIN-1180)', () => {
  it('keeps the title-only image path when no extra params are passed', () => {
    expect(imageUrlOf(buildLocalizedMetadata(base))).toBe(
      `${siteUrl.origin}/og?title=Biology%20basics%20%7C%20RinKuzu`,
    );
  });

  it('appends extra OG params after the title', () => {
    const metadata = buildLocalizedMetadata({
      ...base,
      ogImageParams: { count: '42', lang: 'vi', quick: '1' },
    });

    expect(imageUrlOf(metadata)).toBe(
      `${siteUrl.origin}/og?title=Biology%20basics%20%7C%20RinKuzu&count=42&lang=vi&quick=1`,
    );
    expect(metadata.twitter).toMatchObject({ images: [imageUrlOf(metadata)] });
    expect(metadata.openGraph?.url).toBe(`${siteUrl.origin}/vi/quiz/biology-basics`);
  });
});
