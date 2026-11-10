import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getBlogArticle, getBlogArticleSlugs, toBlogLocale } from '@/lib/blog/posts';

type Context = { params: Promise<{ locale: string; slug: string }> };

// Same cadence as the post page (RIN-1329): a static image per post, rebuilt at
// most hourly, so a scheduled post gets its card on its publication day.
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return getBlogArticleSlugs().map((slug) => ({ slug }));
}

const SIZE = { width: 1200, height: 630 };
const FONT_FAMILY = 'Be Vietnam Pro';
const MINT = '#34d399';
const LIGHT_MINT = '#e9fdf4';

// Be Vietnam Pro covers every Vietnamese diacritic; the bundled next/og font
// does not. Traced into the function by `outputFileTracingIncludes`.
const loadFont = (): Promise<Buffer> =>
  readFile(path.join(process.cwd(), 'assets/fonts/BeVietnamPro-Bold.ttf'));

/** Smaller type for longer titles, so up to about 110 characters fit in four lines. */
const titleFontSize = (title: string): number => {
  if (title.length <= 45) return 68;
  if (title.length <= 75) return 58;
  return 48;
};

/**
 * `/<locale>/blog/<slug>/og.png`: the generated 1200x630 share card of a post
 * (RIN-1330), with its title, category and the RinKuzu mark. Used by
 * `generateMetadata` when the post has no frontmatter `ogImage`.
 */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { locale, slug } = await params;
  const article = getBlogArticle(toBlogLocale(locale), slug);
  if (!article) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 80px',
        background: 'linear-gradient(135deg, #0b1f16 0%, #0f2a1e 45%, #002b6b 100%)',
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: MINT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#06281b',
            fontSize: 38,
          }}
        >
          R
        </div>
        <span style={{ color: LIGHT_MINT, fontSize: 34 }}>RinKuzu Blog</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <span style={{ color: MINT, fontSize: 26, textTransform: 'uppercase', letterSpacing: 3 }}>
          {article.category}
        </span>
        <span
          style={{
            color: '#ffffff',
            fontSize: titleFontSize(article.title),
            lineHeight: 1.2,
            maxWidth: 1040,
          }}
        >
          {article.title}
        </span>
      </div>

      <span style={{ color: '#9fb6cd', fontSize: 26 }}>rinkuzu.app/blog</span>
    </div>,
    {
      ...SIZE,
      fonts: [{ name: FONT_FAMILY, data: await loadFont(), weight: 700, style: 'normal' }],
    },
  );
}
