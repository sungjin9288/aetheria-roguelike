#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${AETHERIA_TOSS_REHEARSAL_HOST:-127.0.0.1}"
REQUESTED_PORT="${AETHERIA_TOSS_REHEARSAL_PORT:-4273}"
PORT="${REQUESTED_PORT}"
URL=""
PREVIEW_LOG="${AETHERIA_TOSS_REHEARSAL_LOG:-/tmp/aetheria-toss-first-five-preview.log}"
PREVIEW_PID=""

resolve_preview_port() {
  node - "${HOST}" "${REQUESTED_PORT}" <<'EOF'
const net = require('node:net');
const host = process.argv[2];
const first = Number(process.argv[3]);
const tryPort = (port) => new Promise((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.listen(port, host, () => server.close(() => resolve(true)));
});
(async () => {
  for (let offset = 0; offset < 50; offset += 1) {
    const port = first + offset;
    if (await tryPort(port)) {
      process.stdout.write(String(port));
      return;
    }
  }
  process.exit(1);
})();
EOF
}

cleanup() {
  if [[ -n "${PREVIEW_PID}" ]] && kill -0 "${PREVIEW_PID}" >/dev/null 2>&1; then
    kill "${PREVIEW_PID}" >/dev/null 2>&1 || true
    wait "${PREVIEW_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT
cd "${ROOT_DIR}"
PORT="$(resolve_preview_port)"
URL="http://${HOST}:${PORT}/"

printf '[toss:first-five] build isolated Toss-target QA bundle\n'
VITE_PLATFORM_TARGET=toss \
VITE_DEVICE_QA_SCENARIO=toss-first-five \
VITE_ENABLE_TEST_API=1 \
AETHERIA_TOSS_BUNDLE_DIR=dist-toss-rehearsal \
AETHERIA_TOSS_ALLOW_TEST_HARNESS=1 \
npm run build:toss:web

printf '[toss:first-five] preview %s\n' "${URL}"
AETHERIA_TOSS_BUNDLE_DIR=dist-toss-rehearsal \
npx vite preview --config vite.toss.config.js --host "${HOST}" --port "${PORT}" --strictPort >"${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 1 40); do
  if ! kill -0 "${PREVIEW_PID}" >/dev/null 2>&1; then
    printf 'Toss first-five preview exited early. Log: %s\n' "${PREVIEW_LOG}" >&2
    wait "${PREVIEW_PID}" >/dev/null 2>&1 || true
    exit 1
  fi
  if curl -I "${URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -I "${URL}" >/dev/null 2>&1; then
  printf 'Toss first-five preview did not start. Log: %s\n' "${PREVIEW_LOG}" >&2
  exit 1
fi

LOCAL_INDEX_SHA="$(shasum -a 256 dist-toss-rehearsal/index.html | awk '{print $1}')"
REMOTE_INDEX_SHA="$(curl -fsS "${URL}" | shasum -a 256 | awk '{print $1}')"
if [[ "${LOCAL_INDEX_SHA}" != "${REMOTE_INDEX_SHA}" ]]; then
  printf 'Toss first-five preview fingerprint mismatch.\n' >&2
  exit 1
fi

node scripts/smoke-gameplay.mjs \
  --url "${URL}" \
  --first-five \
  --mobile \
  --artifact-label toss-first-five

printf '[toss:first-five] local rehearsal complete; real Toss Sandbox evidence remains external\n'
