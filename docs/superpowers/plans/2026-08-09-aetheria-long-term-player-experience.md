# Aetheria Long-Term Player Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 18개 직업의 플레이 정체성과 캐릭터 아트를 완성하고, 장비 233개의 일러스트를 하나의 Art Bible로 통일하며, 직업별 원정 기억을 기존 귀환 흐름에 연결한다.

**Architecture:** 현재 전투와 원정 구조를 유지하면서 art catalog와 runtime asset 사이에 재현 가능한 manifest/verifier 경계를 먼저 둔다. 캐릭터와 장비 자산은 tracked source, deterministic processing, runtime export, provenance hash를 한 흐름으로 관리하고, 직업별 기록은 기존 expedition ID를 idempotency key로 쓰는 optional save ledger로 추가한다.

**Tech Stack:** React 19, TypeScript 6, Vite 7, Node test runner, Playwright, Python Pillow, Capacitor 8, repository-native imagegen workflow

## Global Constraints

- 광고, 가챠, 강제 출석, streak loss, 소멸 보상을 추가하지 않는다.
- 전투 수치, 장비 수치, loot 확률은 별도 balance evidence 없이 바꾸지 않는다.
- canonical 캐릭터는 직업으로만 결정한다. 일반 장비 overlay 합성을 다시 도입하지 않는다.
- 기존 save, 아이템 이름, item identity, quest, expedition summary를 보존한다.
- 구세이브 fixture의 inventory, reward, expedition identity를 migration 전후로 비교한다.
- 일반 장비는 exact icon과 수치 비교를 사용하고 signature 장비만 기존 dedicated wearable overlay를 유지한다.
- 작업용 `output/`은 evidence가 아니다. 승인 prompt, source identity, export SHA-256, reviewer 판단은 tracked 경로에 남긴다.
- browser 검증, native packaging, 물리 device acceptance를 서로 다른 상태로 기록한다.
- 기능과 bugfix는 RED → GREEN → REFACTOR 순서로 진행한다.
- generated image도 먼저 contract test를 실패시킨 뒤 asset을 생성해 통과시킨다.
- commit은 아래 task 단위로만 만들고 각 commit 검증 후 push한다. 이미지 한 장이나 중간 시도마다 commit하지 않는다.
- 기존 untracked `build/`은 수정하거나 stage하지 않는다.
- 구현 model 기본값은 `gpt-5.6-sol max`, 반복적이고 경계가 명확한 catalog/script 작업은 `gpt-5.6-terra max`, visual/architecture review는 `gpt-5.6-sol xhigh`를 사용한다. 현재 제공되지 않는 Luna는 사용하지 않는다.

---

## Current Starting Point

- Branch: `main`
- Plan base HEAD: `8db1106`
- Dirty worktree: 이전 일반 공격·기술·도주 combat transaction 변경 30개 tracked 파일, 새 `src/systems/combatActionTurn.ts`, 새 `tests/combat-action-transaction-authority.test.js`, untracked `build/`
- Current catalog: 직업 18개, 장비 233개(`weapon 119`, `armor 93`, `shield 21`), 정의된 illustration family 22개, 현재 catalog에서 실제 사용하는 family 18개, 속성 8개
- Known pipeline debt:
  - `scripts/generate_job_sprite_prompts.mjs`가 삭제된 `JOB_TYPICAL_LOADOUT`을 import한다.
  - `scripts/generate_equipment_item_art.py`가 존재하지 않는 dump script와 고정 `/tmp/equipment-catalog.json`에 의존한다.
  - runtime avatar mapping은 14개 직업만 전용 경로를 갖고 4개 직업이 모험가로 fallback한다.
  - 일반 장비 exact file은 존재하지만 같은 family의 recolor 중심이라 고유 silhouette가 약하다.

## File Ownership Map

### Combat checkpoint

- Existing dirty implementation: `src/hooks/combatActions/*`, `src/reducers/*`, `src/systems/*`, `src/data/messages.ts`, `src/data/relics.ts`, `src/utils/gameUtils.ts`, `src/utils/itemPrefixUtils.ts`
- Tests: `tests/combat-action-transaction-authority.test.js`, existing combat/loot/skill cycle tests
- Ledger: `tasks/todo.md`, `progress.md`

### Art contract

- Create: `src/data/characterArtManifest.json`
- Modify: `src/data/equipmentArtManifest.json`, `package.json`
- Create: `scripts/artCatalog.mjs`, `scripts/verify-art-assets.mjs`, `scripts/inspect_art_pixels.py`
- Create: `tests/art-asset-contract.test.js`
- Create: `docs/evidence/art/README.md`, generated JSON reports under `docs/evidence/art/`

