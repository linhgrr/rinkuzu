#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERF_DIR="$ROOT_DIR/perf"
PERF_MODE="${PERF_MODE:-local}"

if [[ -z "${LIGHTHOUSE_PORT:-}" ]]; then
  LIGHTHOUSE_PORT="$(
    node -e 'const server = require("node:net").createServer(); server.unref(); server.listen(0, "127.0.0.1", () => { const address = server.address(); if (!address || typeof address === "string") process.exit(1); process.stdout.write(String(address.port)); server.close(); });'
  )"
fi
export LIGHTHOUSE_PORT

if [[ "$PERF_MODE" != "local" && "$PERF_MODE" != "pr" && "$PERF_MODE" != "release" ]]; then
  printf 'PERF_MODE must be local, pr, or release; received %s\n' "$PERF_MODE" >&2
  exit 1
fi

if [[ "${CI:-false}" == "true" && "$PERF_MODE" == "local" ]]; then
  printf 'PERF_MODE=local cannot produce CI evidence\n' >&2
  exit 1
fi

if [[ "${CI:-false}" == "true" && "${PERF_RUNNER_CLASS:-}" != "controlled" ]]; then
  printf 'PERF_RUNNER_CLASS=controlled is required for timing-sensitive CI evidence\n' >&2
  exit 1
fi

export PERF_MODE

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
export NEXT_IMAGE_UNOPTIMIZED="${NEXT_IMAGE_UNOPTIMIZED:-false}"

if [[ "${PERF_REUSE_BUILD:-0}" == "1" ]]; then
  if [[ ! -f "$ROOT_DIR/.next/BUILD_ID" || -z "${PERF_EXPECTED_BUILD_DIGEST:-}" ]]; then
    printf 'Reusing a build requires .next/BUILD_ID and PERF_EXPECTED_BUILD_DIGEST\n' >&2
    exit 1
  fi
else
  npm run build
fi

madge_status=0
MADGE_BIN="$ROOT_DIR/node_modules/.bin/madge"
if [[ ! -x "$MADGE_BIN" ]]; then
  printf 'Pinned local madge executable is missing; run npm ci\n' >&2
  madge_status=1
else
  "$MADGE_BIN" --circular --json src > "$PERF_DIR/fe-circular.json" || madge_status=$?
fi

lhci_status=0
npm run perf:lighthouse || lhci_status=$?
if [[ "$lhci_status" -ne 0 ]]; then
  printf 'lhci autorun exited with status %s\n' "$lhci_status" >&2
fi

if [[ "$madge_status" -ne 0 ]]; then
  printf 'madge exited with status %s\n' "$madge_status" >&2
fi

budget_status=0
node "$ROOT_DIR/scripts/check-perf-budget.mjs" || budget_status=$?

if [[ "$lhci_status" -ne 0 || "$madge_status" -ne 0 || "$budget_status" -ne 0 ]]; then
  exit 1
fi
