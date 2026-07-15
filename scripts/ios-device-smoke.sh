#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE_ID="${AETHERIA_IOS_DEVICE_ID:-FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B}"
BUNDLE_ID="${AETHERIA_IOS_BUNDLE_ID:-com.aetheria.roguelike}"
APP_PATH="${AETHERIA_IOS_APP_PATH:-$ROOT_DIR/build/ios/Aetheria.xcarchive/Products/Applications/App.app}"
DEVICECTL_TIMEOUT_SECONDS="${AETHERIA_DEVICECTL_TIMEOUT_SECONDS:-30}"
PROCESS_HOLD_SECONDS="${AETHERIA_IOS_PROCESS_HOLD_SECONDS:-60}"
launch_log=""
process_snapshot=""

log_step() {
  printf '[ios-device-smoke] %s\n' "$1"
}

remove_temp_file() {
  local path="$1"

  if [[ -n "$path" && -f "$path" ]]; then
    rm -f "$path"
  fi
}

cleanup_temp_files() {
  remove_temp_file "$launch_log"
  remove_temp_file "$process_snapshot"
}

explain_launch_failure() {
  local output_file="$1"

  if grep -Eq "not been explicitly trusted|Untrusted Developer" "$output_file"; then
    printf '%s\n' \
      'The archive is installed, but this developer profile is not trusted on the iPhone.' \
      'On the iPhone, open Settings > General > VPN & Device Management > Developer App, trust the profile, then rerun ios:device:smoke.' >&2
  fi

  if grep -Eqi "Locked|device was not, or could not be, unlocked" "$output_file"; then
    printf '%s\n' \
      'The archive is installed, but iOS blocked launch because the iPhone is locked.' \
      'Unlock the iPhone, keep the screen awake, leave the app in the foreground, then rerun ios:device:smoke.' >&2
  fi
}

trap cleanup_temp_files EXIT

run_timed() {
  local label="$1"
  shift

  log_step "$label"
  ruby - "$DEVICECTL_TIMEOUT_SECONDS" "$@" <<'RUBY'
timeout_seconds = ARGV.shift.to_i
cmd = ARGV
pid = spawn(*cmd, pgroup: true)
deadline = Time.now + timeout_seconds

loop do
  waited = Process.waitpid2(pid, Process::WNOHANG)
  if waited
    exit(waited[1].exitstatus || 1)
  end

  if Time.now > deadline
    begin
      Process.kill("TERM", -pid)
    rescue Errno::ESRCH, Errno::EPERM => error
      warn "unable to terminate timed-out process group: #{error.message}"
    end
    sleep 1
    begin
      Process.kill("KILL", -pid)
    rescue Errno::ESRCH, Errno::EPERM => error
      warn "unable to kill timed-out process group: #{error.message}"
    end
    warn "command timed out after #{timeout_seconds}s: #{cmd.join(' ')}"
    exit 124
  end

  sleep 0.2
end
RUBY
}

if ! command -v xcrun >/dev/null 2>&1; then
  printf 'xcrun is required for iOS device smoke.\n' >&2
  exit 1
fi

if [[ ! -d "$APP_PATH" ]]; then
  printf 'App bundle not found: %s\n' "$APP_PATH" >&2
  printf 'Run npm run ios:archive first, or set AETHERIA_IOS_APP_PATH.\n' >&2
  exit 1
fi

log_step "config"
printf 'device id: %s\n' "$DEVICE_ID"
printf 'bundle id: %s\n' "$BUNDLE_ID"
printf 'app path: %s\n' "$APP_PATH"

log_step "xcdevice availability"
xcrun xcdevice list 2>/dev/null | sed -n '1,140p'

if ! run_timed "metadata before install" \
  xcrun devicectl device info apps \
    --device "$DEVICE_ID" \
    --bundle-id "$BUNDLE_ID"; then
  printf '[ios-device-smoke] metadata before install unavailable; continuing to install attempt.\n' >&2
fi

run_timed "install app" \
  xcrun devicectl device install app \
    --device "$DEVICE_ID" \
    "$APP_PATH"

run_timed "metadata after install" \
  xcrun devicectl device info apps \
    --device "$DEVICE_ID" \
    --bundle-id "$BUNDLE_ID"

launch_log="$(mktemp)"
log_step "keep the iPhone unlocked, awake, and in the foreground"
if ! run_timed "launch app" \
  xcrun devicectl device process launch \
    --device "$DEVICE_ID" \
    --terminate-existing \
    "$BUNDLE_ID" 2>&1 | tee "$launch_log"; then
  explain_launch_failure "$launch_log"
  exit 1
fi
remove_temp_file "$launch_log"
launch_log=""

process_snapshot="$(mktemp)"
run_timed "process check" \
  xcrun devicectl device info processes \
    --device "$DEVICE_ID" >"$process_snapshot"

if ! grep -E "App\\.app/App|${BUNDLE_ID}|Aetheria" "$process_snapshot"; then
  cat "$process_snapshot"
  printf 'Aetheria app process was not found after launch.\n' >&2
  exit 1
fi
remove_temp_file "$process_snapshot"
process_snapshot=""

log_step "hold ${PROCESS_HOLD_SECONDS}s"
sleep "$PROCESS_HOLD_SECONDS"

process_snapshot="$(mktemp)"
run_timed "process check after hold" \
  xcrun devicectl device info processes \
    --device "$DEVICE_ID" >"$process_snapshot"

if ! grep -E "App\\.app/App|${BUNDLE_ID}|Aetheria" "$process_snapshot"; then
  cat "$process_snapshot"
  printf 'Aetheria app process was not found after the %ss hold.\n' "$PROCESS_HOLD_SECONDS" >&2
  printf 'Keep the iPhone unlocked, awake, and in the foreground for the full hold, then rerun ios:device:smoke.\n' >&2
  exit 1
fi
remove_temp_file "$process_snapshot"
process_snapshot=""

log_step "done"
