import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 552: CombatEngine.processLoot method `player = null` + `signaturePityMult
 *   = 1.0` defaults batch unreachable (cycle 222-551 silent dead config 시리즈
 *   293번째 — redundant default annotation 청소 메가 시리즈 46번째). systems/
 *   CombatEngine method 시리즈 6번째.
 *
 * 발견 (2 defaults batch):
 * - src/systems/CombatEngine.ts (line 1599):
 *     processLoot(enemy: Monster, player: any = null, signaturePityMult: any = 1.0) {
 *         return _processLoot(enemy, player, signaturePityMult);
 *     }
 * - 호출 사이트:
 *     · 1 production caller: combatVictory.ts:63 — CombatEngine.processLoot
 *       (deadEnemy, updatedPlayer, signaturePityMult) — 3 args 명시.
 *     · tests/cycle-171 import은 CombatEngine.loot.js의 export된 processLoot
 *       (별개 함수). CombatEngine.processLoot method는 production-only.
 * - 결과: method의 2 default 모두 도달 불가. _processLoot wrapper만 남음.
 *
 * Note: src/systems/CombatEngine.loot.ts의 export된 processLoot는 별개 함수,
 * tests/cycle-171에서 1 arg로 호출이라 default 활성. 거기는 cleanup 대상 외.
 *
 * 패턴 (cycle 222-551 시리즈 293번째):
 * - cycle 502-551: default 청소 메가 시리즈 50사이클.
 * - cycle 552: systems/CombatEngine method 시리즈 6번째 (cycle 546-551).
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - method signature에서 player: any = null → player: any.
 * - method signature에서 signaturePityMult: any = 1.0 → signaturePityMult: any.
 * - body의 _processLoot delegate 보존.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로.
 * - body _processLoot(enemy, player, signaturePityMult) wrapper 보존.
 * - CombatEngine.loot.ts 별개 함수 cleanup 대상 외 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 552: CombatEngine.processLoot method signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('processLoot(enemy');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/player:\s*any\s*=\s*null/.test(sig),
        'CombatEngine.processLoot player default null 제거');
    assert.ok(!/signaturePityMult:\s*any\s*=\s*1\.0/.test(sig),
        'CombatEngine.processLoot signaturePityMult default 1.0 제거');
});

test('cycle 552: 정합성 가드 — production callsite 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/CombatEngine\.processLoot\(deadEnemy,\s*updatedPlayer,\s*signaturePityMult\)/.test(source),
        'combatVictory CombatEngine.processLoot callsite 보존');
});

test('cycle 552: body _processLoot wrapper 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/return _processLoot\(enemy,\s*player,\s*signaturePityMult\)/.test(source),
        '_processLoot(enemy, player, signaturePityMult) delegate 보존');
});

test('cycle 552: CombatEngine.loot.ts processLoot 시그니처 보존 (cycle 629 explicit elimination)', async () => {
    const source = await readSrc('src/systems/CombatEngine.loot.ts');
    assert.ok(/export const processLoot = \(enemy: Monster, player: Player \| null, signaturePityMult: any\)/.test(source),
        'CombatEngine.loot.ts processLoot 3-arg 시그니처 보존 (cycle 629에서 defaults 제거됨)');
});

test('cycle 552: cycle 502-551 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/getEffectiveMaxMp\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]\)/.test(ce),
        'cycle 551 getEffectiveMaxMp relics default 0건');
    assert.ok(!/tickEnemyStatus\(enemy: Monster, logs:\s*any\[\]\s*=\s*\[\]/.test(ce),
        'cycle 549 tickEnemyStatus logs default 0건');
});
