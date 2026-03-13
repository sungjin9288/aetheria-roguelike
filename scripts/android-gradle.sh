#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -gt 0 ]]; then
  TASK="$1"
  shift
else
  TASK="assembleDebug"
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home
  do
    if [[ -d "$candidate" ]]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  printf 'JAVA_HOME is not configured. Install Java 21 and export JAVA_HOME before running Android Gradle tasks.\n' >&2
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"
DEFAULT_GRADLE_USER_HOME="/tmp/aetheria-gradle"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$DEFAULT_GRADLE_USER_HOME}"

cd "$ROOT_DIR/android"
GRADLE_ARGS=("$TASK" "$@")

run_gradle() {
  ./gradlew "${GRADLE_ARGS[@]}"
}

if ! run_gradle; then
  if [[ "$GRADLE_USER_HOME" != "$DEFAULT_GRADLE_USER_HOME" ]]; then
    exit 1
  fi

  export GRADLE_USER_HOME="$(mktemp -d /tmp/aetheria-gradle-retry.XXXXXX)"
  printf 'Primary Gradle cache failed; retrying with a clean cache at %s\n' "$GRADLE_USER_HOME" >&2
  run_gradle
fi
