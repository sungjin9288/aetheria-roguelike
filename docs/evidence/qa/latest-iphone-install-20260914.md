# Latest iPhone reinstall — 2026-09-14

User authorized reinstalling the latest version. Same `com.aetheria.roguelike.freshqa` bundle retained; no uninstall or save reset.

- `npm run cap:sync` and isolated signed archive: session 67784 exit 0, `ARCHIVE SUCCEEDED`.
- Artifact: `/tmp/aetheria-iphone-20260914.DuM9oA/Aetheria.xcarchive/Products/Applications/App.app`.
- `codesign --verify --deep --strict`: PASS. All 2,265 current production dist files match archived public bytes. All 884 image/JS records from the Sep 10 verified checkpoint match the freshly built dist.
- `npm run mobile:doctor`: exit 0; App Store distribution and Android release signing remain unavailable, neither needed for this development install.
- Device install session 58844: exit 0, explicit `App installed` receipt at `/tmp/aetheria-iphone-20260914.DuM9oA/install.json`. Target: paired iPhone 14 Pro Max. Installed container `A8CC74EE-80B0-42D3-AE41-93B320767283`.
- Launch: exit 1, CoreDevice 10002 / Security. Actual Mirroring tap displayed `신뢰하지 않는 개발자`. User developer trust is required; successful launch and post-update save restore are not yet verified.
- Native tracked drift 0; `git diff --check` PASS before this documentation update. Full gameplay gates were not rerun for this reinstall-only task; Sep 10 full results remain historical evidence.

No game source change, uninstall, reset, commit, push or publication. Existing artifacts preserved.

## After user completed developer trust

- Launch session 47531 exit 0; receipt `launch-after-trust.json` in the same artifact directory. PID 57951 executes from installed container `A8CC74EE-80B0-42D3-AE41-93B320767283`; no terminate-existing flag.
- Actual iPhone Mirroring: loading screen → returning-player panel → main town screen. Closed only the returning panel X; no reward claim, movement, purchase or reset.
- Existing save restored: level 1, starting village, HP 130/178, MP 32/52, EXP 37/200, gold 318. Screen explicitly reports the saved adventure was loaded. This verifies visible local progress, not exhaustive inventory or cloud recovery.
- Authentication-delay/offline-mode notice remains; cloud sync is not claimed. Developer trust blocker resolved. Reinstall and launch verification complete; extended gameplay/lifecycle checks remain separate.
