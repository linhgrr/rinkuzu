const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function requireOriginEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  const raw = value.trim();

  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).origin;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

const objectStorageConnectOrigin = requireOriginEnv('OBJECT_STORAGE_ENDPOINT_EXTERNAL');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  typescript: {
    // The full production graph currently exceeds Vercel's 8 GB build limit.
    // Keep local/CI typecheck enabled; Vercel still compiles the application bundle.
    ignoreBuildErrors: process.env.VERCEL === '1',
  },
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['pdf-lib'],
  outputFileTracingIncludes: {
    '/*': ['./messages/**/*'],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'rinkuzu.app',
          },
        ],
        destination: 'https://www.rinkuzu.app/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'quizz-ck.vercel.app',
          },
        ],
        destination: 'https://www.rinkuzu.app/:path*',
        permanent: true,
      },
      {
        source: '/adaptive-learning',
        destination: '/adaptive',
        permanent: true,
      },
      {
        source: '/adaptive-learning/:path*',
        destination: '/adaptive/:path*',
        permanent: true,
      },
      {
        source: '/api/adaptive-learning/:path*',
        destination: '/api/adaptive/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // Control sensitive browser features: disable camera/mic/location/geolocation/payment
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            // NOTE: Next.js injects inline hydration/runtime scripts.
            // Keep 'unsafe-inline' unless migrating to nonce/hash-based CSP.
            // Do NOT use 'strict-dynamic' without nonce/hash, or inline scripts can be blocked.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "media-src 'self' https://d8j0ntlcm91z4.cloudfront.net https://*.cloudfront.net",
              [
                "connect-src 'self' blob: data:",
                'https://www.googletagmanager.com',
                'https://www.google-analytics.com',
                'https://us.i.posthog.com',
                'https://raw.githack.com',
                'https://raw.githubusercontent.com',
                'https://api.iconify.design',
                'https://api.simplesvg.com',
                'https://api.unisvg.com',
                objectStorageConnectOrigin,
              ].join(' '),
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
    ];
  },
  // Server Actions are enabled by default.
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['react-icons', 'react-markdown', 'lucide-react', 'framer-motion'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.nyeki.dev',
        port: '',
        pathname: '/**',
      },
    ],
    // Keep optimization enabled by default for better LCP/SEO.
    // Set NEXT_IMAGE_UNOPTIMIZED=true only when debugging image delivery issues.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === 'true',
  },
  compiler: {
    // Drop verbose logs from production bundles while keeping actionable errors/warnings.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

module.exports = async () => {
  const { withSerwist } = await import('@serwist/turbopack');
  return withBundleAnalyzer(withSerwist(withNextIntl(nextConfig)));
};
