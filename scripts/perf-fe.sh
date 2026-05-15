#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERF_DIR="$ROOT_DIR/perf"

rm -rf "$PERF_DIR" "$ROOT_DIR/.lighthouseci"
mkdir -p "$PERF_DIR"

export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/test}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-test-secret}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000}"
export JWT_SECRET="${JWT_SECRET:-test-jwt-secret}"
export JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-30m}"
export SESSION_MAX_AGE="${SESSION_MAX_AGE:-180000}"
export OBJECT_STORAGE_ENDPOINT_EXTERNAL="${OBJECT_STORAGE_ENDPOINT_EXTERNAL:-https://localhost}"
export OBJECT_STORAGE_ACCESS_KEY="${OBJECT_STORAGE_ACCESS_KEY:-test}"
export OBJECT_STORAGE_SECRET_KEY="${OBJECT_STORAGE_SECRET_KEY:-test}"
export OBJECT_STORAGE_BUCKET="${OBJECT_STORAGE_BUCKET:-test}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:8000}"
export ADAPTIVE_PROXY_TIMEOUT_MS="${ADAPTIVE_PROXY_TIMEOUT_MS:-60000}"
export INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN:-test-token}"
export NEXT_IMAGE_UNOPTIMIZED="${NEXT_IMAGE_UNOPTIMIZED:-true}"

npm run build
npm run build:analyze

madge_status=0
npx madge --circular --json src > "$PERF_DIR/fe-circular.json" || madge_status=$?

lhci_status=0
npm run perf:lighthouse || lhci_status=$?
if [[ "$lhci_status" -ne 0 ]]; then
  printf 'lhci autorun exited with status %s\n' "$lhci_status" >&2
fi

if [[ "$madge_status" -ne 0 ]]; then
  printf 'madge exited with status %s\n' "$madge_status" >&2
fi

node "$ROOT_DIR/scripts/check-perf-budget.mjs"
