ARG NODE_IMAGE=node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --global npm@10.9.8 \
  && test "$(npm --version)" = "10.9.8"
RUN npm ci --ignore-scripts

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://www.rinkuzu.app
ARG NEXT_PUBLIC_API_URL=https://api.rinkuzu.app

# Build-time validation must not depend on production secrets. These values are
# scoped to the builder stage; the runtime image still requires real injected
# configuration.
ENV NEXT_TELEMETRY_DISABLED=1 \
  MONGODB_URI=mongodb://127.0.0.1:27017/rinkuzu-build \
  AUTH_SECRET=build-only-placeholder-at-least-32-characters \
  AUTH_URL=${NEXT_PUBLIC_SITE_URL} \
  AUTH_TRUST_HOST=true \
  NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
  NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  SESSION_MAX_AGE_SECONDS=28800 \
  SESSION_UPDATE_AGE_SECONDS=3600 \
  AUTH_LOCKOUT_MAX_ATTEMPTS=5 \
  AUTH_LOCKOUT_WINDOW_MINUTES=15 \
  AUTH_LOCKOUT_DURATION_MINUTES=15 \
  ADAPTIVE_PROXY_TIMEOUT_MS=60000 \
  INTERNAL_SERVICE_TOKEN=build-only-placeholder \
  OBJECT_STORAGE_ENDPOINT_EXTERNAL=https://s3.nyeki.dev \
  OBJECT_STORAGE_REGION=auto \
  OBJECT_STORAGE_ADDRESSING_STYLE=path \
  OBJECT_STORAGE_ACCESS_KEY=build-only-placeholder \
  OBJECT_STORAGE_SECRET_KEY=build-only-placeholder \
  OBJECT_STORAGE_BUCKET=build-only-placeholder \
  MAIL_FROM=noreply@example.com \
  RESEND_API_KEY=build-only-placeholder \
  PAYOS_CLIENT_ID=build-only-placeholder \
  PAYOS_API_KEY=build-only-placeholder \
  PAYOS_CHECKSUM_KEY=build-only-placeholder \
  NEXT_IMAGE_UNOPTIMIZED=false

RUN npm rebuild argon2 --build-from-source

RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/robots.txt || exit 1

CMD ["node", "server.js"]