### Character art

- Create: `scripts/process_character_art.py`
- Modify: `scripts/generate_job_sprite_prompts.mjs`, `src/utils/avatarSpriteCandidates.ts`
- Modify: `src/components/PixelCharacterAvatar.tsx`, `src/components/tabs/JobChangePanel.tsx`
- Source: `scripts/art_sources/characters/*.png`
- Runtime: `public/assets/avatars/canonical/*.png`
- Evidence: `docs/evidence/art/character-contact-sheet.png`, `docs/evidence/art/character-review-*.md`
- Tests: `tests/character-appearance.test.js`, `tests/art-asset-contract.test.js`, `tests/e2e/job-change-design.spec.ts`

### Equipment art

- Create: `scripts/dump-equipment-catalog.mjs`, `scripts/generate_equipment_art_prompts.mjs`, `scripts/process_equipment_art_batch.py`
- Modify: `scripts/generate_equipment_item_art.py`, `src/data/equipmentArtManifest.json`, `src/utils/itemVisuals.ts`
- Source: `scripts/art_sources/equipment/v2/<cohort>/*.png`
- Runtime: existing paths under `public/assets/equipment-exact/`
- Evidence: `docs/evidence/art/equipment-<cohort>-contact-sheet.png`, cohort provenance JSON
- Tests: `tests/equipment-art-pipeline.test.js`, `tests/item-visuals.test.js`, `tests/signature-integrity.test.js`

### Class journey

- Modify: `src/types/player.ts`, `src/utils/dataMigration.ts`, `src/utils/expeditionLedger.ts`
- Create: `src/utils/classJourney.ts`, `src/components/ClassJourneySummary.tsx`
- Modify: owning combat victory transition after Task 1, `src/components/ExpeditionDebriefCard.tsx`, `src/components/tabs/JobChangePanel.tsx`, `src/hooks/useGameTestApi.ts`
- Tests: `tests/class-journey.test.js`, `tests/expedition-ledger.test.js`, `tests/e2e/expedition-debrief.spec.ts`, `tests/e2e/job-change-design.spec.ts`

### QA and close-out

- Modify: `tasks/todo.md`, `progress.md`
- Create/update: tracked art evidence and QA summary under `docs/evidence/art/`
- Runtime captures: ignored `playtest-artifacts/` are working artifacts only; the selected review evidence is copied into the tracked evidence directory.

---

### Task 1: Close the Existing Atomic Combat Checkpoint

**Files:**
- Review and commit only the existing dirty combat files listed by `git status --short`
- Exclude: `build/`

**Interfaces:**
- Consumes: existing `RESOLVE_COMBAT_ACTION`, `resolveCombatActionTurn`, shared action claim/replay keys
- Produces: clean, pushed baseline before art and class-journey work touches combat victory again

- [ ] **Step 1: Inspect the exact dirty scope**

Run:

```bash
git status --short
git diff --stat
git diff --check
git diff -- src/systems/combatActionTurn.ts tests/combat-action-transaction-authority.test.js
```

Expected: only the recorded combat checkpoint and ledger files are dirty; `build/` remains untracked and unstaged.

- [ ] **Step 2: Run the focused transaction tests**

```bash
node --import tsx --test tests/combat-action-transaction-authority.test.js tests/boss-cycle.test.js tests/loot-cycle.test.js tests/skills-cycle.test.js
```

Expected: PASS with no warning or retry-dependent failure.

- [ ] **Step 3: Run the full application gate**

```bash
npm run verify:full
npm run mobile:doctor
npm run cap:sync
git diff --check
```

Expected: type-check, lint, all unit tests, build guard, desktop/mobile smoke, both E2E shards, mobile doctor and Capacitor sync pass.

- [ ] **Step 4: Stage only the combat checkpoint**

Use the exact tracked and new combat file list from `git status --short`. Do not use `git add .` and do not stage `build/`.

- [ ] **Step 5: Commit and push one cohesive checkpoint**

```bash
git commit -m "fix: 일반 전투 턴 전이를 원자화 and deterministic combat resolution 완결" \
  -m "Background: 공격·기술·도주와 후처리가 여러 dispatch로 나뉘어 rapid input과 중간 save에서 부분 적용될 수 있었음. Key changes: 최신 reducer state에서 한 턴의 행동·상태 tick·적 반격·승패·보상 receipt를 한 transition으로 확정함. Impact: 일반 전투 action authority와 replay determinism에 한정되며 수치·save schema·UI geometry는 바꾸지 않음. Test & Validation: focused combat transaction tests, verify:full, mobile:doctor, cap:sync, diff check 통과."
git push origin main
```

