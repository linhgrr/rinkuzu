/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are enabled by default in Next.js 14
  images: {
    domains: ['localhost'],
  },
  env: {
    MONGO_URL: process.env.MONGO_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GEMINI_KEYS: process.env.GEMINI_KEYS,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  },
}

module.exports = nextConfig 