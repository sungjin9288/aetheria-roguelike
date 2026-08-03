#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="${AETHERIA_IOS_ARCHIVE_PATH:-$ROOT_DIR/build/ios/AetheriaMaterialQA.xcarchive}"
DERIVED_DATA_PATH="${AETHERIA_IOS_DERIVED_DATA_PATH:-/tmp/aetheria-ios-material-qa}"
BUNDLE_ID="${AETHERIA_IOS_PRODUCT_BUNDLE_IDENTIFIER:-com.aetheria.roguelike.freshqa}"

restore_production_assets() {
  local archive_status=$?
  local restore_status=0
  trap - EXIT

  printf '[ios-material-qa] restoring production web assets\n'
  cd "$ROOT_DIR"
  npm run build || restore_status=$?
  if [[ "$restore_status" -eq 0 ]]; then
    npx cap copy ios || restore_status=$?
  fi

  if [[ "$archive_status" -ne 0 ]]; then
    exit "$archive_status"
  fi
  exit "$restore_status"
}

trap restore_production_assets EXIT

cd "$ROOT_DIR"
printf '[ios-material-qa] building isolated item-investment scenario\n'
VITE_DEVICE_QA_SCENARIO=item-investment npm run build
npx cap copy ios

printf '[ios-material-qa] archiving %s\n' "$BUNDLE_ID"
AETHERIA_IOS_ARCHIVE_PATH="$ARCHIVE_PATH" \
AETHERIA_IOS_DERIVED_DATA_PATH="$DERIVED_DATA_PATH" \
AETHERIA_IOS_PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES="${AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES:-1}" \
bash scripts/ios-archive.sh
