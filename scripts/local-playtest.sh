#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${AETHERIA_PREVIEW_HOST:-127.0.0.1}"
REQUESTED_PORT="${AETHERIA_PREVIEW_PORT:-4173}"
PORT="${REQUESTED_PORT}"
PREVIEW_LOG="${AETHERIA_PREVIEW_LOG:-/tmp/aetheria-preview.log}"
PREVIEW_PID=""

log_step() {
  printf '[local-playtest] %s\n' "$1"
}

resolve_preview_port() {
  node - "$1" "$2" <<'EOF'
const net = require('node:net');

const host = process.argv[2];
const startPort = Number(process.argv[3]);
const maxAttempts = 50;

const canListen = (port) => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once('error', (error) => {
    server.close(() => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });
  server.listen(port, host, () => {
    const resolved = server.address()?.port || port;
    server.close(() => resolve(resolved));
  });
});

(async () => {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (port > 65535) break;
    const resolved = await canListen(port);
    if (resolved) {
      console.log(resolved);
      return;
    }
  }
  console.error(`Unable to resolve preview port from ${startPort} within ${maxAttempts} attempts.`);
  process.exit(1);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
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

PORT="$(resolve_preview_port "${HOST}" "${REQUESTED_PORT}")"
URL="http://${HOST}:${PORT}/"

if [[ "${PORT}" != "${REQUESTED_PORT}" ]]; then
  log_step "preview:port ${REQUESTED_PORT} busy, using ${PORT}"
fi

log_step "build"
npm run build:guard
log_step "preview:start (${URL})"
npm run preview -- --host "${HOST}" --port "${PORT}" --strictPort >"${PREVIEW_LOG}" 2>&1 &
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

if [[ "${AETHERIA_RUN_PERF:-0}" == "1" ]]; then
  log_step "perf:desktop"
  node scripts/perf-guard.mjs --url "${URL}"
  log_step "perf:mobile"
  node scripts/perf-guard.mjs --url "${URL}" --mobile
fi

log_step "done"
echo "Local playtest smoke completed: ${URL}"
