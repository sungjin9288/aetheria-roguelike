# v6 source candidates — not adopted

**Current status, 2026-09-07:** all three corrections are now adopted in the canonical catalog. The older paragraphs below preserve candidate history. `prepare.py` validates the three master hashes, thresholds copied alpha at128, crops to visible bounds and nearest-neighbor fits within144px on a160px canvas with baseline151. It writes exclusively into a new directory; original masters are unchanged. `exports/receipt.json` records the preparation hashes, not final release approval. `previous/` preserves the prior three runtime PNGs, manifest and correction registry.

The existing catalog generator produced a separate candidate tree. Before adopting only the three PNGs and generated manifest, all other251 records and both candidate/current runtime bytes were compared and matched. Authored coverage rises30→33; this is not visual approval of all254 monsters. Production monster stats and catalog identity hash are unchanged.

TDD: source preparation missing-script RED→GREEN; then exact authored-name regression RED→GREEN. Focused monster/source/art tests36/36 PASS (`/tmp/aetheria-early-three-focused.log`). `npm run verify` passes4373/4373 unit plus typecheck, lint and build guard (`/tmp/aetheria-early-three-verify.log`). Art report write and progression diagnostic read-only verification pass. Diagnostic refresh changes only the monster manifest source hash; report, seed policy and v1 baseline remain identical.

Owner viewed all normalized160px exports and `output/playwright/early-three-normalized-sizes.png`:18 decoded images at160/46/32 on dark/light backgrounds. Goblin ears/green body, kobold muzzle/tail and slime green body remain distinguishable; fine clothing detail is not readable at32px. The only size-harness console error is favicon404, not an image failure.

Actual combat fixture captures: `output/playwright/early-three-{goblin,kobold,green-slime}-ready-390x844.png`. All three canonical runtime paths decoded160px and displayed46px with no horizontal overflow. Attack buttons were enabled and clicked. These are existing isolated device-QA combat snapshots with the selected canonical names, not natural encounters or balance evidence. Initial captures without `-ready` preserved the correct portraits but caught the action area during its fade; they are not full-screen acceptance evidence. The corrected capture waits for both portrait and attack-button ancestor opacity1; owner viewed all three complete screens. All task-owned browsers and dev servers are closed.

Current native build and remaining full-game gates are recorded in `tasks/todo.md`; no iPhone installation, commit or publication is claimed here.

Native verification finished: `native-checkpoint.json` records successful Android debug and unsigned iOS builds, with257 paths in each package byte-identical to production dist. `mobile:doctor`, `cap:sync`, content reachability, equipment combat-power/economy, event-reward and `git diff --check` PASS. Historical candidate6/Toss38 aggregate hashes remain unchanged from the Earth Verdict checkpoint. Full smoke/E2E on the v6 bytes remains the next consolidated gate; the preceding117 E2E successes apply to the earlier Earth Verdict tree and are not reused as v6 proof.

2026-09-07: built-in image_gen produced three source candidates. All generated output was viewed directly and copied unchanged into this directory; prompts.md preserves each actual prompt and generator filename. No external API, runtime PNG, manifest or gameplay mutation.

| Master | SHA-256 | Canvas | Alpha > 0 bounds | Alpha >= 128 bounds |
| --- | --- | --- | --- | --- |
| masters/goblin.png | 4135e83b69b70aa1e3ac8fe31927151c620ecd73d7897e8c8bbb990053c4fcb6 | 1254×1254 | 33,20–1229,1253 | 116,99–1105,1160 |
| masters/kobold.png | 399c361a0b37f36f90108e1b3149678b5f3198deb96a15067864f58e716ba71d | 1254×1254 | 0,19–1215,1253 | 59,69–1195,1184 |
| masters/green-slime.png | 68dc614255cb418fb53ddee28fe02dd7a225b48d6b56dcb0a918695b3961f2c9 | 1254×1254 | 0,53–1191,1227 | 91,252–1179,1034 |

Read-only pixel inspection used Playwright image decode and canvas getImageData; no exported pixels were written. Browser closed normally. All have actual transparent pixels (goblin 1087985, kobold 1056921, slime 928511). Dominant nonzero alpha is253, not255; alpha1 pixels are16834/15216/6983 respectively. Visible bodies are inside the canvas, but faint nonzero remnants touch bottom/left edges. Merely having an alpha channel is not a clean transparency PASS.

## Semantic review

- Goblin: pointed ears, hooked nose, green skin, patched leather and dagger replace unrelated fire-lord identity. Full ears, feet and dagger visible.
- Kobold: russet reptilian snout, scales and tail distinguish it from a human bandit. This anatomy is a local design choice rather than an asserted production requirement.
- Green slime: clear green body, original two eyes and smile concept preserved, detached corner ornaments removed. Shape/highlight positions changed during generation, so do not call this an exact pixel recolor.

## Remaining adoption gates

1. Resolve faint exterior alpha remnants with image_gen or explicitly authorized deterministic processing; preserve these originals regardless.
2. Inspect dark/light32/46/160px and compare with current game style. No small-size or combat screenshot is part of this source-only checkpoint.
3. Preserve current runtime preimages; pin accepted exports and metadata with existing authored catalog tests before replacing any runtime bytes.
4. Run focused integration, required source evidence and full/native gates after actual adoption. None are claimed here.

Current candidate status: semantic direction accepted for further review; transparency/export/integration pending. Existing three runtime defects remain unresolved in the game.

## Browser source-size review

Owner inspected `output/playwright/completion-20260907/early-three-small.png` (1000×640). The local HTML harness displays unchanged masters at CSS160/46/32px on dark and light backgrounds with image-rendering:pixelated. All18 image elements decoded (naturalWidth1254) and their actual widths matched the requested sizes. This is a browser screenshot of the source assets, not an exported runtime PNG or combat acceptance screenshot.

- Goblin: ears, green face and dagger silhouette distinguish it at46px; at32px leather detail largely disappears. Further runtime-scale combat check required.
- Kobold: muzzle and curved tail remain distinct from the goblin and human bandit. Spear and clothing detail weaken at32px; do not infer detailed anatomy readability.
- Green slime: green body and two eyes remain clear at32px on both backgrounds.
- No opaque rectangular background or obvious body clipping was visible in this comparison. This does not override the exact faint-alpha edge findings above.

Only console error was local `/favicon.ico`404, not an image request failure. The owned browser session `early-three` and loopback HTTP server are closed after review. The deterministic processing method approval was requested separately; no reply was treated as authorization. No pixel processing or runtime adoption occurred.
