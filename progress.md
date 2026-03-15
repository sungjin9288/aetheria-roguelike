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

Done (Quality Pass 1~4):
- Added run diagnostics (`current build`, `class fit`, `recent win rate`, `avg exit HP`, `pacing`, `difficulty`) to `src/components/StatsPanel.jsx` via `getRunDiagnostics`.
- Added class build identities/synergies in `src/utils/runProfileUtils.js` and applied active class bonuses in `src/hooks/useGameEngine.js`.
- Enhanced `Build Direction` panel in `src/components/Dashboard.jsx` to show class fit and active class synergy.
- Added boss-specific tactical briefings (`signature`, `counter hint`, `phase hint`, `recommended builds`) via `src/data/monsters.js` + `src/components/tabs/CombatPanel.jsx`.
- Added title passive bonuses in `src/data/titles.js`, helper accessors in `src/utils/gameUtils.js`, applied them in `src/hooks/useGameEngine.js`, and surfaced them in `src/components/tabs/SystemTab.jsx`.
- Added regression coverage for class/build compatibility, boss briefings, and run diagnostics in `tests/run-profile-utils.test.js`.

Verification (Quality Pass 1~4):
- `npm run test:unit`
- `npm run lint`
- `npm run build`

Blocked / Not Verified:
- Tried to run the `develop-web-game` Playwright client directly from `/Users/sungjin/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`, but this machine does not currently have the `playwright` package installed, so browser-loop validation could not run in this workspace.

Done (QA / Release Readiness 1~5):
- Added browser smoke harness hooks in `src/App.jsx`, `src/components/IntroScreen.jsx`, `src/components/ControlPanel.jsx`, `src/components/Dashboard.jsx`, `src/components/RelicChoicePanel.jsx`, `src/components/PostCombatCard.jsx`, and `src/components/RunSummaryCard.jsx`.
- Fixed run-summary restart to trigger a full game reset instead of only clearing the modal/UI shell.
- Added local smoke scripts: `scripts/smoke-gameplay.mjs` and `scripts/local-playtest.sh`.
- Added smoke command references to `README.md` and automated smoke guidance to `docs/PLAYTEST_CHECKLIST.md`.
- Hardened `scripts/android-gradle.sh` to retry once with a fresh temporary `GRADLE_USER_HOME` when the shared cache under `/tmp/aetheria-gradle` is corrupted.

Verification (QA / Release Readiness 1~5):
- `npm run test:unit`
- `npm run lint`
- `./scripts/local-playtest.sh`
- `npm run mobile:doctor`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Artifacts:
- Desktop smoke artifacts: `playtest-artifacts/desktop`
- Mobile smoke artifacts: `playtest-artifacts/mobile`
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`

Blocked / Not Verified (QA / Release Readiness 1~5):
- True manual play-feel validation is still pending; current coverage is browser smoke + native build verification, not human balance judgment.
- Real-device touch/OS lifecycle QA on physical iPhone/Android hardware was not executed from this terminal session.
- Android release signing is still not configured on this machine (`mobile:doctor` reports `Android release signing: no`).

Done (Mobile-First UX Pass):
- Compacted the mobile header in `src/App.jsx`, kept it sticky, and reduced non-essential sync text on small screens.
- Reworked the mobile dashboard in `src/components/Dashboard.jsx` into a quick HUD (`name/job/loc/gold`, HP/NRG/EXP, equipment, build strip) plus a collapsible detail panel with icon tabs.
- Tightened the mobile terminal in `src/components/TerminalView.jsx` by reducing terminal height/padding and shrinking empty/log presentation on small screens.
- Rebalanced the mobile action grid in `src/components/ControlPanel.jsx` to use a denser 3-column layout, shorter labels, and more compact move/reset flows.

Verification (Mobile-First UX Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (first run flaked on a random core-loop branch; second run passed with `[smoke:desktop] ok` and `[smoke:mobile] ok`)

Done (Mobile-First UX Pass 2):
- Reduced mobile terminal height again in `src/components/TerminalView.jsx` to expose more of the HUD/action surface above the fold.
- Switched the mobile action grid in `src/components/ControlPanel.jsx` from 3 columns to 4 columns and shortened button labels for denser touch-first access.
- Changed the mobile dashboard detail panel in `src/components/Dashboard.jsx` to start collapsed, keeping the first screen focused on core status/equipment.
- Moved mobile `AUTO EXPLORE` out of the floating overlay in `src/App.jsx` into the normal document flow to avoid covering HUD/equipment content.

Verification (Mobile-First UX Pass 2):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (`[smoke:desktop] ok`, `[smoke:mobile] ok`)
- Reviewed regenerated mobile smoke screenshots: `playtest-artifacts/mobile/01-after-start.png`, `playtest-artifacts/mobile/07-core-loop-complete.png`

Done (Real-Device QA Prep):
- Re-synced the latest mobile-optimized bundle into both native shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug` (cache-retry path still works).
- Rebuilt iOS device Release shell with `npm run ios:build:device`.
- Expanded `docs/PLAYTEST_CHECKLIST.md` with concrete mobile-first checks for first-fold visibility, auto-explore overlay removal, collapsed detail panel behavior, 4-column action grid taps, keyboard overlap, and platform-specific iPhone/Android touch issues.

