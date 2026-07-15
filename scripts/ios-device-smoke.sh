#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE_ID="${AETHERIA_IOS_DEVICE_ID:-FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B}"
BUNDLE_ID="${AETHERIA_IOS_BUNDLE_ID:-com.aetheria.roguelike}"
APP_PATH="${AETHERIA_IOS_APP_PATH:-$ROOT_DIR/build/ios/Aetheria.xcarchive/Products/Applications/App.app}"
DEVICECTL_TIMEOUT_SECONDS="${AETHERIA_DEVICECTL_TIMEOUT_SECONDS:-120}"
PROCESS_HOLD_SECONDS="${AETHERIA_IOS_PROCESS_HOLD_SECONDS:-60}"
REUSE_INSTALLED_APP="${AETHERIA_IOS_REUSE_INSTALLED_APP:-0}"
diagnostic_log=""
process_snapshot=""

if [[ "$REUSE_INSTALLED_APP" == "1" ]]; then
  RERUN_COMMAND="npm run ios:device:launch-smoke"
else
  RERUN_COMMAND="npm run ios:device:smoke"
fi

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
  remove_temp_file "$diagnostic_log"
  remove_temp_file "$process_snapshot"
}

device_is_locked() {
  grep -Eqi "Locked|device was not, or could not be, unlocked" "$1"
}

explain_device_failure() {
  local output_file="$1"
  local step="$2"

  if grep -Eq "not been explicitly trusted|Untrusted Developer" "$output_file"; then
    printf '%s\n' 'The archive is installed, but this developer profile is not trusted on the iOS device.' >&2
    printf 'On the device, open Settings > General > VPN & Device Management > Developer App, trust the profile, then run %s.\n' "$RERUN_COMMAND" >&2
  fi

  if device_is_locked "$output_file"; then
    printf 'iOS blocked %s because the device is locked.\n' "$step" >&2
    printf 'Unlock the iPhone or iPad, keep the screen awake, then run %s and leave Aetheria in the foreground after it opens.\n' "$RERUN_COMMAND" >&2
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

run_required_device_step() {
  local label="$1"
  shift

  diagnostic_log="$(mktemp)"
  if ! run_timed "$label" "$@" 2>&1 | tee "$diagnostic_log"; then
    explain_device_failure "$diagnostic_log" "$label"
    return 1
  fi

  remove_temp_file "$diagnostic_log"
  diagnostic_log=""
}

if ! command -v xcrun >/dev/null 2>&1; then
  printf 'xcrun is required for iOS device smoke.\n' >&2
  exit 1
fi

if [[ "$REUSE_INSTALLED_APP" != "0" && "$REUSE_INSTALLED_APP" != "1" ]]; then
  printf 'AETHERIA_IOS_REUSE_INSTALLED_APP must be 0 or 1.\n' >&2
  exit 1
fi

if [[ "$REUSE_INSTALLED_APP" != "1" && ! -d "$APP_PATH" ]]; then
  printf 'App bundle not found: %s\n' "$APP_PATH" >&2
  printf 'Run npm run ios:archive first, or set AETHERIA_IOS_APP_PATH.\n' >&2
  exit 1
fi

log_step "config"
printf 'device id: %s\n' "$DEVICE_ID"
printf 'bundle id: %s\n' "$BUNDLE_ID"
if [[ "$REUSE_INSTALLED_APP" == "1" ]]; then
  printf 'delivery mode: reuse installed app\n'
else
  printf 'delivery mode: install archive\n'
  printf 'app path: %s\n' "$APP_PATH"
fi

log_step "xcdevice availability"
xcrun xcdevice list 2>/dev/null | sed -n '1,140p'

diagnostic_log="$(mktemp)"
if ! run_timed "metadata before install" \
  xcrun devicectl device info apps \
    --device "$DEVICE_ID" \
    --bundle-id "$BUNDLE_ID" 2>&1 | tee "$diagnostic_log"; then
  if device_is_locked "$diagnostic_log"; then
    explain_device_failure "$diagnostic_log" "metadata before install"
    exit 1
  fi
  if [[ "$REUSE_INSTALLED_APP" == "1" ]]; then
    printf 'Installed app metadata is required for launch-only smoke. Run npm run ios:device:smoke first.\n' >&2
    exit 1
  fi
  printf '[ios-device-smoke] metadata before install unavailable; continuing to install attempt.\n' >&2
fi

if [[ "$REUSE_INSTALLED_APP" == "1" ]] && ! grep -Fq "$BUNDLE_ID" "$diagnostic_log"; then
  printf 'Installed app %s was not found. Run npm run ios:device:smoke first.\n' "$BUNDLE_ID" >&2
  exit 1
fi
remove_temp_file "$diagnostic_log"
diagnostic_log=""

if [[ "$REUSE_INSTALLED_APP" == "1" ]]; then
  log_step "reuse installed app"
else
  run_required_device_step "install app" \
    xcrun devicectl device install app \
      --device "$DEVICE_ID" \
      "$APP_PATH"

  run_required_device_step "metadata after install" \
    xcrun devicectl device info apps \
      --device "$DEVICE_ID" \
      --bundle-id "$BUNDLE_ID"
fi

log_step "keep the iOS device unlocked and awake; leave Aetheria in the foreground after launch"
run_required_device_step "launch app" \
  xcrun devicectl device process launch \
    --device "$DEVICE_ID" \
    --terminate-existing \
    "$BUNDLE_ID"

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
  printf 'Keep the iOS device unlocked, awake, and in the foreground for the full hold, then run %s.\n' "$RERUN_COMMAND" >&2
  exit 1
fi
remove_temp_file "$process_snapshot"
process_snapshot=""

log_step "done"
