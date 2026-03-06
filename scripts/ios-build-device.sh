#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DERIVED_DATA_PATH="${AETHERIA_IOS_DERIVED_DATA_PATH:-/tmp/aetheria-ios-device-build}"
XCODE_HOME="${AETHERIA_IOS_HOME:-/tmp/aetheria-home}"
CLANG_MODULE_CACHE_PATH="${AETHERIA_IOS_CLANG_MODULE_CACHE_PATH:-/tmp/aetheria-clang-module-cache}"
CONFIGURATION="${AETHERIA_IOS_CONFIGURATION:-Release}"

mkdir -p "$XCODE_HOME" "$CLANG_MODULE_CACHE_PATH"

HOME="$XCODE_HOME" \
CLANG_MODULE_CACHE_PATH="$CLANG_MODULE_CACHE_PATH" \
xcodebuild \
  -project "$ROOT_DIR/ios/App/App.xcodeproj" \
  -scheme App \
  -configuration "$CONFIGURATION" \
  -destination generic/platform=iOS \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  build