---

### Task 2: Build the Reproducible Art Catalog and Contract

**Files:**
- Create: `scripts/artCatalog.mjs`
- Create: `scripts/verify-art-assets.mjs`
- Create: `scripts/inspect_art_pixels.py`
- Create: `src/data/characterArtManifest.json`
- Modify: `src/data/equipmentArtManifest.json`
- Create: `tests/art-asset-contract.test.js`
- Create: `docs/evidence/art/README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CLASSES`, `ITEMS`, `getEquipmentIllustrationFamilyKey`, current equipment manifest
- Produces:
  - `buildArtCatalog(): { classes, equipment, definedFamilies, usedFamilies, elements, catalogSha256 }`
  - `verifyArtAssets(options): ArtVerificationReport`
  - `npm run art:verify`

- [ ] **Step 1: Write the failing catalog test**

Add a real behavior test that imports `buildArtCatalog` and expects the current literal snapshot:

```js
test('art catalog records the complete current player-facing inventory', async () => {
  const report = await buildArtCatalog();
  assert.equal(report.classes.length, 18);
  assert.equal(report.equipment.length, 233);
  assert.deepEqual(report.equipmentByType, { weapon: 119, armor: 93, shield: 21 });
  assert.equal(report.definedFamilies.length, 22);
  assert.equal(report.usedFamilies.length, 18);
  assert.deepEqual(report.elements, ['냉기', '대지', '바람', '빛', '어둠', '에테르', '자연', '화염']);
  assert.match(report.catalogSha256, /^[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/art-asset-contract.test.js
```

Expected: FAIL because `scripts/artCatalog.mjs` does not exist.

- [ ] **Step 3: Implement the catalog with one deterministic identity**

`artCatalog.mjs` sorts class names and equipment identities before hashing:

```js
const identity = {
  classes: Object.entries(CLASSES).map(([name, value]) => ({ name, tier: value.tier })).sort(byName),
  equipment: equipment.map((item) => ({
    name: item.name,
    type: item.type,
    tier: item.tier || 0,
    elem: item.elem || '',
    family: getEquipmentIllustrationFamilyKey(item),
  })).sort(byName),
};
const catalogSha256 = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
```

Reject duplicate class names, duplicate equipment names and missing family values instead of silently filtering them.

- [ ] **Step 4: Run GREEN**

```bash
node --import tsx --test tests/art-asset-contract.test.js
```

Expected: PASS with `18/233/22/18/8` snapshot.

- [ ] **Step 5: Write the failing manifest verifier tests**

Test these behaviors with temporary fixture manifests and PNG headers:

- missing class entry is reported;
- extra class entry is reported;
- duplicate runtime path is reported;
- equipment catalog and manifest have empty two-way difference;
- wrong PNG width/height is reported;
- report contains catalog SHA-256 and each export SHA-256.

- [ ] **Step 6: Verify RED for the verifier**

```bash
node --import tsx --test tests/art-asset-contract.test.js
```

Expected: FAIL because `verifyArtAssets` and PNG metadata checks are missing.

- [ ] **Step 7: Implement the verifier without a new project dependency**

Read the PNG IHDR bytes with Node `fs`; check signature, width, height and non-empty file. Use the repository’s existing Pillow workflow in `inspect_art_pixels.py` to confirm an alpha channel exists, transparent pixels exist, the opaque bounding box stays inside the declared margin, and character foot anchors match the declared baseline. `verify-art-assets.mjs` runs the pixel inspector, parses its JSON output and fails closed if Python or Pillow is unavailable. The report shape is:

```ts
type ArtVerificationReport = {
  ok: boolean;
  catalogSha256: string;
  counts: { classes: number; equipment: number; definedFamilies: number; usedFamilies: number };
  missing: string[];
  extra: string[];
  duplicates: string[];
  invalidPng: string[];
  invalidAlpha: string[];
  invalidBounds: string[];
  exports: Array<{ identity: string; path: string; sha256: string }>;
};
```

`--write-report docs/evidence/art/art-contract-report.json` writes stable, sorted JSON. A report is evidence only when `ok` is true.

- [ ] **Step 8: Add manifests and package commands**

`characterArtManifest.json` contains 18 exact job names, normalized slugs, canonical runtime paths and the catalog hash. Keep `equipmentArtManifest.json.entries` backward compatible and add top-level `catalogSha256`, `styleVersion`, and `art` metadata rather than changing runtime entry values.

Add:

```json
"art:catalog": "node --import tsx scripts/artCatalog.mjs --stdout",
"art:verify": "node --import tsx scripts/verify-art-assets.mjs"
```

