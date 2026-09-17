# V22 native package verification — 2026-09-09

## Result

Local Android debug and iOS unsigned builds passed. Neither package was installed. Physical Android is excluded.

- Android19256 exit0; APK `android/app/build/outputs/apk/debug/app-debug.apk`,226651015 bytes, SHA256 `de49319bd05f95596ea05cd57954e42611c18ad8c8821e3df7da710c5a137d64`.
- iOS99757 exit0, `BUILD SUCCEEDED`, log `/tmp/aetheria-boss22-ios-resume.log`.
- App `/tmp/aetheria-boss22-ios.53lmUl/Build/Products/Release-iphoneos/App.app`.
- Main `assets/index-Bwyt3YNW.js`, SHA256 `6142388b9fe62cb7c91e6635f92eaa6d631cbf64ac9aaa8340c4e87b74953f4d`.
- `python3 output/verify-v8-native.py /tmp/aetheria-boss22-ios.53lmUl`: exit0,328 paths per package match source/dist/APK/iOS (254 monsters,53 location PNGs,18 avatars,2 Earth Verdict images,main JS).
- Additional dark-greatsword `assets/equipment-exact/auto/auto-4473919467f6.png` matched all four surfaces, SHA256 `2e1d2c19bdfd3b49b3381cee405653d844cbc05c9fef70cbb4a4b26f1e0b90e5`. Total329 checked paths per package, not exhaustive package-file coverage.
- Tracked Android/iOS drift0. Existing archive preserved. No signing/install/push/publication.

## Interrupted first attempt and diagnostic

iOS48667 was explicitly terminated after over10minutes at compiler-info discovery; exit143 and `BUILD INTERRUPTED`. Owned PIDs67632/68679/69230 were absent afterward. Clang sample showed a verbose-command write wait, not game compilation. Original log `/tmp/aetheria-boss22-ios.log` and sample are preserved.

The exact clang command subsequently ran directly with redirected output in0.09seconds, exit0 (`/tmp/aetheria-boss22-clang-direct.log`). One canonical build rerun against the same preserved derived directory succeeded. No source/configuration change, cache deletion or unrelated process restart was used. Persistent compiler failure was not reproduced; precise initial Xcode wait cause remains unknown.

Reproduce unsigned build: `AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-boss22-ios.53lmUl npm run ios:build:device`.

## Remaining

Current iPhone installation, exact PID survival and actual background/foreground saved-state preservation remain unverified. Package success is not device-test success or whole-Goal completion.
