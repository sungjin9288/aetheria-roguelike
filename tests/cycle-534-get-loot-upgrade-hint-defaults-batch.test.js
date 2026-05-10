import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 534: getLootUpgradeHint `equip = {}` + `lootItems = []` defaults batch
 *   unreachable (cycle 222-533 silent dead config 시리즈 277번째 — redundant
 *   default annotation util/component/hook default 청소 메가 시리즈 30번째).
 *
 * 발견 (2 defaults batch):
 * - src/hooks/combatActions/_helpers.ts (line 23):
 *     export const getLootUpgradeHint = (equip: any = {},
 *         lootItems: Item[] = []): any => {
 *         const equipmentDrops = (lootItems || []).filter(...);
 *         ...
 *     };
 * - 호출 사이트 (1 callsite, hooks/combatActions/combatVictory.ts):
 *     · combatVictory.ts:213 — getLootUpgradeHint(updatedPlayer.equip,
 *       lootResult.items)
 *     · 다른 파일 import 0건.
 * - 결과: equip / lootItems 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-533 시리즈 277번째):
 * - cycle 502-533: util/component/hook default 청소 메가 시리즈 30사이클.
 * - cycle 534: hooks/ private helper batch — cycle 532 buildClassVitals에 이은
 *   동일 디렉토리 추가 cleanup.
 *
 * 수정 (src/hooks/combatActions/_helpers.ts):
 * - signature에서 equip: any = {} → equip: any.
 * - signature에서 lootItems: Item[] = [] → lootItems: Item[].
 * - body의 (lootItems || []) defensive guard는 별개 보존.
 * - cycle 352 bestScore strip 보존.
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - body equipmentDrops filter / getEquipmentProfile / forEach 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 534: getLootUpgradeHint signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fnIdx = source.indexOf('export const getLootUpgradeHint');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/equip:\s*any\s*=\s*\{\}/.test(sig),
        'getLootUpgradeHint equip default {} 제거');
    assert.ok(!/lootItems:\s*Item\[\]\s*=\s*\[\]/.test(sig),
        'getLootUpgradeHint lootItems default [] 제거');
});

test('cycle 534: 정합성 가드 — 1 callsite 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/getLootUpgradeHint\(updatedPlayer\.equip,\s*lootResult\.items\)/.test(source),
        'getLootUpgradeHint(updatedPlayer.equip, lootResult.items) callsite 보존');
});

test('cycle 534: body defensive guard 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(/\(lootItems \|\| \[\]\)\.filter/.test(source),
        '(lootItems || []) defensive guard 보존');
    assert.ok(/getEquipmentProfile\(equip\)/.test(source),
        'getEquipmentProfile(equip) 호출 보존');
    assert.ok(/let bestScore = -Infinity/.test(source),
        'cycle 352 bestScore internal 변수 보존');
});

test('cycle 534: cycle 502-533 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
    const rcp = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.ok(!/const getRelicSynergyScore[^=]*ownedRelics:\s*any\s*=\s*\[\]/.test(rcp),
        'cycle 533 getRelicSynergyScore ownedRelics default 0건');

    const sh = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(!/buildClassVitals[^=]*meta:\s*any\s*=\s*\{\}/.test(sh),
        'cycle 532 buildClassVitals meta default 0건');
});