- [ ] **Step 9: Run focused and standard gates**

```bash
npm run art:catalog
node --import tsx --test tests/art-asset-contract.test.js tests/item-visuals.test.js
npm run type-check
npm run lint
```

Expected: contract fixture tests pass. Full `art:verify` may still report missing canonical character assets and styleVersion 1 equipment; that is the intended RED state for Tasks 3–8 and must be recorded, not hidden.

- [ ] **Step 10: Commit and push the contract**

Commit the scripts, tests, manifest schema, package scripts and tracked baseline report together with a detailed `test:` commit message. Do not mark the visual goal complete in `tasks/todo.md`.

---

### Task 3: Complete All 18 Canonical Job Characters

**Files:**
- Create: `scripts/process_character_art.py`
- Modify: `scripts/generate_job_sprite_prompts.mjs`
- Modify: `src/data/characterArtManifest.json`
- Modify: `src/utils/avatarSpriteCandidates.ts`
- Modify: `src/components/PixelCharacterAvatar.tsx`
- Modify: `src/components/tabs/JobChangePanel.tsx`
- Create: `scripts/art_sources/characters/*.png`
- Create: `public/assets/avatars/canonical/*.png`
- Modify: `public/assets/avatars/README.md`
- Modify: `tests/character-appearance.test.js`, `tests/e2e/job-change-design.spec.ts`
- Create: `docs/evidence/art/character-contact-sheet.png`, `docs/evidence/art/character-provenance.json`, `docs/evidence/art/character-review-2026-08.md`

**Interfaces:**
- Consumes: character manifest from Task 2
- Produces: `getAvatarSpriteCandidates({ job })` whose first and only path for every canonical job is `/assets/avatars/canonical/<slug>.png`

- [ ] **Step 1: Write the failing 18-job runtime test**

For every key in `CLASSES`, assert the first candidate equals the manifest path, no canonical job candidate contains adventurer fallback, and the file exists at `768x768`.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/character-appearance.test.js tests/art-asset-contract.test.js
```

Expected: FAIL for 성직자, 드래곤 나이트, 무당, 사냥의 군주 and non-normalized current canvases.

- [ ] **Step 3: Repair the prompt generator**

Remove the dead `JOB_TYPICAL_LOADOUT` import. Read all 18 manifest entries and emit one canonical prompt per job. Each prompt includes this exact shared direction:

```text
Aetheria Roguelike canonical full-body chibi pixel-art hero, transparent square canvas, front three-quarter pose facing right, feet on one shared baseline, head-to-body ratio 1:3, two-level dark plum outline, light from upper left, shadow to lower right, no scenery, no text, no border, face and primary weapon unobscured, readable at 40 pixels.
```

Append the job-specific silhouette, weapon and palette already written in the approved design spec. Output working prompts to ignored `output/character-art-prompts.json` and copy the approved prompt text and hash into tracked provenance.

- [ ] **Step 4: Implement deterministic character processing**

`process_character_art.py` must:

1. open each tracked source master as RGBA;
2. crop the alpha bounding box;
3. scale without distortion to at most `600x630`;
4. center horizontally on a `768x768` transparent canvas;
5. place the lowest opaque pixel at shared baseline `y=708`;
6. write the canonical runtime PNG;
7. write a labeled and an anonymous `6x3` contact sheet;
8. emit source and export SHA-256 values.

- [ ] **Step 5: Generate and inspect the 18 masters**

Use imagegen with the shared prompt and each exact job brief. Generate in lineage order so visual progression stays coherent:

1. 모험가 → 전사 → 나이트 → 드래곤 나이트
2. 전사 → 버서커
3. 모험가 → 마법사 → 아크메이지 → 대마법사
4. 마법사 → 흑마법사
5. 마법사 → 성직자 → 팔라딘
6. 마법사 → 무당 → 시간술사
7. 모험가 → 도적 → 어쌔신 → 그림자 주군
8. 도적 → 레인저 → 사냥의 군주

Save the approved masters to `scripts/art_sources/characters/<slug>.png`; rejected attempts stay in ignored `output/`.

- [ ] **Step 6: Process assets and run GREEN**

```bash
python3 scripts/process_character_art.py
node --import tsx --test tests/character-appearance.test.js tests/art-asset-contract.test.js
npm run art:verify -- --scope characters
```

Expected: all 18 exact mappings exist, are `768x768`, have unique export hashes, and known jobs have no adventurer fallback.

- [ ] **Step 7: Connect portraits to the player decision surfaces**

Keep the compact `ClassIcon` list. In `JobChangePanel` replace the selected job’s large `ClassIcon` with `PixelCharacterAvatar` using a provided appearance `{ job: selectedName }`. Add one `xs` size only if the existing `sm` size causes measured overflow; do not add a second portrait component.

- [ ] **Step 8: Add a failing mobile E2E assertion before the UI edit**

In `tests/e2e/job-change-design.spec.ts`, assert the selected job portrait:

- uses `/assets/avatars/canonical/`;
- changes when another job is selected;
- remains fully inside the 390x844 viewport;
- exposes the one-sentence identity next to the portrait.

Run the focused E2E once to observe failure, then make the minimal UI change and rerun to pass.

- [ ] **Step 9: Record visual review**

Use the anonymous contact sheet. The designated reviewer records at least 16/18 correct class family or role identifications and at least 16/18 matching one-sentence combat promises. Record misses and corrections in the tracked review note. Do not write “passed” without the actual row-by-row result.

- [ ] **Step 10: Run task gate, commit and push**

```bash
npm run art:verify -- --scope characters
npm run verify
npx playwright test tests/e2e/job-change-design.spec.ts
git diff --check
```

Commit source masters, runtime exports, manifest, code, tests and evidence as one `feat:` character identity commit and push.

---

### Task 4: Repair the Equipment Art Pipeline Before Repainting Assets

**Files:**
- Create: `scripts/dump-equipment-catalog.mjs`
- Create: `scripts/generate_equipment_art_prompts.mjs`
- Create: `scripts/process_equipment_art_batch.py`
- Modify: `scripts/generate_equipment_item_art.py`
- Create: `tests/equipment-art-pipeline.test.js`
- Modify: `src/data/equipmentArtManifest.json`

**Interfaces:**
- Produces sorted catalog rows `{ name, type, tier, elem, familyKey, runtimePath, cohort }`
- Produces prompt batches with exactly six catalog identities and fixed `2x3` cell order
- Processes one tracked source sheet into six existing runtime paths and provenance rows

- [ ] **Step 1: Write failing pipeline tests**

Test that the dump command returns 233 unique names, no missing family among used items, no `/tmp` dependency, stable ordering, and current runtime paths. Test that `--dry-run` processing refuses a source sheet whose declared six identities do not match the batch manifest.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/equipment-art-pipeline.test.js
```

