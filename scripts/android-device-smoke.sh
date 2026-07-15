#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_PATH="${AETHERIA_ANDROID_APK_PATH:-$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE_ID="${AETHERIA_ANDROID_PACKAGE_ID:-com.aetheria.roguelike}"
ACTIVITY="${AETHERIA_ANDROID_ACTIVITY:-.MainActivity}"
DEVICE_SERIAL="${AETHERIA_ANDROID_DEVICE_SERIAL:-}"
PROCESS_HOLD_SECONDS="${AETHERIA_ANDROID_PROCESS_HOLD_SECONDS:-60}"
ALLOW_EMULATOR="${AETHERIA_ANDROID_ALLOW_EMULATOR:-0}"
ADB=""
install_log=""

log_step() {
  printf '[android-device-smoke] %s\n' "$1"
}

cleanup_temp_files() {
  if [[ -n "$install_log" && -f "$install_log" ]]; then
    rm -f "$install_log"
  fi
}

explain_install_failure() {
  if grep -Eqi 'INSTALL_FAILED_INSUFFICIENT_STORAGE|not enough space' "$install_log"; then
    printf 'The Android device does not have enough free storage for this APK. Free space without deleting Aetheria save data, then rerun android:device:smoke.\n' >&2
    return
  fi

  if grep -Eqi 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|different signature' "$install_log"; then
    printf 'The installed app uses a different signature. Preserve any needed save data before deciding whether to remove it manually.\n' >&2
    return
  fi

  printf 'APK install failed. Review the adb output, resolve the device condition, then rerun android:device:smoke.\n' >&2
}

trap cleanup_temp_files EXIT

resolve_adb() {
  if [[ -n "${AETHERIA_ADB_PATH:-}" ]]; then
    ADB="$AETHERIA_ADB_PATH"
  elif command -v adb >/dev/null 2>&1; then
    ADB="$(command -v adb)"
  elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]]; then
    ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
  elif [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/platform-tools/adb" ]]; then
    ADB="$ANDROID_HOME/platform-tools/adb"
  else
    printf 'adb is required for Android device smoke. Run npm run mobile:doctor and install Android platform-tools.\n' >&2
    exit 1
  fi

  if [[ ! -x "$ADB" ]]; then
    printf 'adb is not executable: %s\n' "$ADB" >&2
    exit 1
  fi
}

device_is_emulator() {
  local serial="$1"
  local qemu

  if [[ "$serial" == emulator-* ]]; then
    return 0
  fi

  qemu="$("$ADB" -s "$serial" shell getprop ro.kernel.qemu 2>/dev/null | tr -d '\r' || true)"
  [[ "$qemu" == "1" ]]
}

