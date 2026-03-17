#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${AETHERIA_PREVIEW_HOST:-127.0.0.1}"
PORT="${AETHERIA_PREVIEW_PORT:-4173}"
URL="http://${HOST}:${PORT}/"
PREVIEW_LOG="${AETHERIA_PREVIEW_LOG:-/tmp/aetheria-preview.log}"
PREVIEW_PID=""

log_step() {
  printf '[local-playtest] %s\n' "$1"
}

cleanup() {
  if [[ -n "${PREVIEW_PID}" ]] && kill -0 "${PREVIEW_PID}" >/dev/null 2>&1; then
    kill "${PREVIEW_PID}" >/dev/null 2>&1 || true
    wait "${PREVIEW_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

cd "${ROOT_DIR}"

log_step "build"
npm run build
log_step "preview:start (${URL})"
npm run preview -- --host "${HOST}" --port "${PORT}" >"${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 1 40); do
  if curl -I "${URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -I "${URL}" >/dev/null 2>&1; then
  echo "Preview server did not become ready: ${URL}" >&2
  echo "Preview log: ${PREVIEW_LOG}" >&2
  exit 1
fi

log_step "preview:ready"
log_step "smoke:desktop"
node scripts/smoke-gameplay.mjs --url "${URL}"
log_step "smoke:mobile"
node scripts/smoke-gameplay.mjs --url "${URL}" --mobile

log_step "done"
echo "Local playtest smoke completed: ${URL}"