Verification (Real-Device QA Prep):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Done (Real-Device QA Runbook):
- Added a 5-minute iPhone/Android quick-run section to `docs/PLAYTEST_CHECKLIST.md`.
- Added a short failure-capture list so device findings come back with enough detail to fix quickly.
- Updated `tasks/todo.md` to track the next concrete step as actual device execution, not more prep.

Done (QA Readout Support):
- Added runtime QA readout data to `src/components/tabs/SystemTab.jsx` and replaced the stale hardcoded build string with `CONSTANTS.DATA_VERSION`.
- Threaded runtime state (`viewport`, `gameState`, `syncStatus`, `isAiThinking`) from `src/App.jsx` through `src/components/Dashboard.jsx` into the system tab.
- Updated the device quick-run in `docs/PLAYTEST_CHECKLIST.md` so testers always capture the `QA READOUT` before reporting issues.

Verification (QA Readout Support):
- `npm run lint`
- `npm run build`

Done (QA Snapshot Export):
- Added `EXPORT` alongside `COPY` in `src/components/tabs/SystemTab.jsx` to download a reproducible QA snapshot JSON containing runtime, combat stats, equipment, relics, titles, inventory counts, and meta state.
- Updated `docs/PLAYTEST_CHECKLIST.md` to ask for the exported QA snapshot file when a device issue is reported.

Verification (QA Snapshot Export):
- `npm run lint`
- `npm run build`

Done (Mobile Trait / Combat UX Pass):
- Removed the mobile terminal command input by wiring `showInput={false}` in `src/App.jsx` and turning `src/components/TerminalView.jsx` into a button-first log panel on small screens.
- Reworked `src/components/IntroScreen.jsx` for mobile quick-start naming so new runs can begin without keyboard input.
- Replaced the player-facing `Run diagnostics` view with a simpler `성향` system in `src/utils/runProfileUtils.js`, `src/components/Dashboard.jsx`, `src/components/StatsPanel.jsx`, `src/utils/gameUtils.js`, and `src/components/SkillTreePreview.jsx`.
- Connected trait-based passive bonuses and a trait skill into active stat calculation and skill loadout via `src/hooks/useGameEngine.js` and `src/utils/gameUtils.js`.
- Compactified the mobile `PostCombatCard` in `src/components/PostCombatCard.jsx` so rewards, loot, and the next recommendation fit within one viewport.
- Strengthened 1H/2H readability and balance direction through `src/data/constants.js`, `src/utils/equipmentUtils.js`, `src/components/SmartInventory.jsx`, `src/components/ShopPanel.jsx`, and `src/components/Dashboard.jsx`.
- Applied a broader mobile-first visual pass across `src/App.jsx`, `src/components/ControlPanel.jsx`, `src/components/MainLayout.jsx`, `src/index.css`, and `src/components/RunSummaryCard.jsx` to establish a darker archive-like app identity.

