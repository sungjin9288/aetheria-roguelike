# Mobile Build Guide

This project ships as a Capacitor app for both iOS and Android.

## Prerequisites

- Node.js 18+
- Xcode
- Homebrew
- Java 21
- Android command-line tools or Android Studio

Recommended Homebrew setup on macOS:

```bash
brew install openjdk@21
brew install android-commandlinetools
```

## Android

Set Java for the current shell:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH"
```

Install SDK packages and accept licenses:

```bash
sdkmanager --sdk_root="$HOME/Library/Android/sdk" --licenses
sdkmanager --sdk_root="$HOME/Library/Android/sdk" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0"
```

Create `android/local.properties`:

```properties
sdk.dir=/Users/your-user/Library/Android/sdk
```

Sync and build:

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS

Sync web assets:

```bash
npm run ios:sync
```

Verify the native project from CLI:

```bash
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -destination generic/platform=iOS \
  -derivedDataPath /tmp/aetheria-ios-device-build \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Open the project in Xcode:

```bash
npm run ios:open
```

Build output:

```text
/tmp/aetheria-ios-device-build/Build/Products/Debug-iphoneos/App.app
```

## Notes

- `android/local.properties` is machine-local and already ignored by `android/.gitignore`.
- `npm run cap:sync` rebuilds the web app and syncs both native platforms.
- For release builds, use `npm run mobile:doctor` first and then follow `docs/MOBILE_RELEASE.md`.
