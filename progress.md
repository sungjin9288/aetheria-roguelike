Original prompt: 좋아. 추천사항 전부 다 반영해줘.

Done:
- Rewrote `src/App.jsx` to integrate upgraded CombatEngine flow end-to-end.
- Added skill-slot selection flow (`actions.cycleSkill`) and wired selected-skill execution.
- Applied per-turn state ticking (`CombatEngine.tickCombatState`) before enemy action.
- Updated event handling to support structured `outcomes` payload when provided.
- Improved enemy spawn payload with `baseName` and behavior `pattern`.
- Updated item usage logic for `hp/mp/cure/buff` item types.
- Updated crafting to resolve real item definitions by recipe output name.
- Kept quest and loot logic aligned with prefixed enemy names via baseName-aware flow.
- Fixed stale quick-slot consumable reuse by validating inventory ownership and sanitizing slots on state load/update.
- Blocked state-leaking commands during modal/event flows (`event`, `job_change`, `quest_board`, `shop`, `crafting`, `ascension`, `dead`).
- Completed Daily Protocol reward flow for `essence`, `item`, `relicShard`, and wired `goldSpend` progress from rest/shop/crafting.
- Enforced quest minimum-level checks in both UI and action layer.
- Applied non-combat EXP gains through shared level-up logic so quest/event rewards level immediately.
- Closed job-change UX gaps by recalculating class vitals, resetting skill loadout, and closing the modal on success.
- Replaced dead title activation wiring with a real `setActiveTitle` action and added a working crafting panel.
- Applied equipment job restrictions to smart-equip recommendations and equip actions.
- Restored PostCombatCard on mobile and aligned MP/quick-slot UI with effective runtime stats.

Done (Mobile):
- Added `@capacitor/android` and generated the native `android/` project.
- Synced current web bundle into both `ios/` and `android/` via `npx cap sync`.
- Added `android:sync`, `android:open`, and build-first `cap:sync` scripts.
- Updated README mobile setup notes for iOS + Android sync flow.
- Installed local native build prerequisites on this machine: `openjdk`, `openjdk@21`, `android-commandlinetools`.
- Provisioned Android SDK packages (`platform-tools`, `platforms;android-36`, `build-tools;36.0.0`) and verified Gradle APK build.
- Verified iOS generic device build from `xcodebuild` with Capacitor Swift package resolution.
- Added `docs/MOBILE_SETUP.md` for repeatable native setup/build instructions.
- Aligned iOS bundle identifier with Capacitor/Android (`com.aetheria.roguelike`).
- Replaced placeholder web app manifest icon with generated native app icon assets and added `apple-touch-icon`.
- Added mobile release automation scripts: `mobile:doctor`, `android:debug`, `android:release`, `android:release:apk`, `ios:build:device`, `ios:archive`.
- Added `scripts/android-gradle.sh`, `scripts/ios-build-device.sh`, `scripts/ios-archive.sh`, and `android/key.properties.example`.
- Added `docs/MOBILE_RELEASE.md` and `ios/ExportOptions/AppStore.plist.example` for repeatable store submission prep.
- Added `docs/STORE_SUBMISSION_GUIDE.md` with step-by-step Xcode/TestFlight/Play Console submission flow and failure interpretation.
- Added mobile release automation scripts: `mobile:doctor`, `android:debug`, `android:release`, `android:release:apk`, `ios:build:device`, `ios:archive`.
- Added `scripts/android-gradle.sh`, `scripts/ios-build-device.sh`, `scripts/ios-archive.sh`, and `android/key.properties.example`.
- Added `docs/MOBILE_RELEASE.md` and `ios/ExportOptions/AppStore.plist.example` for repeatable store submission prep.

Done (UI/CLI):
- Rewrote `src/components/ControlPanel.jsx` with combat skill display + cooldown and skill cycling button.
- Rewrote `src/utils/commandParser.js` and added `nextskill/skillnext/sn/스킬변경`.

Verification:
- `npm run lint`
- `npm run build`
- Local Vite dev server boot verified (`http://127.0.0.1:4173/` → HTTP 200, app HTML + `/src/main.jsx` served)
- `npx cap add android`
- `npx cap sync`
- `npm run cap:sync`
- Android native debug build succeeded with `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH GRADLE_USER_HOME=/tmp/aetheria-gradle ./gradlew assembleDebug`
- Android debug APK output verified at `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS generic device build succeeded with `HOME=/tmp/aetheria-home CLANG_MODULE_CACHE_PATH=/tmp/aetheria-clang-module-cache xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /tmp/aetheria-ios-device-build CODE_SIGNING_ALLOWED=NO build`
- iOS app bundle output verified at `/tmp/aetheria-ios-device-build/Build/Products/Debug-iphoneos/App.app`
- Re-ran `npm run cap:sync`, Android debug build, and iOS generic device build after metadata/icon alignment; both remained successful.
- `npm run mobile:doctor` verified iOS bundle/version/signing metadata, Android SDK 36, Java 21, and missing Android release signing inputs.
- `npm run cap:sync` succeeded after release-doc/script changes.
- `npm run android:debug` succeeded through `scripts/android-gradle.sh`.
- `npm run ios:build:device` succeeded through `scripts/ios-build-device.sh` with Release configuration and `CODE_SIGNING_ALLOWED=NO`.
- `npm run android:release` succeeded with a temporary validation keystore at `/tmp/aetheria-release-test.jks`, producing a signed test bundle for release-path verification.
- `npm run ios:archive` failed without local provisioning assets; retrying with `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1` still failed because this machine has no Xcode account configured (`No Accounts`) and no matching profile for `com.aetheria.roguelike`.

External note:
- Playwright loop with `$WEB_GAME_CLIENT` was not executed in this workspace because that client/env is not configured here.
- Native IDE open (`npm run ios:open`, `npm run android:open`) was not executed here because GUI launch is outside this terminal session.