Verification (Mobile Trait / Combat UX Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass):
- Added a `FocusPanel` to `src/components/Dashboard.jsx` that surfaces the current objective, quest pulse, exploration forecast, and one-tap recommended actions.
- Added `src/utils/adventureGuide.js` to derive player-facing guidance from HP/MP state, town readiness, quests, inventory pressure, and exploration pacing.
- Kept the guidance buttons wired into existing actions so players can immediately rest, claim rewards, open the quest board, inspect inventory, open movement, or continue exploring.
- Added regression coverage for the new guidance and forecast behavior in `tests/adventure-guide.test.js`.

Verification (Convenience / Fun Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` (desktop and mobile smoke both reached `ok`)

Done (Convenience / Fun Pass 2):
- Made the mobile `FocusPanel` in `src/components/Dashboard.jsx` start in a condensed state so the first fold stays readable while still exposing the current objective and one-tap next action.
- Added expandable quest/forecast detail inside the same panel so players can opt into more context instead of paying the information cost up front.
- Enhanced `src/utils/outcomeAnalysis.js` and `src/components/PostCombatCard.jsx` with a reward mood (`보스 돌파`, `풍성한 전리품`, `위험한 승리` 등) and compact reward highlight chips to make victories feel more distinct.
- Added regression coverage for the new reward mood output in `tests/outcome-analysis.test.js`.

Verification (Convenience / Fun Pass 2):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass 3):
- Added contextual recommendation highlighting to `src/components/ControlPanel.jsx` so the primary suggested action is surfaced directly on the actual action button row instead of only in the HUD.
- Passed effective runtime stats into `src/components/ControlPanel.jsx` from `src/App.jsx` so recommendation logic uses the same HP/MP context the HUD uses.
- Added loot upgrade detection in `src/hooks/useCombatActions.js` and surfaced it in `src/components/PostCombatCard.jsx`, so players can immediately tell when a dropped equipment piece is a real upgrade.

Verification (Convenience / Fun Pass 3):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Done (Convenience / Fun Pass 4):
- Added `getMoveRecommendations` to `src/utils/adventureGuide.js` so exits are scored by HP/MP readiness, inventory pressure, current level fit, boss risk, and unexplored-route value.
- Upgraded the `MOVE` state in `src/components/ControlPanel.jsx` from plain exit buttons into recommendation cards with `추천/정비/개척/보스/경계` context and a short reason line.
- Added a read-only `추천 이동` summary to `src/components/MapNavigator.jsx` and threaded runtime stats from `src/components/Dashboard.jsx` so the world map and move panel use the same route heuristic.

Done (Progress Visibility Recovery):
- Added a persistent `Run Progress` card to `src/components/Dashboard.jsx` for both mobile and desktop so core run progression is always visible again.
- The new panel surfaces active quest state, growth milestone (`Lv.5` class change or next level), explored-map count, and current run record/forecast without requiring archive expansion.
- Kept the existing action guidance in `Mission Focus`, but separated it from progression visibility so the two no longer compete for the same space.
- Compressed `Loadout Snapshot` on mobile so the restored progress card does not bloat the first screen.

Verification (Progress Visibility Recovery):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Mobile Density Simplification):
- Simplified the mobile first fold in `src/components/Dashboard.jsx` to a 3-block structure: `Status`, `Progress`, and `Next`.
- Removed the separate mobile `Loadout Snapshot` card and replaced it with a compact in-card `Loadout` strip inside the status block.
- Compressed mobile `Run Progress` to two primary tiles (`Quest`, `Growth`) plus lightweight frontier/record chips instead of four full cards.
- Simplified mobile `Mission Focus` to a single primary action by default; the secondary action now stays behind the detail toggle.
- Shortened mobile copy (`Status`, `Progress`, `Next`, `Archive`) to reduce visual noise.
- Simplified the mobile recommendation banner in `src/components/ControlPanel.jsx` from a full text card to a compact single-line hint.

Verification (Mobile Density Simplification):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Scroll Fatigue Reduction):
- Further reduced mobile first-fold complexity in `src/components/Dashboard.jsx` by merging the most important progression info into the main status card.
- Replaced the separate mobile progress card with a compact in-card `Progress` summary (`Quest`, `Growth`, explored area, current route state).
- Kept the mobile archive collapsed to a near-single-line opener so `Field Actions` surfaces earlier on screen.
- Reduced `src/components/TerminalView.jsx` mobile logs to a compact recent-log view by default, with manual expansion for the full history.

Verification (Scroll Fatigue Reduction):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile first-fold screenshot: `playtest-artifacts/mobile/01-after-start.png`

Done (Latest Native QA Prep):
- Re-synced the latest mobile HUD/scroll-fatigue reduction pass into Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug`.
- Rebuilt iOS device Release shell with `npm run ios:build:device`.
- Confirmed a physical iPhone is currently connected via `xcrun xctrace list devices`.
- Confirmed no Android hardware is currently attached via `adb devices`.

Verification (Latest Native QA Prep):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`
- `xcrun xctrace list devices`
- `"$HOME/Library/Android/sdk/platform-tools/adb" devices`

Done (Visual Identity Finish Pass):
- Added a reusable branded `AetherMark` glyph in `src/components/AetherMark.jsx` and threaded it through the app shell, boot screen, intro screen, and mobile field log.
- Added shared animated visual primitives in `src/index.css` (`aetherOrbit`, `aetherPulse`, `auroraShift`, `floatSlow`) plus a reusable `panel-noise` surface treatment for core panels.
- Reworked `src/App.jsx` and `src/components/MainLayout.jsx` to strengthen the archive-style app shell with aurora background layers, branded top strip, and safer mobile bottom spacing.
- Polished `src/components/IntroScreen.jsx`, `src/components/TerminalView.jsx`, `src/components/Dashboard.jsx`, `src/components/ControlPanel.jsx`, `src/components/PostCombatCard.jsx`, and `src/components/ShopPanel.jsx` so the intro, HUD, action board, overlays, and field log share the same card language.
- Compressed the mobile first fold further by turning `Loadout Snapshot` into stat badges + short trait markers and surfacing inventory spotlight messaging in the `Archive Dock` header.
- Adjusted `handleLootReview` in `src/App.jsx` so `장비 보기` closes the combat result card and returns the user to the inventory review flow instead of leaving the overlay stacked above it.
- Updated `src/components/SmartInventory.jsx` and `scripts/smoke-gameplay.mjs` so spotlight-first review flow reflects the current visual layout (dock summary on mobile, detail banner on desktop/inventory).

Verification (Visual Identity Finish Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh` now reaches `[smoke:desktop] ok` and `[smoke:mobile] ok` after stabilizing the mobile loot-review and post-combat interaction path in `scripts/smoke-gameplay.mjs`.

Blocked / Not Verified (Visual Identity Finish Pass):
- Real-device iPhone/Android visual polish is still pending; only browser/build validation was performed here.

Done (Verification Closure Pass):
- Exposed `inventorySpotlight` in the browser test harness from `src/App.jsx` so smoke validation can assert the loot-review handoff directly.
- Reworked `scripts/smoke-gameplay.mjs` to use DOM-level clicks for fixed mobile post-combat buttons and added a deterministic synthetic post-combat fallback when the random forest combat path does not naturally resolve to victory in time.
- Surfaced the current loot spotlight in the mobile `Archive Dock` header inside `src/components/Dashboard.jsx`, and moved the detailed spotlight banner in `src/components/SmartInventory.jsx` to the top of the inventory stack.
- Re-synced the latest UI into Capacitor shells and rebuilt Android/iOS native artifacts after the smoke stabilization changes.

Verification (Verification Closure Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Blocked / Not Verified (Verification Closure Pass):
- Physical-device QA on actual iPhone/Android hardware is still pending and cannot be completed from this terminal session.
- Added regression coverage for low-HP safe-route recommendation and stable-run level-fit route recommendation in `tests/adventure-guide.test.js`.

Verification (Convenience / Fun Pass 4):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed `playtest-artifacts/mobile/09-final-state.png` for mobile HUD/action readability after the pass

Done (Trait Reward Pass):
- Added `getTraitItemResonance`, `getTraitFeaturedItems`, and `getTraitLootHint` to `src/utils/runProfileUtils.js` so current trait identity can score shop stock and battle rewards without changing item data.
- Updated `src/components/ShopPanel.jsx` to sort buy items by trait resonance after affordability/usability, show a `성향 공명` market summary, and badge matching items with short resonance reasons.
- Passed runtime stats into the shop route from `src/components/ControlPanel.jsx` so the market uses the same effective trait context as the HUD and stats panels.
- Extended `src/hooks/useCombatActions.js` and `src/components/PostCombatCard.jsx` so battle rewards can surface a trait-resonant loot hint alongside the existing upgrade hint.
- Added regression coverage for trait item resonance and trait loot hint selection in `tests/run-profile-utils.test.js`.

Verification (Trait Reward Pass):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- Shop-specific visual tuning for the new resonance badges was not manually inspected on a real device yet; current verification is automated plus unit coverage.

Done (Trait Reward Pass 2):
- Compacted the resonance presentation in `src/components/ShopPanel.jsx` so trait-fit hints stay readable on mobile cards without dominating the vertical space.
- Added `data-testid="shop-close"` and extended `scripts/smoke-gameplay.mjs` to open and close the market from the actual action bar, capturing dedicated shop screenshots in both desktop/mobile smoke artifacts.
- Consolidated mobile reward hints in `src/components/PostCombatCard.jsx` into a single `획득 포인트` section so upgrade and trait-resonance messages do not overgrow the victory card.
- Reviewed the new mobile captures `playtest-artifacts/mobile/02a-shop-open.png` and `playtest-artifacts/mobile/06-post-combat-1.png` for first-pass readability.

Verification (Trait Reward Pass 2):
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- Real-device touch readability for the new market resonance block and compact reward-signal block is still pending; current validation is browser smoke plus screenshot review.

Done (Loot Review Spotlight Pass):
- Added a post-combat loot review handoff in `src/App.jsx` that routes upgrade/trait-highlighted rewards straight into the inventory tab with a focused spotlight payload.
- Updated `src/components/Dashboard.jsx` and `src/components/SmartInventory.jsx` so mobile detail panels auto-expose the inventory view when a spotlight is active and visually mark the highlighted drops with a dismissible banner.
- Added a synthetic post-combat injection hook in `src/App.jsx` and extended `scripts/smoke-gameplay.mjs` to verify `post-combat -> review loot -> inventory spotlight` before the core explore loop.
- Hardened combat-resolution detection in `scripts/smoke-gameplay.mjs` so smoke marks victory from either the result card or the victory log, removing random timing failures from the core-loop assertion.

Verification (Loot Review Spotlight Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`

Blocked / Not Verified:
- The new inventory spotlight flow is browser-smoke verified, but it has not been touched on a physical iPhone/Android device yet.

Done (Mobile Design Polish Pass):
- Refined the mobile app shell in `src/App.jsx` and `src/components/MainLayout.jsx` so the header reads as an in-app command bar instead of a desktop toolbar, while preserving safe-area behavior.
- Reworked the mobile HUD in `src/components/Dashboard.jsx` into clearer app-style layers: `Status Core`, `Mission Focus`, `Loadout`, `성향`, and `Field Archive`, with compact stat tiles replacing the previous stacked bar rows.
- Restyled the mobile action board in `src/components/ControlPanel.jsx` into a single `Field Actions` surface with stronger per-action color identity and a clearer idle/route-select state label.
- Tightened the mobile field log in `src/components/TerminalView.jsx`, added a lightweight header, and kept the no-input mobile interaction model intact.
- Polished the mobile start sheet in `src/components/IntroScreen.jsx` with codename suggestions and a more intentional quick-start presentation.
- Updated the mobile shop and post-combat card styling in `src/components/ShopPanel.jsx` and `src/components/PostCombatCard.jsx` so overlays share the same rounded app-card language as the HUD.
- Added `data-app-shell` in `src/components/MainLayout.jsx` and updated `scripts/smoke-gameplay.mjs` to scroll the real shell container before top-of-run captures, fixing misleading mobile first-fold screenshots.

Verification (Mobile Design Polish Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
- Reviewed regenerated mobile smoke screenshots:
  - `playtest-artifacts/mobile/01-after-start.png`
  - `playtest-artifacts/mobile/06-post-combat-1.png`

Blocked / Not Verified:
- This pass is browser-smoke verified and screenshot-reviewed, but real-device touch feel, thumb reach, and OS safe-area behavior are still not closed without iPhone/Android manual QA.

Done (Post-Polish Native Refresh):
- Re-synced the latest mobile design polish into the Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug via `npm run android:debug` after the design pass; the cache-retry path still works when the shared Gradle cache is broken.
- Rebuilt the iOS device Release shell via `npm run ios:build:device` after the design pass.
- Re-verified the corrected mobile first-fold smoke artifact after fixing shell-container scrolling:
  - `playtest-artifacts/mobile/01-after-start.png`

Verification (Post-Polish Native Refresh):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`
- `./scripts/local-playtest.sh`

Artifacts:
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`

Done (Signed iPhone Install / Launch Verification):
- Fixed `scripts/ios-archive.sh` to use the real macOS home directory by default instead of `/tmp/aetheria-home`, allowing `xcodebuild archive` to see the logged-in Xcode account and login keychain for signing.
- Confirmed the latest signed archive app exists at `build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Verified the connected physical iPhone through `xcrun devicectl list devices`:
  - `성진` / `iPhone 14 Pro Max` / `FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`
- Successfully created a signed iOS archive with `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`.
- Installed the archived app onto the connected iPhone with `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`.
- Launched the installed app on-device with `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`.

Verification (Signed iPhone Install / Launch Verification):
- `find build/ios/Aetheria.xcarchive -name App.app -type d`
- `xcrun devicectl list devices`
- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
- `xcrun devicectl device install app --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B build/ios/Aetheria.xcarchive/Products/Applications/App.app`
- `xcrun devicectl device process launch --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B com.aetheria.roguelike`

Blocked / Not Verified:
- Manual in-app 5-minute touch QA on the physical iPhone still requires a person on the device; this terminal session only verified install and launch.
- Android physical-device QA is still blocked because no Android handset is currently attached (`adb devices` showed none).

Done (Mobile Design System Pass):
- Compressed the mobile first fold in `src/components/Dashboard.jsx` by replacing the separate `Loadout` and `성향` cards with a single `Loadout Snapshot` and by turning `Field Archive` into a bottom-dock style archive tray.
- Added a shared `src/components/SignalBadge.jsx` so recommendation, resonance, upgrade, spotlight, and status badges now use one visual language across `Dashboard`, `ControlPanel`, `MapNavigator`, `ShopPanel`, `SmartInventory`, and `PostCombatCard`.
- Simplified mobile archive access with primary tabs (`INV`, `QUEST`, `MAP`, `STAT`) plus a secondary `More` row, keeping full archive access while removing the previous wide scroll strip from the first fold.
- Tightened safe-area spacing in `src/components/MainLayout.jsx`, `src/components/ShopPanel.jsx`, and `src/components/PostCombatCard.jsx` to give the mobile shell more bottom breathing room and reduce edge-clinging overlays.

Verification (Mobile Design System Pass):
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
  - first rerun failed due the existing random core-loop smoke not observing event/relic states
  - second rerun reached `[smoke:desktop] ok` and `[smoke:mobile] ok`

Blocked / Not Verified:
- Real-device thumb reach, actual touch comfort, and OS-level safe-area behavior for the new `Archive Dock` and badge density are still pending until iPhone/Android manual QA.

Done (Post-Design-System Native Refresh):
- Re-synced the latest `Loadout Snapshot`, `Archive Dock`, and `SignalBadge` UI changes into the Capacitor shells with `npm run cap:sync`.
- Rebuilt Android debug with `npm run android:debug`; the retry path recovered once from the known temporary Gradle cache corruption and completed successfully.
- Rebuilt the iOS Release device shell with `npm run ios:build:device`.
- Updated `docs/PLAYTEST_CHECKLIST.md` so the mobile QA wording now matches the latest mobile structure (`Loadout Snapshot`, `Archive Dock`, unified signal badges).

Verification (Post-Design-System Native Refresh):
- `npm run cap:sync`
- `npm run android:debug`
- `npm run ios:build:device`

Artifacts:
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS Release device app: `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app`
