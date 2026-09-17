# Regional five — browser source-size review

## Current adoption — 2026-09-07

The five selected corrections are now in the canonical catalog: 거대 지네, 광풍의 하피, 물의 정령, 암흑 마법사 and 코볼트 광부. Earlier candidate-stage decisions below are preserved as history, not the current adoption state. Dark mage uses the brighter `dark-mage-readable.png`, not the rejected dark original.

Python/Pillow processing was explicitly approved with original preservation. `prepare.py` pins five master hashes, removes only seed-connected neutral background (`min RGB >=225`, channel spread<=12), thresholds copied alpha at128 and nearest-neighbor fits the visible sprite into160px with8px margin/baseline151. Harpy and miner have painted checkerboards: border-connected extraction plus manually inspected enclosed gaps removes them. The harpy white eye at `(540,455)` is deliberately not seeded and remains pixel-identical. Enlarged evidence: `output/playwright/regional-hole-review.png`. No global white deletion or color-keying of the whole body is used.

`exports/receipt.json` retains preparation hashes and exact background seeds. Original masters, rejected candidates and prompts are preserved; `previous/` holds the old five runtime PNGs, manifest and correction registry. Export replay in `output/regional-five-export-replay` is byte-identical, and all five pass8px/baseline151 alpha inspection. Synthetic enclosed-highlight/body preservation and actual harpy-eye regressions PASS2/2 after missing-extractor RED. Authored-name regression also failed before adoption, then focused monster/source/art integration passed31/31. No monster stats or catalog identity changed.

The existing catalog generator created a separate candidate tree. All other249 entries and both current/candidate runtime byte hashes matched before adopting only the five PNGs and generated manifest. Authored coverage is now38/254; it is not all-monster visual completion.

Owner reviewed `output/playwright/regional-five-normalized-sizes.png`:30 decoded160px images shown at160/46/32 on dark/light surfaces. The long many-legged body, human-bird wings, flowing water, hood/staff and pickaxe distinguish the selected roles. Fine legs and clothing merge at32px; no fine-detail readability claim. Checkerboard rectangles are absent. The comparison harness reports only favicon404, not an image failure.

Owner reviewed five complete390×844 combat captures `output/playwright/regional-five-{centipede,harpy,water-spirit,dark-mage,kobold-miner}-390x844.png`. Each production runtime image decoded160px/displayed46px, both portrait and attack ancestry reached opacity1, horizontal overflow=false, attack enabled and clicked. Fixtures use the existing isolated device-QA combat snapshot with selected canonical names; this is not natural-spawn or balance evidence. No runtime test API or gameplay code was added. Task-owned browser/dev server closed.

`npm run verify:full` completed with exit0:4375/4375 unit, typecheck, lint, build guard, desktop/mobile smoke and E2E59/59+58/58. The desktop browser-close timeout after assertions is retained as a nonfatal shutdown warning. Log: `/tmp/aetheria-regional-five-full.log`. Art, content, equipment combat-power/economy and event-reward gates PASS. Diagnostic refresh changes only the monster manifest source record; report/seeds/v1 baseline are unchanged. Historical candidate6/Toss38 aggregates remain unchanged. Production packaging is a separate gate tracked in `tasks/todo.md`; no installation, commit or publication is implied.

## Read-only source preflight guard

Final local packaging: production build guard, cap sync and mobile doctor exit0; Android debug and unsigned generic-iOS builds exit0. All254 monster PNGs, both Earth Verdict PNGs and the production main JS match dist byte-for-byte in both packages (257 paths each). Native tracked drift0; exact hashes/paths are in `native-checkpoint.json`. No device installation or existing archive replacement occurred. Distribution signing inputs remain unavailable. The preflight notes below preserve earlier approval and preparation states.

`node scripts/normalize-monster-source.mjs --check <source.png>` now decodes a PNG without exporting and reports width/height plus transparent and visible(alpha>=128) pixel counts. The normal export path runs the same check before resizing/writing, rejecting fully opaque and empty sources. PNG signature is required. Existing exclusive-write behavior remains in place.

