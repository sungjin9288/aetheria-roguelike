# S3 body-eight corrections — 2026-09-07

Eight individual built-in imagegen results replace known body mismatches. No CLI image API or paid provider was connected. `prompts.md` preserves the exact eight prompts; `masters/` preserves original outputs, `exports/` their size-only 160px exports, and `previous/` the eight replaced runtime PNGs. `preimage-manifest.json` records the catalog before this batch.

| Name | Stable key | Reviewed body |
| --- | --- | --- |
| 스노우 울프 | monster-3ba063383d00 | Four-legged white wolf with muzzle and bushy tail |
| 살아있는 마법서 | monster-2ec2e48a6b4e | Open book, cover, spine and page blocks |
| 미믹 | monster-885e652191d9 | Hinged treasure chest with two rows of teeth |
| 프로토타입 제로 | monster-a3a5a22ad41e | Mechanical joints, plate armor and chest power core |
| 천둥새 제피로스 | monster-4bb262cf570a | Hooked beak, feathers, wings and talons |
| 아누비스 수호자 | monster-fd146ff0ec8a | Long-eared jackal head and guardian body |
| 성스러운 물고기 | monster-858705ee7367 | Scaled fish, fins and forked tail |
| 거대 거북 | monster-aedb97862864 | Domed shell and four short heavy legs |

The existing version-1 correction registry/schema and runtime directory remain in use; `v2` here names the second source-art batch, not a runtime schema change. The registry pins all eleven accepted authored exports; the other 243 portraits remain prototype-derived and are not visually approved by this batch. Exact-name classification corrects only wolf/book/mimic/prototype to beast/construct/construct/machine; no gameplay numeric or save-schema change is included.

Owner viewed every generated original and the dark/light 160/32/46px comparison at `output/playwright/completion-20260907/body-eight-32-160.png`. Sol xhigh independently viewed all eight masters and the comparison: Critical0/Important0. At32px, loose pages and Anubis staff decorations lose detail but body silhouettes remain distinguishable. This is not approval of all254 monsters or the entire game.

TDD: two tests failed before adoption (wrong humanoid classification and missing authored pins), then all10 monster tests passed. Related art/Toss tests40/40 and art/content verification passed. Independent10/10 also passed. Regeneration reproduces all254 bytes; before/after comparison proves unchanged246 metadata and PNG hashes. Previous8 files match their preimage SHA; new8 export/authored/catalog/pin bytes match. All exports are160×160 RGBA with transparent pixels and no nontransparent pixel in the8px border.

`provenance.json` binds prompt/preimage manifest and every master/previous/export hash. Owner inspected all eight settled390×844 combat captures at `output/playwright/completion-20260907/body-eight-final-{1..8}-390x844.png`. All exact portraits loaded, width/scroll390/390, final clean run had zero page/console errors. The fixture uses forest/level2 and synthetic stats for portrait coverage; it does not prove natural spawn, boss stats or gameplay balance. Initial harness attempts lacked test mode, used unavailable structuredClone in the CLI host, and scoped the name locator to the wrong panel; these did not count as clean results. Early-transition captures are retained separately from settled captures. Required web-game client also ran and its ready/crafting/offline screenshot/state were inspected separately.

Browser/full/evidence/native closure is recorded in `progress.md` and `tasks/todo.md`; a generated image or passing artifact contract alone is not that closure. The first generator invocation omitted required arguments and exited2 before publishing; the canonical `npm run art:monsters:build` then succeeded. No commit, push, installation or publication is part of this batch.
