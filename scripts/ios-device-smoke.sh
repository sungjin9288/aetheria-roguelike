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
metadata_receipt=""
launch_receipt=""

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
  remove_temp_file "$metadata_receipt"
  remove_temp_file "$launch_receipt"
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
    printf 'Unlock the iPhone or iPad, keep the screen awake, then run %s. Confirm foreground visibility separately on the device or through iPhone Mirroring.\n' "$RERUN_COMMAND" >&2
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

verify_device_receipts() {
  local stage="$1"

  ruby - "$stage" "$BUNDLE_ID" "$metadata_receipt" "$launch_receipt" "$process_snapshot" <<'RUBY'
require 'json'
require 'uri'

stage, bundle_id, metadata_path, launch_path, processes_path = ARGV

def read_result(path, command)
  receipt = JSON.parse(File.read(path))
  info = receipt.fetch('info')
  raise 'receipt command or outcome does not match' unless info['commandType'] == "devicectl.device.#{command}" && info['outcome'] == 'success'
  result = receipt.fetch('result')
  raise 'receipt has no device identity' unless result['deviceIdentifier'].is_a?(String) && !result['deviceIdentifier'].empty?
  result
end

def file_path(value)
  raise 'receipt has no executable or bundle URL' unless value.is_a?(String)
  uri = URI.parse(value)
  raise 'receipt URL is not a local file' unless uri.scheme == 'file' && (uri.host.nil? || uri.host.empty?) && uri.query.nil? && uri.fragment.nil?
  path = URI::DEFAULT_PARSER.unescape(uri.path)
  raise 'receipt URL contains an invalid path' unless path.start_with?('/') && !path.match?(/[\x00-\x1f]/) && (path.split('/') & ['.', '..']).empty?
  path.sub(%r{/+\z}, '')
end

begin
  metadata = read_result(metadata_path, 'info.apps')
  apps = metadata.fetch('apps')
  raise "Installed app #{bundle_id} was not found uniquely. Run npm run ios:device:smoke first." unless apps.is_a?(Array) && apps.length == 1 && apps[0]['bundleIdentifier'] == bundle_id
  app_path = file_path(apps[0]['url'])
  raise 'installed app URL is not an app bundle' unless app_path.end_with?('.app')
  exit 0 if stage == 'metadata'

  launch = read_result(launch_path, 'process.launch')
  raise 'launch belongs to a different device' unless launch['deviceIdentifier'] == metadata['deviceIdentifier']
  raise 'launch receipt already reports termination' unless launch['terminationResult'].nil?
  process = launch.fetch('process')
  pid = process.fetch('processIdentifier')
  raise 'launch receipt has no positive integer PID' unless pid.is_a?(Integer) && pid.positive? && pid <= 2_147_483_647
  executable = file_path(process['executable'])
  raise 'launched executable is outside the installed app bundle' unless File.dirname(executable) == app_path
  exit 0 if stage == 'launch'

  snapshot = read_result(processes_path, 'info.processes')
  raise 'process probe belongs to a different device' unless snapshot['deviceIdentifier'] == metadata['deviceIdentifier']
  entries = snapshot.fetch('runningProcesses')
  raise 'process probe has no process list' unless entries.is_a?(Array)
  matches = entries.select { |entry| entry.is_a?(Hash) && entry['processIdentifier'] == pid }
  raise "launched PID #{pid} is absent or ambiguous" unless matches.length == 1
  raise "PID #{pid} has a different executable" unless file_path(matches[0]['executable']) == executable
  puts "[ios-device-smoke] verified process #{pid}: #{executable}"
rescue JSON::ParserError, KeyError, TypeError, NoMethodError, ArgumentError, URI::InvalidURIError, SystemCallError, RuntimeError => error
  warn "[ios-device-smoke] #{stage} evidence rejected: #{error.message}"
  warn 'Process survival is unverified; the exit cause is unknown. Check device state and termination diagnostics before attributing it to lock or crash.' if stage == 'process'
  exit 1
end
RUBY
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
metadata_receipt="$(mktemp)"
if ! run_timed "metadata before install" \
  xcrun devicectl device info apps \
    --device "$DEVICE_ID" \
    --bundle-id "$BUNDLE_ID" \
    --json-output "$metadata_receipt" 2>&1 | tee "$diagnostic_log"; then
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

remove_temp_file "$diagnostic_log"
diagnostic_log=""

if [[ "$REUSE_INSTALLED_APP" == "1" ]]; then
  log_step "reuse installed app"
else
  run_required_device_step "install app" \
    xcrun devicectl device install app \
      --device "$DEVICE_ID" \
      "$APP_PATH"

  remove_temp_file "$metadata_receipt"
  metadata_receipt="$(mktemp)"
  run_required_device_step "metadata after install" \
    xcrun devicectl device info apps \
      --device "$DEVICE_ID" \
      --bundle-id "$BUNDLE_ID" \
      --json-output "$metadata_receipt"
fi
verify_device_receipts metadata

log_step "keep the iOS device unlocked and awake; this command verifies launch and process survival"
launch_receipt="$(mktemp)"
run_required_device_step "launch app" \
  xcrun devicectl device process launch \
    --device "$DEVICE_ID" \
    --json-output "$launch_receipt" \
    --terminate-existing \
    "$BUNDLE_ID"
verify_device_receipts launch

process_snapshot="$(mktemp)"
run_required_device_step "process check" \
  xcrun devicectl device info processes \
    --device "$DEVICE_ID" \
    --json-output "$process_snapshot"

verify_device_receipts process
remove_temp_file "$process_snapshot"
process_snapshot=""

log_step "process hold ${PROCESS_HOLD_SECONDS}s"
sleep "$PROCESS_HOLD_SECONDS"

process_snapshot="$(mktemp)"
run_required_device_step "process check after hold" \
  xcrun devicectl device info processes \
    --device "$DEVICE_ID" \
    --json-output "$process_snapshot"

verify_device_receipts process
remove_temp_file "$process_snapshot"
process_snapshot=""

log_step "process hold passed"
printf '[ios-device-smoke] devicectl cannot prove foreground visibility; record a physical-device or iPhone Mirroring screen check separately.\n'
log_step "done"