Expected: FAIL because the dump and batch processor do not exist and the current generator requires `/tmp/equipment-catalog.json`.

- [ ] **Step 3: Implement the catalog dump**

The command accepts `--output <path>` or `--stdout`; no implicit temporary file. Cohorts are pure mappings:

```js
const COHORT_BY_FAMILY = {
  'weapon-sword': 'weapon-core',
  'weapon-dagger': 'weapon-core',
  'weapon-heavy': 'weapon-core',
  'weapon-bow': 'weapon-ranged-magic',
  'weapon-staff': 'weapon-ranged-magic',
  'weapon-lance': 'weapon-ranged-magic',
  'weapon-whip': 'weapon-ranged-magic',
  'offhand-shield': 'offhand-headgear',
  'offhand-book': 'offhand-headgear',
};
```

All headgear families map to `offhand-headgear`, all armor families to `armor`, and registry signature items to `signature-mythic`.

- [ ] **Step 4: Make the legacy generator explicit and reproducible**

Replace the fixed `/tmp` constant with required `--catalog`, `--source-dir`, `--output-dir`, `--manifest` arguments. A missing input exits non-zero with the exact missing path. Keep a `--dry-run` that validates without writing.

- [ ] **Step 5: Implement prompt batches and processing**

Each prompt requests a strict transparent `2x3` grid with six isolated icons, no labels and equal cell padding. Each cell prompt includes exact item name semantics, family, Tier material language and element language from the Art Bible. `process_equipment_art_batch.py` crops the six fixed cells, normalizes each to `160x160`, preserves the current manifest runtime path, calculates export hash and appends one provenance record.

- [ ] **Step 6: Run GREEN and commit pipeline only**

```bash
node --import tsx --test tests/equipment-art-pipeline.test.js tests/item-visuals.test.js
node --import tsx scripts/dump-equipment-catalog.mjs --output output/equipment-catalog.json
python3 scripts/generate_equipment_item_art.py --catalog output/equipment-catalog.json --source-dir public/assets/equipment-family/items --output-dir output/equipment-dry-run --manifest output/equipment-manifest.json --dry-run
npm run lint
```

Commit and push the reproducible pipeline without repainting runtime assets in this task.

---

### Task 5: Unify Sword, Dagger and Heavy Weapon Art

