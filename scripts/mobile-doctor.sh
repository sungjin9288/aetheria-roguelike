#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

java_cmd=""
if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
  java_cmd="${JAVA_HOME}/bin/java"
else
  for candidate in \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java \
    /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home/bin/java
  do
    if [[ -x "$candidate" ]]; then
      java_cmd="$candidate"
      break
    fi
  done

  if [[ -z "$java_cmd" ]] && command -v java >/dev/null 2>&1; then
    java_cmd="$(command -v java)"
  fi
fi

android_sdk_dir=""
if [[ -f "$ROOT_DIR/android/local.properties" ]]; then
  android_sdk_dir="$(awk -F= '/^sdk\.dir=/{print $2}' "$ROOT_DIR/android/local.properties" | tail -n1)"
fi

android_store_file="${AETHERIA_ANDROID_KEYSTORE_PATH:-}"
android_store_password="${AETHERIA_ANDROID_KEYSTORE_PASSWORD:-}"
android_key_alias="${AETHERIA_ANDROID_KEY_ALIAS:-}"
android_key_password="${AETHERIA_ANDROID_KEY_PASSWORD:-}"

if [[ -f "$ROOT_DIR/android/key.properties" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      storeFile) android_store_file="${android_store_file:-$value}" ;;
      storePassword) android_store_password="${android_store_password:-$value}" ;;
      keyAlias) android_key_alias="${android_key_alias:-$value}" ;;
      keyPassword) android_key_password="${android_key_password:-$value}" ;;
    esac
  done < "$ROOT_DIR/android/key.properties"
fi

android_release_ready="no"
if [[ -n "$android_store_file" && -n "$android_store_password" && -n "$android_key_alias" && -n "$android_key_password" ]]; then
  android_release_ready="yes"
fi

bundle_id="$(sed -n 's/.*PRODUCT_BUNDLE_IDENTIFIER = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)"
marketing_version="$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)"
build_number="$(sed -n 's/.*CURRENT_PROJECT_VERSION = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)"
ios_signing_style="$(sed -n 's/.*CODE_SIGN_STYLE = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)"
ios_team_id="${AETHERIA_IOS_TEAM_ID:-$(sed -n 's/.*DEVELOPMENT_TEAM = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)}"

printf 'Aetheria Mobile Doctor\n'
printf '======================\n'
printf 'iOS bundle id: %s\n' "${bundle_id:-missing}"
printf 'iOS marketing version: %s\n' "${marketing_version:-missing}"
printf 'iOS build number: %s\n' "${build_number:-missing}"
printf 'iOS signing style: %s\n' "${ios_signing_style:-missing}"
printf 'iOS team id: %s\n' "${ios_team_id:-missing}"
printf 'Xcode: '
if command -v xcodebuild >/dev/null 2>&1; then
  xcode_output="$(xcodebuild -version 2>/dev/null | head -n1 || true)"
  if [[ -n "$xcode_output" ]]; then
    printf '%s\n' "$xcode_output"
  else
    printf 'installed but not runnable\n'
  fi
else
  printf 'missing\n'
fi

printf '\nAndroid SDK dir: %s\n' "${android_sdk_dir:-missing}"
printf 'Android SDK platform 36: '
if [[ -n "$android_sdk_dir" && -f "$android_sdk_dir/platforms/android-36/android.jar" ]]; then
  printf 'ok\n'
else
  printf 'missing\n'
fi

printf 'Java: '
if [[ -n "$java_cmd" ]]; then
  java_output="$("$java_cmd" -version 2>&1 | head -n1 || true)"
  if [[ -n "$java_output" ]]; then
    printf '%s\n' "$java_output"
  else
    printf 'installed but not runnable\n'
  fi
else
  printf 'missing\n'
fi

printf 'Android release signing: %s\n' "$android_release_ready"
if [[ "$android_release_ready" == "yes" ]]; then
  printf 'Android keystore path: %s\n' "$android_store_file"
else
  printf 'Android signing inputs missing. Configure android/key.properties or AETHERIA_ANDROID_KEYSTORE_* env vars.\n'
fi
