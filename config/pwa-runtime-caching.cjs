const publicAssetPrefixes = ['/images/', '/icons/', '/fonts/', '/models/', '/hdri/'];

const isSameOriginStaticAsset = ({ url, sameOrigin }) =>
  sameOrigin &&
  (url.pathname.startsWith('/_next/static/') ||
    publicAssetPrefixes.some((prefix) => url.pathname.startsWith(prefix)) ||
    ['/favicon.ico', '/manifest.json', '/browserconfig.xml'].includes(url.pathname));

module.exports = [
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com(?:\/|$)/,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'google-fonts-stylesheets',
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com(?:\/|$)/,
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts-webfonts',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      },
    },
  },
  {
    urlPattern: isSameOriginStaticAsset,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'public-static-assets',
      expiration: {
        maxEntries: 96,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      },
    },
  },
];
