import { createSerwistRoute } from '@serwist/turbopack';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
    globPatterns: [
      '.next/static/**/*.{js,css,html,json,webmanifest}',
      'public/icons/**/*.{png,svg,ico,webp}',
      'public/favicon.ico',
      'public/manifest.json',
      'public/browserconfig.xml',
    ],
  },
);
