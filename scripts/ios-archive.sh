#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="${AETHERIA_IOS_ARCHIVE_PATH:-$ROOT_DIR/build/ios/Aetheria.xcarchive}"
EXPORT_PATH="${AETHERIA_IOS_EXPORT_PATH:-$ROOT_DIR/build/ios/export}"
DERIVED_DATA_PATH="${AETHERIA_IOS_DERIVED_DATA_PATH:-/tmp/aetheria-ios-archive-build}"
XCODE_HOME="${AETHERIA_IOS_HOME:-/tmp/aetheria-home}"
CLANG_MODULE_CACHE_PATH="${AETHERIA_IOS_CLANG_MODULE_CACHE_PATH:-/tmp/aetheria-clang-module-cache}"
CONFIGURATION="${AETHERIA_IOS_CONFIGURATION:-Release}"
PROJECT_TEAM_ID="$(sed -n 's/.*DEVELOPMENT_TEAM = \(.*\);/\1/p' "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" | head -n1)"
TEAM_ID="${AETHERIA_IOS_TEAM_ID:-$PROJECT_TEAM_ID}"
CODE_SIGN_IDENTITY="${AETHERIA_IOS_CODE_SIGN_IDENTITY:-}"
PROVISIONING_PROFILE_SPECIFIER="${AETHERIA_IOS_PROVISIONING_PROFILE_SPECIFIER:-}"
EXPORT_OPTIONS_PLIST="${AETHERIA_IOS_EXPORT_OPTIONS_PLIST:-}"
ALLOW_PROVISIONING_UPDATES="${AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES:-}"

if [[ -z "$TEAM_ID" ]]; then
  printf 'iOS signing team is missing. Set AETHERIA_IOS_TEAM_ID or configure DEVELOPMENT_TEAM in Xcode before ios:archive.\n' >&2
  exit 1
fi

mkdir -p "$XCODE_HOME" "$CLANG_MODULE_CACHE_PATH" "$(dirname "$ARCHIVE_PATH")"

archive_cmd=(
  xcodebuild
  -project "$ROOT_DIR/ios/App/App.xcodeproj"
  -scheme App
  -configuration "$CONFIGURATION"
  -destination generic/platform=iOS
  -archivePath "$ARCHIVE_PATH"
  -derivedDataPath "$DERIVED_DATA_PATH"
  DEVELOPMENT_TEAM="$TEAM_ID"
  archive
)

if [[ -n "$CODE_SIGN_IDENTITY" ]]; then
  archive_cmd+=(CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY")
fi

if [[ -n "$PROVISIONING_PROFILE_SPECIFIER" ]]; then
  archive_cmd+=(PROVISIONING_PROFILE_SPECIFIER="$PROVISIONING_PROFILE_SPECIFIER")
fi

if [[ "$ALLOW_PROVISIONING_UPDATES" == "1" || "$ALLOW_PROVISIONING_UPDATES" == "true" || "$ALLOW_PROVISIONING_UPDATES" == "YES" ]]; then
  archive_cmd+=(-allowProvisioningUpdates)
fi

HOME="$XCODE_HOME" \
CLANG_MODULE_CACHE_PATH="$CLANG_MODULE_CACHE_PATH" \
"${archive_cmd[@]}"

if [[ -n "$EXPORT_OPTIONS_PLIST" ]]; then
  mkdir -p "$EXPORT_PATH"
  HOME="$XCODE_HOME" \
  CLANG_MODULE_CACHE_PATH="$CLANG_MODULE_CACHE_PATH" \
  xcodebuild \
    -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
    -exportPath "$EXPORT_PATH"
fi
