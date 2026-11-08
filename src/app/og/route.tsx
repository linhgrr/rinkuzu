import { ImageResponse } from 'next/og';
import { parseOgParams } from './parse-og-params';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };
const LIGHT_MINT = '#e9fdf4';

export function GET(request: Request): ImageResponse {
  const { searchParams } = new URL(request.url);
  const { title, eyebrow, detail } = parseOgParams(searchParams);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'linear-gradient(135deg, #0b1f16 0%, #0f2a1e 45%, #002b6b 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#06281b',
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          R
        </div>
        <span style={{ color: LIGHT_MINT, fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
          RinKuzu
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <span
          style={{
            color: '#34d399',
            fontSize: 26,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 4,
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            color: '#ffffff',
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {title}
        </span>
        {detail ? (
          <span style={{ color: LIGHT_MINT, fontSize: 34, fontWeight: 600 }}>{detail}</span>
        ) : null}
      </div>

      <span style={{ color: '#9fb6cd', fontSize: 28, fontWeight: 500 }}>
        rinkuzu.app · Powered by Gemini AI
      </span>
    </div>,
    SIZE,
  );
}
