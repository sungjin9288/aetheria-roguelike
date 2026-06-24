import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 553: applyFatalProtection 3 defaults partial cleanup
 *   (relics + incomingDamage + logs unreachable, activeSynergies reachable
 *   보존). cycle 222-552 silent dead config 시리즈 294번째 — redundant default
 *   annotation 청소 메가 시리즈 47번째. partial cleanup pattern.
 *
 * 발견 (3 defaults unreachable, 1 default reachable 보존):
 * - src/systems/CombatEngine.ts (line 95):
 *     applyFatalProtection(player: Player, relics: Relic[] = [],
 *         incomingDamage = 0, logs: any[] = [], activeSynergies: any[] = []) {
 *     ...
 *     }
 * - 호출 사이트 audit:
 *     · combatAttack.ts:189 — applyFatalProtection(player, stats.relics || [],
 *       escapeResult.damage || 0, protectionLogs) — 4 args (activeSynergies
 *       missing → activeSynergies default REACHABLE).
 *     · CombatEngine.ts:1286 — this.applyFatalProtection(updatedPlayer, relics,
 *       enemyDmg, logs, activeSynergies) — 5 args 명시.
 *     · 9 test callers — 모두 5 args 명시 ([player, relics, dmg, [], synergies/[]]).
 * - 결과:
 *     · relics 항상 명시 → default 도달 불가.
 *     · incomingDamage 항상 명시 → default 도달 불가.
 *     · logs 항상 명시 → default 도달 불가.
 *     · activeSynergies 1 caller (combatAttack) 미전달 → default REACHABLE 보존.
 *
 * 패턴 (cycle 222-552 시리즈 294번째):
 * - cycle 502-552: default 청소 메가 시리즈 51사이클.
 * - cycle 553: partial cleanup pattern (cycle 542 signedDelta 패턴 재적용)
 *   — 같은 함수 내 parameter 4개 중 3개만 unreachable, 1개 reachable 분리.
 *   systems/CombatEngine method 시리즈 7번째.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 relics: Relic[] = [] → relics: Relic[].
 * - signature에서 incomingDamage = 0 → incomingDamage: any.
 * - signature에서 logs: any[] = [] → logs: any[].
 * - signature에서 activeSynergies: any[] = [] 보존 (combatAttack 4-arg
 *   caller가 reachable path).
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 11 callsite (1 production + 1 internal + 9 test) 동작 그대로.
 * - body relic.effect 분기 / phoenix / titan 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 553: applyFatalProtection signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('applyFatalProtection(player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
        'applyFatalProtection relics default [] 제거');
    assert.ok(!/incomingDamage\s*=\s*0/.test(sig),
        'applyFatalProtection incomingDamage default 0 제거');
    assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'applyFatalProtection logs default [] 제거');
});

test('cycle 553: activeSynergies default 보존 (reachable, partial cleanup)', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('applyFatalProtection(player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/activeSynergies:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'applyFatalProtection activeSynergies default [] 보존 (combatAttack 4-arg caller가 reachable path)');
});

test('cycle 553: 정합성 가드 — production + internal + test callsite 보존', async () => {
    const ca = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/CombatEngine\.applyFatalProtection\(player,\s*stats\.relics \|\| \[\],\s*escapeResult\.damage \|\| 0,\s*protectionLogs\)/.test(ca),
        'combatAttack 4-arg callsite 보존 (activeSynergies 미전달)');

    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/this\.applyFatalProtection\(updatedPlayer,\s*relics,\s*enemyDmg,\s*logs,\s*activeSynergies\)/.test(ce),
        'internal 5-arg callsite 보존');

    // cycle-157-relic-* 는 tests/relics.test.js로 통합됨 (audit #1).
    const test1 = await readSrc('tests/relics.test.js');
    assert.ok(/CombatEngine\.applyFatalProtection\(player,\s*player\.relics,\s*100,\s*\[\],\s*\[\]\)/.test(test1),
        'test 5-arg callsite (cycle 157) 보존');
});

test('cycle 553: cycle 502-552 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/processLoot\(enemy: Monster, player:\s*any\s*=\s*null/.test(ce),
        'cycle 552 processLoot player default 0건');
    assert.ok(!/getEffectiveMaxMp\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
        'cycle 551 getEffectiveMaxMp relics default 0건');
});