TDD: initial3 assertions failed because --check was not supported (no image conversion occurred); final4 tests pass, including normal-export opaque rejection with destination absent and source unchanged. Test PNGs are tiny synthetic codec fixtures, not modified game artwork. Logs `/tmp/aetheria-source-preflight-{red,green}-0907.log`; focused eslint and diff-check pass. Real read-only checks: dark-mage-readable1254sq/transparent1087968/visible467321 passes minimum conditions; harpy-compact-candidate fails with `Monster source has no transparent background`. No real asset export was performed.

This guard cannot detect a checkerboard drawn inside an otherwise transparent image, enclosed background patches or stylistic errors. It is a necessary fail-closed check, not art approval. Real game-art conversion remains pending method authorization; no whole-project/native PASS is claimed for this script change.

Synthetic successful-export follow-up: final5/5 tests pass, focused eslint and diff-check pass (handle63649 exit0). Log `/tmp/aetheria-source-preflight-export-0907.log`. A generated2×2 codec fixture with one lower-left opaque pixel yields160×160, expected bounds left8/top80/right79/bottom151, two independent outputs byte-identical, source unchanged. A second write to an existing output fails EEXIST without changing its bytes. Temporary synthetic files were removed by their owning tests; no user/game artwork was converted or deleted. This proves the existing nearest-neighbor placement/exclusive write on the fixture, not real-asset appearance. The current progression source manifest contains no normalize-monster-source entry; no evidence was refreshed in this follow-up.

## Dark mage follow-up

Owner inspected `output/playwright/completion-20260907/mage-contrast-small.png` (1000×465): original dark-mage.png and dark-mage-readable.png at160/46/32px on dark/light. All12 images decoded, naturalWidth1254, measured widths160/46/32. Revised broad medium-violet robe, large pale face and lavender hood/shoulder edges remain more visible at dark32px; detached magic particles and fine belts were removed in the new design. Select revised source for further integration checks, preserve original. This addresses the prior source-scale contrast finding, not runtime/combat acceptance or clean-alpha. Exact prompt/hash in prompts.md. Local favicon404 only; owned mage-contrast browser and loopback server closed afterward.

2026-09-07. Owner inspected `output/playwright/completion-20260907/regional-five-small.png` at1000×1030. Existing local HTML harness was extended with `?batch=regional` (default v6 selection preserved). It displays unchanged source masters at160/46/32px on dark/light backgrounds using CSS pixelated rendering. All30 image elements decoded with naturalWidth1254 and measured CSS widths160/46/32. No exported pixels or production files changed.

| Candidate | Observation | Decision |
| --- | --- | --- |
| centipede.png | Long curved segmented body remains distinct from a spider swarm; fine legs merge at32px | Suitable semantic direction; exact export/combat/clean-alpha still pending |
| harpy-compact-candidate.png | Compact human-bird shape; baked checkerboard remains a visible square at all sizes | Reject runtime adoption until genuine transparency; shape readability alone is not PASS |
| water-spirit.png | Blue liquid curve and white foam distinguish it from a tree spirit on both surfaces | Suitable semantic direction; actual runtime scale/combat/clean-alpha still pending |
| dark-mage.png | Hood/staff readable at160px, but dark32px body nearly merges into the background; fine robe detail disappears | Additional source contrast/silhouette revision required before approval |
| kobold-miner.png | Reptilian body and pickaxe distinguish it from a fire lord, but baked checkerboard remains | Reject runtime adoption until genuine transparency; final tool readability after extraction still pending |

Only console error: loopback `/favicon.ico`404. All five PNG requests loaded. Review is not a390×844 combat screenshot, natural gameplay proof or authored export acceptance. No independent review or full/native gate was performed for this source-only check.

Owned browser session `regional-five` and HTTP server are closed after inspection. No paid API or Python/Pillow pixel processing used. Next source changes: raise dark mage edge/body contrast while preserving dark-caster identity; handle failed transparency only through image_gen or explicitly authorized deterministic processing. Previous repeated harpy extraction failure remains recorded and must not be looped unchanged.
