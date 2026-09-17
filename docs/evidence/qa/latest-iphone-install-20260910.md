# Latest iPhone update — 2026-09-10

User explicitly authorized latest installation with iPhone Mirroring available. Existing bundle ID `com.aetheria.roguelike.freshqa` retained; no uninstall/reset or gameplay reward action.

## Artifact and command evidence

- Existing archive workflow15519 exit0, isolated archive `/tmp/aetheria-latest-install.7x6wvl/AetheriaLatest.xcarchive`. Development signing/provisioning used existing project settings; no store export/upload.
- `codesign --verify --deep --strict` passed. Signed app's884 selected image/JS paths match the verified latest `output/perf-fix-native-20260910.json` SHA records. No claim of device filesystem byte verification.
- Install91578 exited2 at60s; `install.json` records timeout, not success. Do not relabel it exit0. No second install was sent. Mirroring subsequently showed Aetheria `로드 중…`, then normal icon with the blue updated-app dot.
- Exact app query12440/76059 exit0: installed bundle remains1.1.0/build2. Version number was not incremented and alone cannot prove latest contents.
- Launch67635 exit0; structured receipt `/tmp/aetheria-latest-install.7x6wvl/launch.json`:PID39312, executable under installed B297792C-BA7E-421E-9A38-FFC1B977FB5B/App.app. Launch did not request termination of an existing instance.

## Actual surface

Owner viewed Mirroring after launch: returning-player panel, existing level1/start-village save. Closed only its X. Main screen showed saved adventure restored, HP130/178, MP32/52, EXP37/200, gold318. No new run, claim, purchase, movement or reset performed. Existing save visible after update; this is not an exhaustive inventory/cloud restore proof.

The screen also reported authentication delay and offline mode. Local save restored and game screen rendered; cloud authentication/sync success is not claimed. Actual background/foreground save-resume and long-term PID survival remain separate gates. Original install timeout and all archive/receipt files preserved. `git diff --check` PASS/native tracked drift0. No commit/push/publication.
