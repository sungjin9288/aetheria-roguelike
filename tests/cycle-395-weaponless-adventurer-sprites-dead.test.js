import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 395: WEAPONLESS_ADVENTURER_SPRITES dead set 정리 +
 *   JOB_SPRITE_SLUG_MAP `'그림자 주군'` (공백 포함) unreachable 키 정리.
 *   (cycle 222-394 silent dead config 시리즈 158번째 — cleanup lens 연속).
 *
 * 발견 (2 dead targets):
 *
 * 1) src/utils/avatarSpriteCandidates.ts: WEAPONLESS_ADVENTURER_SPRITES Set 정의 (4 entries +
 *    7-line audit 주석). 정의만 있고 src/, tests/ 어디에도 read 0건.
 *    cycle 35 시각 audit 시점에 작성된 future-use 데이터였으나 도입 path가 끝내 미실현.
 *
 * 2) src/utils/avatarSpriteCandidates.ts JOB_SPRITE_SLUG_MAP에 `'그림자 주군': 'shadow-lord'`
 *    (공백 포함) entry. resolveAppearanceKeys 내 `normalizedJob = appearance.job.replace(/\s+/g, '')`
 *    가 항상 공백을 strip한 후 '그림자주군' 키로 lookup → with-space 키 unreachable.
 *    cycle 361 jobOutfitAffinity 동일 lens (no-space duplicate unreachable) 변형 회귀.
 *
 * 패턴 (cycle 222-394 silent dead config 시리즈 158번째):
 * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 unreachable.
 * - cycle 359/361/392: ELEMENT_FILTERS / JOB_AFFINITY_NAMES / ACTION_KIND_TO_BUTTON
 *   unreachable lens.
 * - cycle 395: WEAPONLESS_ADVENTURER_SPRITES 정의 dead + JOB_SPRITE_SLUG_MAP
 *   normalize-bypassed key (unreachable + dead-set 복합 lens).
 *
 * 수정 (src/utils/avatarSpriteCandidates.ts):
 * - WEAPONLESS_ADVENTURER_SPRITES Set 정의 + 7-line audit 주석 제거.
 * - JOB_SPRITE_SLUG_MAP에서 `'그림자 주군': 'shadow-lord'` 라인 제거 (공백 없는 키만 잔존).
 *
 * 회귀 가드:
 * - getAvatarSpriteCandidates / getAvatarEquipmentPreviewCandidates 동작 보존.
 * - shadow-lord 직업 sprite 매핑 (`그림자 주군` → '그림자주군' normalize → 'shadow-lord') 보존.
 * - JOB_SPRITE_SLUG_MAP 14 entry (그림자주군 단일) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 395: WEAPONLESS_ADVENTURER_SPRITES 정의 0건', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    assert.ok(!/WEAPONLESS_ADVENTURER_SPRITES/.test(source),
        'WEAPONLESS_ADVENTURER_SPRITES 정의 / 참조 0건');
});

test('cycle 395: JOB_SPRITE_SLUG_MAP `그림자 주군` (공백 포함) 키 0건', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    const mapStart = source.indexOf('export const JOB_SPRITE_SLUG_MAP');
    const mapEnd = source.indexOf('};', mapStart);
    const mapBlock = source.slice(mapStart, mapEnd);
    assert.ok(!/'그림자 주군':/.test(mapBlock),
        'JOB_SPRITE_SLUG_MAP 블록 내 공백 포함 `그림자 주군` 키 0건');
    assert.ok(/그림자주군:/.test(mapBlock),
        '공백 없는 `그림자주군` 단일 키 보존');
});

test('cycle 395: getAvatarSpriteCandidates 동작 보존 (shadow-lord 매핑)', async () => {
    const { getAvatarSpriteCandidates } = await import('../src/utils/avatarSpriteCandidates.js');
    // CLASSES.ts에서 그림자 주군은 공백 포함 형식으로 dispatch.
    const candidates1 = getAvatarSpriteCandidates({ job: '그림자 주군' });
    assert.ok(Array.isArray(candidates1), '배열 반환');
    assert.ok(candidates1.some((p) => p.includes('shadow-lord')),
        'shadow-lord sprite 후보에 포함');

    // 모험가 (default) 동작 보존.
    const candidates2 = getAvatarSpriteCandidates({ job: '모험가' });
    assert.ok(candidates2.some((p) => p.includes('adventurer')),
        '모험가 → adventurer sprite');
});

test('cycle 395: JOB_SPRITE_SLUG_MAP 14 entry 단일 키 보존', async () => {
    const { JOB_SPRITE_SLUG_MAP } = await import('../src/utils/avatarSpriteCandidates.js');
    const keys = Object.keys(JOB_SPRITE_SLUG_MAP);
    assert.equal(keys.length, 14, `14 entry, 발견: ${keys.length}`);
    assert.equal(JOB_SPRITE_SLUG_MAP['그림자주군'], 'shadow-lord', '공백 없는 키 보존');
    assert.equal(JOB_SPRITE_SLUG_MAP['그림자 주군'], undefined, '공백 키 제거');
});

test('cycle 394 회귀 가드: RELIC_SYNERGIES id 0건 보존', async () => {
    const source = await readSrc('src/data/relics.ts');
    const synergyStart = source.indexOf('export const RELIC_SYNERGIES');
    const synergyEnd = source.indexOf(']);', synergyStart);
    const block = source.slice(synergyStart, synergyEnd);
    assert.ok(!/^\s+id: '/m.test(block),
        'cycle 394 RELIC_SYNERGIES id 0건 보존');
});