**Files:**
- Create: `scripts/art_sources/equipment/v2/weapon-core/*.png`
- Modify: corresponding runtime PNGs under `public/assets/equipment-exact/`
- Modify: `src/data/equipmentArtManifest.json`
- Create: `docs/evidence/art/equipment-weapon-core-contact-sheet.png`
- Create: `docs/evidence/art/equipment-weapon-core-provenance.json`
- Modify: `tests/item-visuals.test.js`

**Interfaces:**
- Consumes: Task 4 catalog and six-cell batch processor
- Produces: styleVersion 2 for every `weapon-sword`, `weapon-dagger`, `weapon-heavy` item

- [x] **Step 1: Add a failing cohort contract**

Assert every catalog item in the three families has `styleVersion: 2`, source hash, export hash, correct `160x160` runtime PNG and no duplicate export hash inside the same family.

- [x] **Step 2: Verify RED**

```bash
npm run art:verify -- --cohort weapon-core
```

Expected: FAIL because the current recolor assets have no v2 provenance.

- [x] **Step 3: Generate exact six-item source sheets**

Use the generated batch prompts. A sheet is accepted only when all six silhouettes remain inside their cells, light comes from upper left, background is transparent, and each same-family pair differs in at least two of blade/body shape, handle, central ornament and material.

- [x] **Step 4: Process, review and regenerate rejected sheets**

Run the processor, build the tracked contact sheet grouped by family then Tier, inspect at 32px and 160px, and regenerate only failed batches. Do not patch poor icons with arbitrary glow.

- [x] **Step 5: Run task gate, commit and push**

```bash
npm run art:verify -- --cohort weapon-core
node --import tsx --test tests/item-visuals.test.js tests/equipment-art-pipeline.test.js
npm run verify
git diff --check
```

Commit source sheets, runtime exports, manifest metadata, tests and evidence as one weapon-core art commit and push.

---

### Task 6: Unify Bow, Staff, Lance and Whip Art

**Files:** same ownership pattern as Task 5 under cohort `weapon-ranged-magic`

**Interfaces:**
- Produces: styleVersion 2 for `weapon-bow`, `weapon-staff`, `weapon-lance`, `weapon-whip`

- [ ] **Step 1: Add and observe the failing cohort contract**

Run `npm run art:verify -- --cohort weapon-ranged-magic`; expect missing v2 provenance.

- [ ] **Step 2: Generate and process sorted six-item sheets**

Keep bow string/readability, staff head shape, lance tip and whip curve inside the same silhouette grammar. Apply element through material and surface, not color alone.

- [ ] **Step 3: Inspect 32px and 160px contact sheets**

Record every rejected batch and replacement source hash in provenance.

- [ ] **Step 4: Run gate, commit and push**

Run cohort verifier, item visual tests, `npm run verify`, diff check; commit the entire cohort once and push.

---

### Task 7: Unify Offhand, Headgear and Armor Art

**Files:**
- Source cohorts: `scripts/art_sources/equipment/v2/offhand-headgear/`, `scripts/art_sources/equipment/v2/armor/`
- Runtime: matching exact equipment PNGs
- Manifest, tests and tracked contact sheets

**Interfaces:**
- Produces: styleVersion 2 for shield/book, seven headgear families and six armor families

- [ ] **Step 1: Add failing contracts for both cohorts**

Verify exact item coverage and also all 22 defined family exemplar assets, including four families not currently used by the catalog. Unused families need one Art Bible exemplar but no invented catalog item.

- [ ] **Step 2: Generate and process offhand/headgear batches**

At 32px, shield vs book and all seven headgear silhouettes must remain distinct without relying on the rarity frame.

- [ ] **Step 3: Run the offhand/headgear gate, commit and push**

Keep this commit separate from armor for review and rollback.

- [ ] **Step 4: Generate and process armor batches**

At 32px, coat, leather, robe, plate, cloak and boots must be distinguishable by outer contour and material break.

- [ ] **Step 5: Run the armor gate, commit and push**

Run cohort verifier, item visual tests, `npm run verify`, diff check; commit source/runtime/manifest/evidence together and push.

---

### Task 8: Normalize Signature and Mythic Art and Close the 233-Item Manifest

**Files:**
- Modify: signature/mythic source and runtime assets
- Modify: `src/data/equipmentArtManifest.json`, signature registry only if a proven path mismatch exists
- Modify: `tests/signature-integrity.test.js`, `tests/item-visuals.test.js`
- Create: final equipment contact sheets and provenance report under `docs/evidence/art/`

**Interfaces:**
- Produces: full `art:verify` PASS for all 233 equipment entries, 22 defined families and signature overlays