select_device() {
  local device_table
  local serial
  local state
  local candidates=()

  device_table="$("$ADB" devices)"
  printf '%s\n' "$device_table"

  if [[ -n "$DEVICE_SERIAL" ]]; then
    state="$("$ADB" -s "$DEVICE_SERIAL" get-state 2>/dev/null || true)"
    if [[ "$state" != "device" ]]; then
      printf 'Android device %s is not ready. Unlock it, enable USB debugging, and authorize this computer.\n' "$DEVICE_SERIAL" >&2
      exit 1
    fi

    if [[ "$ALLOW_EMULATOR" != "1" ]] && device_is_emulator "$DEVICE_SERIAL"; then
      printf 'Android device %s is an emulator. Set AETHERIA_ANDROID_ALLOW_EMULATOR=1 only for preflight.\n' "$DEVICE_SERIAL" >&2
      exit 1
    fi
    return
  fi

  while read -r serial state; do
    [[ -n "$serial" && "$state" == "device" ]] || continue
    if [[ "$ALLOW_EMULATOR" != "1" ]] && device_is_emulator "$serial"; then
      continue
    fi
    candidates+=("$serial")
  done < <(printf '%s\n' "$device_table" | sed '1d')

  if [[ ${#candidates[@]} -eq 0 ]]; then
    if printf '%s\n' "$device_table" | grep -q '[[:space:]]unauthorized$'; then
      printf 'Android device authorization is pending. Unlock the device and accept the USB debugging prompt.\n' >&2
    else
      printf 'No ready physical Android device was found. Connect one with USB debugging enabled.\n' >&2
      printf 'For emulator-only preflight, set AETHERIA_ANDROID_ALLOW_EMULATOR=1.\n' >&2
    fi
    exit 1
  fi

  if [[ ${#candidates[@]} -gt 1 ]]; then
    printf 'Multiple Android devices are ready: %s\n' "${candidates[*]}" >&2
    printf 'Set AETHERIA_ANDROID_DEVICE_SERIAL to choose one.\n' >&2
    exit 1
  fi

  DEVICE_SERIAL="${candidates[0]}"
}

get_app_pid() {
  "$ADB" -s "$DEVICE_SERIAL" shell pidof "$PACKAGE_ID" 2>/dev/null | tr -d '\r' || true
}

app_is_foreground() {
  "$ADB" -s "$DEVICE_SERIAL" shell dumpsys activity activities 2>/dev/null \
    | grep -E 'mResumedActivity|topResumedActivity|ResumedActivity' \
    | grep -Fq "$PACKAGE_ID"
}

resolve_adb

if [[ ! -f "$APK_PATH" ]]; then
  printf 'Android APK not found: %s\n' "$APK_PATH" >&2
  printf 'Run npm run android:debug first, or set AETHERIA_ANDROID_APK_PATH.\n' >&2
  exit 1
fi

log_step "connected devices"
select_device

MODEL="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.product.model | tr -d '\r')"
ANDROID_VERSION="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.build.version.release | tr -d '\r')"

log_step "config"
printf 'device serial: %s\n' "$DEVICE_SERIAL"
printf 'device model: %s\n' "$MODEL"
printf 'Android version: %s\n' "$ANDROID_VERSION"
printf 'package id: %s\n' "$PACKAGE_ID"
printf 'APK path: %s\n' "$APK_PATH"

log_step "install APK"
install_log="$(mktemp)"
if ! "$ADB" -s "$DEVICE_SERIAL" install -r "$APK_PATH" 2>&1 | tee "$install_log"; then
  explain_install_failure
  exit 1
fi
rm -f "$install_log"
install_log=""

log_step "launch app"
"$ADB" -s "$DEVICE_SERIAL" shell am force-stop "$PACKAGE_ID"
LAUNCH_OUTPUT="$("$ADB" -s "$DEVICE_SERIAL" shell am start -W -n "$PACKAGE_ID/$ACTIVITY")"
printf '%s\n' "$LAUNCH_OUTPUT"
if ! printf '%s\n' "$LAUNCH_OUTPUT" | grep -q 'Status: ok'; then
  printf 'Android activity launch did not report success. Keep the device unlocked and rerun android:device:smoke.\n' >&2
  exit 1
fi

sleep 2
APP_PID="$(get_app_pid)"
if [[ -z "$APP_PID" ]]; then
  printf 'Aetheria process was not found after launch.\n' >&2
  exit 1
fi

if ! app_is_foreground; then
  printf 'Aetheria is running but not in the foreground. Unlock the device and keep the app visible.\n' >&2
  exit 1
fi
printf 'foreground pid: %s\n' "$APP_PID"

log_step "hold ${PROCESS_HOLD_SECONDS}s"
sleep "$PROCESS_HOLD_SECONDS"

APP_PID="$(get_app_pid)"
if [[ -z "$APP_PID" ]]; then
  printf 'Aetheria process was not found after the %ss hold.\n' "$PROCESS_HOLD_SECONDS" >&2
  exit 1
fi

if ! app_is_foreground; then
  printf 'Aetheria left the foreground during the %ss hold. Keep the device awake and the app visible, then rerun android:device:smoke.\n' "$PROCESS_HOLD_SECONDS" >&2
  exit 1
fi

printf 'foreground pid after hold: %s\n' "$APP_PID"
log_step "done"
