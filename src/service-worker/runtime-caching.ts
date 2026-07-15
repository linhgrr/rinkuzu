import { CacheFirst, ExpirationPlugin, StaleWhileRevalidate, type RuntimeCaching } from 'serwist';

const publicAssetPrefixes = ['/images/', '/icons/', '/fonts/', '/models/', '/hdri/'];

const isSameOriginStaticAsset: RuntimeCaching['matcher'] = ({ url, sameOrigin }) =>
  sameOrigin &&
  (url.pathname.startsWith('/_next/static/') ||
    publicAssetPrefixes.some((prefix) => url.pathname.startsWith(prefix)) ||
    ['/favicon.ico', '/manifest.json', '/browserconfig.xml'].includes(url.pathname));

export const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: /^https:\/\/fonts\.googleapis\.com(?:\/|$)/,
    handler: new StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
    }),
  },
  {
    matcher: /^https:\/\/fonts\.gstatic\.com(?:\/|$)/,
    handler: new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        }),
      ],
    }),
  },
  {
    matcher: isSameOriginStaticAsset,
    handler: new StaleWhileRevalidate({
      cacheName: 'public-static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 96,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
];
