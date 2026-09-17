# Character aperture correction

Current status: all eight reviewed aperture corrections are adopted into canonical source/runtime paths. Actual portrait UI, full verification and local debug/unsigned native packaging are complete. No device installation or whole-game completion claim. The earlier two-character preparation notes below are preserved as history.

## Eight-character adoption — 2026-09-07

Ranger, hunt-lord, mage, archmage, grand-mage, cleric, paladin and shaman are included. Original eight masters are preserved byte-for-byte in `originals/`; `prepare.py` now reads that pinned directory, not the corrected canonical source paths. Previous18 runtime PNGs and old provenance/contact sheets are preserved in `previous-runtime/` and `previous-evidence/`. The earlier `prepared/` two-character output remains unchanged; the complete candidate is `prepared-eight/`.

The six new original PNGs were individually inspected. `output/playwright/character-staff-mask-review.png` marks removed pixels in red; owner confirmed those areas follow staff/ring/orbit/body gaps while robes, crystals, shields, holy-symbol white centers and spirit faces remain. `character-staff-normalized-comparison.png` compares current/prepared96/64px on both backgrounds; prominent false white interiors are gone. These are Pillow review sheets, not actual-avatar browser evidence. Minor pre-existing edge fringes and unselected ambiguous detail remain; this is not global white removal or whole-image decontamination.

TDD: the new six-character preservation test failed on missing mage correction, then passed. The adoption contract failed on ranger source SHA, then passed after all eight source/runtime copies were connected. An initial raw-buffer assertion was stopped because constructing its PNG diff was unnecessarily expensive; the rerun uses SHA equality and its explicit failure is in `/tmp/aetheria-character-adoption-red-sha.log`. This does not change the equality contract. Focused character24/24, ESLint, art write/verify and diff check PASS. Both preparation runs verify all eight files and reject source drift/existing destinations.

Production renderer replay in `output/character-eight-replay/` matches all18 current runtime PNGs. Exactly8 runtime PNGs changed; other10 PNGs and provenance records are identical. Current provenance updates only the16 affected source/export hashes and preserves prompt/history/other fields. Canonical contact sheets were refreshed with their previous versions retained. All18 current source/runtime SHA records were independently checked against files.

Original full handle89516 exited1 after4380units and the first59 E2E passed: three later tests timed out across matching macOS Clamshell/Maintenance Sleep intervals. All three passed unchanged after wake. The preserved failure and exact sleep evidence are in `docs/evidence/qa/character-art-full-sleep-20260907.md`. Fresh full80148 exited0:4380units, desktop/mobile smoke and117E2E passed, with the nonfatal desktop browser-close warning retained. Log `/tmp/aetheria-character-eight-full-awake.log`. No affected character image/preparation/provenance path is in the progression diagnostic source list, so that evidence was not rewritten.

Production build:guard/cap:sync/mobile:doctor exited0, then Android debug35898 and iOS unsigned63006 exited0. Both packages match all328 selected production paths byte-for-byte (254monsters,53locations,18characters,2Earth Verdict assets,main JS); native tracked drift0. Paths and hashes are in `native-checkpoint.json`. Logs `/tmp/aetheria-character-{production,cap,doctor,android,ios}.log`. Missing release signing inputs and disconnected iPhone remain external gates. Existing archive was not changed; no device installation, commit or publication.

## Actual portrait UI — 2026-09-07

Owner inspected all eight complete390×844 equipment-screen captures at `output/playwright/character-eight-<slug>-390x844.png`. Each expected canonical768px PNG decoded successfully and matched the `직업 초상 · <job>` label; portrait ancestry opacity reached1 before capture, and horizontal overflow was false for every screen. The removed bow/staff/halo backgrounds no longer appear as large white patches. Costume, crystals, staff, shield and spirits remain visible; this does not claim tiny decorative details are readable at every size. Browser log: `/tmp/aetheria-character-eight-browser.log`; console reports0errors/0warnings.

This uses a separate `deviceQa=item-investment` save and controlled job fixtures, not natural level75 progression or a production user save. Empty equipment fields supplied by the fixture were normalized on restore to the default rusty dagger/tunic with no offhand. The screenshots show that actual restored state; they are **not empty-equipment or legal-build proof**. The portrait is job-fixed, not a live equipment composite. Browser `character-eight` and its4407 dev server were closed after capture. No runtime test API change or user save mutation was made. Full gate and local native outcomes are recorded separately above.

The user approved Python/Pillow processing with original preservation. `prepare.py` pins the two existing masters, changes only alpha in reviewed seed-connected bright neutral regions, and uses the existing `process_character_art.normalize_character` renderer. It does not change the generic edge-connected background policy or remove all pale pixels. The ranger's ambiguous quiver whites are excluded.

Run from the repository root with Python3 and the existing Pillow installation:

```sh
python3 scripts/art_sources/character_alpha_v1/prepare.py /tmp/aetheria-new-bow-candidate
node --import tsx --test tests/character-aperture-source.test.js tests/character-appearance.test.js
```

The destination must not exist. Source hash drift is rejected before creating it. Source and runtime PNGs are separate copies under the destination, alongside `receipt.json`; canonical source/runtime paths are never written by this command. The fixed renderer contract is768×768, foot baseline708, matching the current character manifest.

## Verification — 2026-09-07

- RED missing correction module, then GREEN actual source mask regression. Ranger removes51945 reviewed background pixels, hunt-lord42852. All changed pixels retain RGB and only change alpha255→0. Bow strings, costume/eye samples and ambiguous quiver whites remain identical. Original decoded pixels and file bytes are unchanged.
- RED missing preparation API, then GREEN deterministic two-run outputs, source hash drift rejection and existing-output refusal without changing prior bytes. Both exported canvases are768px with baseline708.
- Focused character suite22/22 and focused ESLint PASS; log `/tmp/aetheria-bow-focused.log`. Diff check PASS. New helper tests are not claimed as part of the previous4376-unit full gate.
- Owner inspected both normalized full-size outputs and `output/playwright/character-bow-normalized-comparison.png` at96/64px on dark/light backgrounds. The large white bow interiors disappear; the strings and bow silhouettes remain. Existing thin bright edge fringes remain visible at full resolution; no general edge decontamination was performed. This is a Pillow comparison, not browser/actual-avatar proof.

`prepared/receipt.json` records source/output hashes and `runtimeAdopted:false`. The rejected older generated extraction and all canonical originals are preserved. Next: prepare the six remaining reviewed staff/halo apertures, inspect the combined candidate set in actual portrait UI, then integrate corrected sources/runtime/provenance and run the full/art/native gate as one coherent character slice. No gameplay/manifest/native artifact changed in this preparation step.