- [ ] **Step 1: Write the failing final contract**

Require empty catalog/manifest two-way difference, 233 unique item identities, 233 existing runtime paths, 233 export hashes, no duplicate equipment names, all signature registry item/overlay paths, and catalog hash equality.

- [ ] **Step 2: Verify RED**

```bash
npm run art:verify
```

Expected: FAIL until signature/mythic and any remaining cohort rows reach styleVersion 2.

- [ ] **Step 3: Normalize signature and mythic assets**

Keep their unique silhouettes. Match shared `160x160` canvas, upper-left light, two-level outline, pixel density and transparent padding. Do not replace signature identity with ordinary family art.

- [ ] **Step 4: Generate final evidence**

Create family/Tier contact sheets, one 32px sheet, full provenance JSON and the final `art-contract-report.json`. Inspect named and anonymous sheets before approval.

- [ ] **Step 5: Run full gate, commit and push**

```bash
npm run art:verify
node --import tsx --test tests/art-asset-contract.test.js tests/equipment-art-pipeline.test.js tests/item-visuals.test.js tests/signature-integrity.test.js
npm run verify:full
git diff --check
```

Commit and push the final equipment manifest closure.

---

### Task 9: Add an Idempotent Class Journey Ledger

**Files:**
- Create: `src/utils/classJourney.ts`
- Modify: `src/types/player.ts`, `src/utils/dataMigration.ts`, `src/utils/expeditionLedger.ts`
- Modify: owning combat victory transition identified after Task 1
- Create: `tests/class-journey.test.js`
- Modify: `tests/expedition-ledger.test.js`

**Interfaces:**
- Produces:

```ts
export interface ClassJourneyRecord {
  expeditionIds: string[];
  skillBranches: string[];
  signatureItems: string[];
  bossNames: string[];
  regions: string[];
  representativeExpeditionId: string | null;
  lastPlayedAt: number | null;
}

export interface ClassJourneyLedger {
  version: 1;
  sequence: number;
  byJob: Record<string, ClassJourneyRecord>;
}

// Player에 optional additive field로만 추가한다.
classJourney?: ClassJourneyLedger;
```

- [ ] **Step 1: Write failing pure ledger tests**

Cover:

- first expedition creates one job record and sequence `1`;
- replaying the same expedition ID returns the same ledger object and keeps sequence `1`;
- a different expedition appends once;
- branch, signature, boss and region identities are unique and sorted by first discovery;
- malformed old data normalizes without losing valid entries.

- [ ] **Step 2: Verify RED**

```bash
node --import tsx --test tests/class-journey.test.js
```

Expected: FAIL because `classJourney.ts` does not exist.

- [ ] **Step 3: Implement the smallest pure ledger**

The first branch in `recordClassJourneyExpedition` is:

```ts
const ledger = normalizeClassJourneyLedger(player.classJourney);
const current = ledger.byJob[input.job] || emptyClassJourneyRecord();
if (current.expeditionIds.includes(input.expeditionId)) return player;
```

Only accepted new expedition IDs increment sequence.

- [ ] **Step 4: Extend expedition snapshots additively**

Add optional normalized fields to snapshot and summary:

```ts
job?: string;
skillChoices?: Record<string, string>;
equipmentNames?: string[];
bossNames?: string[];
signatureItems?: string[];
```

Start snapshot captures job, current branches and equipped item names. Combat victory appends a canonical boss name once when the defeated enemy is a boss. Finish derives newly acquired signature names from item delta and records the class journey before clearing `activeExpedition`.

- [ ] **Step 5: Add save migration tests before migration code**

Use a literal legacy fixture with inventory, equipment, reward and expedition identity. Assert migration preserves all of them and adds a normalized optional class journey. Replay the returned summary and assert sequence and record count do not change.

- [ ] **Step 6: Run focused and full gates**

```bash
node --import tsx --test tests/class-journey.test.js tests/expedition-ledger.test.js tests/data-migration.test.js
npm run verify
```

- [ ] **Step 7: Commit and push the save-safe ledger**

Commit types, pure logic, migration, authority integration and tests together. Do not include UI in this commit.

---

### Task 10: Surface Class Memory in Job Choice and Return Debrief

**Files:**
- Create: `src/components/ClassJourneySummary.tsx`
- Modify: `src/components/ExpeditionDebriefCard.tsx`, `src/components/tabs/JobChangePanel.tsx`, `src/components/app/GameRoot.tsx`, `src/hooks/useGameTestApi.ts`
- Modify: `tests/e2e/expedition-debrief.spec.ts`, `tests/e2e/job-change-design.spec.ts`

