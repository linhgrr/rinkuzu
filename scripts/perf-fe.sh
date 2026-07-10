#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERF_DIR="$ROOT_DIR/perf"

rm -rf "$PERF_DIR" "$ROOT_DIR/.lighthouseci"
mkdir -p "$PERF_DIR"

export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/test}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-test-nextauth-secret-at-least-32-characters}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000}"
export SESSION_MAX_AGE_SECONDS="${SESSION_MAX_AGE_SECONDS:-28800}"
export SESSION_UPDATE_AGE_SECONDS="${SESSION_UPDATE_AGE_SECONDS:-3600}"
export AUTH_LOCKOUT_MAX_ATTEMPTS="${AUTH_LOCKOUT_MAX_ATTEMPTS:-5}"
export AUTH_LOCKOUT_WINDOW_MINUTES="${AUTH_LOCKOUT_WINDOW_MINUTES:-15}"
export AUTH_LOCKOUT_DURATION_MINUTES="${AUTH_LOCKOUT_DURATION_MINUTES:-15}"
export OBJECT_STORAGE_ENDPOINT_EXTERNAL="${OBJECT_STORAGE_ENDPOINT_EXTERNAL:-https://localhost}"
export OBJECT_STORAGE_REGION="${OBJECT_STORAGE_REGION:-auto}"
export OBJECT_STORAGE_ADDRESSING_STYLE="${OBJECT_STORAGE_ADDRESSING_STYLE:-path}"
export OBJECT_STORAGE_ACCESS_KEY="${OBJECT_STORAGE_ACCESS_KEY:-test}"
export OBJECT_STORAGE_SECRET_KEY="${OBJECT_STORAGE_SECRET_KEY:-test}"
export OBJECT_STORAGE_BUCKET="${OBJECT_STORAGE_BUCKET:-test}"
export MAIL_FROM="${MAIL_FROM:-noreply@example.com}"
export RESEND_API_KEY="${RESEND_API_KEY:-re_test_key}"
export PAYOS_CLIENT_ID="${PAYOS_CLIENT_ID:-test-payos-client-id}"
export PAYOS_API_KEY="${PAYOS_API_KEY:-test-payos-api-key}"
export PAYOS_CHECKSUM_KEY="${PAYOS_CHECKSUM_KEY:-test-payos-checksum-key}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:8000}"
export ADAPTIVE_PROXY_TIMEOUT_MS="${ADAPTIVE_PROXY_TIMEOUT_MS:-60000}"
export INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN:-test-token}"
export NEXT_IMAGE_UNOPTIMIZED="${NEXT_IMAGE_UNOPTIMIZED:-true}"
export PERF_BUDGET_ENFORCE="${PERF_BUDGET_ENFORCE:-0}"

npm run build

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

if [[ "$PERF_BUDGET_ENFORCE" != "1" ]]; then
  printf 'Performance advisory completed. Budget violations are reported in perf/fe-budget.json.\n'
fi