**Interfaces:**
- Consumes: `ClassJourneyRecord` and latest `ExpeditionSummary`
- Produces: compact “이 직업으로 남긴 것” section and one next-run suggestion without a new modal or currency

- [ ] **Step 1: Write failing E2E scenarios**

Seed a representative class journey and assert:

- debrief shows current job, one branch, one signature or equipment family, boss/region result;
- job panel shows the selected job’s previous discoveries;
- absence of record shows a short first-run invitation;
- closing/reopening does not mutate sequence;
- 390x844 viewport has no horizontal overflow and primary action remains reachable.

- [ ] **Step 2: Verify RED**

Run the two focused specs and confirm selectors are missing for the expected reason.

- [ ] **Step 3: Implement one reusable summary component**

`ClassJourneySummary` receives plain data and renders at most three lines:

1. last representative expedition;
2. branch/build discovery;
3. next unexplored category.

It never writes state. Reducer/ledger authority remains in Task 9.

- [ ] **Step 4: Connect the existing surfaces**

Insert the summary inside the scrollable debrief body before the story beat and inside the selected-job decision card after representative skills. Do not add a global tab, new modal or new currency.

- [ ] **Step 5: Run focused visual and behavior gates**

```bash
npx playwright test tests/e2e/expedition-debrief.spec.ts tests/e2e/job-change-design.spec.ts
npm run verify:full
git diff --check
```

Copy selected desktop/mobile screenshots and the exact command result into tracked evidence.

- [ ] **Step 6: Commit and push UI plus evidence**

Commit component, owning surfaces, test API fixtures, E2E tests and evidence together.

---

### Task 11: Final RC Evidence and Requirement-by-Requirement Completion Audit

**Files:**
- Modify: `tasks/todo.md`, `progress.md`
- Update: `docs/evidence/art/art-contract-report.json`, contact sheets, review note, QA summary
- No unrelated source changes

**Interfaces:**
- Consumes: all prior task commits
- Produces: current, replayable completion evidence and explicit external blockers

- [ ] **Step 1: Run canonical application verification**

```bash
npx tsc --noEmit
npm run lint
npm run build:guard
npm run test:unit
npm run verify:full
npm run art:verify -- --write-report docs/evidence/art/art-contract-report.json
npm run mobile:doctor
npm run cap:sync
```

- [ ] **Step 2: Run native packaging appropriate to the touched surfaces**

```bash
npm run android:debug
npm run ios:build:device
npm run ios:archive
```

Android release signing and App Store/TestFlight operations remain separate and require their real keystore/identity plus explicit publish authority.

- [ ] **Step 3: Inspect actual artifacts**

Open the character contact sheet, equipment family/Tier sheets, 32px sheet and selected 390x844 screenshots. Record clipping, duplicate silhouette, unreadable family, broken transparency or style mismatch as failures and return to the owning cohort.

- [ ] **Step 4: Update the ledger through actual evidence**

`tasks/todo.md` records:

- last completed art and class-journey checkpoint;
- exact verification commands and counts;
- latest Android/iOS artifact touched;
- physical Android, Apple Distribution identity and Android release keystore as environment blockers if still missing.

`progress.md` receives the concise durable checkpoint. Do not duplicate the full design document.

- [ ] **Step 5: Audit every goal requirement**

Create a table in the tracked QA summary with one row for:

- player-facing long-term loop;
- all 18 job designs;
- canonical no-fallback runtime mapping;
- all 233 equipment illustrations;
- unified Art Bible and 22 family exemplars;
- class journey replay/idempotency;
- old save preservation;
- desktop/mobile/browser gate;
- native packaging;
- device/signing/publish boundary;
- cohesive commit/push history.

Each row links to current file, test, artifact or blocker. “No issue found” is not evidence.

- [ ] **Step 6: Commit and push final evidence**

Commit only ledger and evidence changes with a detailed `test:` or `chore:` message and push. Mark the active goal complete only if every non-external requirement is proven and no requested implementation remains.

---

## Execution Checkpoints

Execution is inline and already authorized by the user. Use `superpowers:executing-plans` and `plan-execution` one task at a time. After every task:

1. verify the task’s focused behavior;
2. run the specified wider gate;
3. update `tasks/todo.md` only when the actual checkpoint changes;
4. stage exact files;
5. review staged diff;
6. create one detailed Korean+English Conventional Commit;
7. push `main` as explicitly authorized;
8. move to the next task only after the push succeeds.

If image generation, human art review, native signing or device access blocks one cohort, continue only with an independent task whose contract does not require pretending the blocked evidence exists.
