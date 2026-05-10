import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 549: tickEnemyStatus 3 defaults batch unreachable
 *   (cycle 222-548 silent dead config 시리즈 291번째 — redundant default annotation
 *   청소 메가 시리즈 44번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/systems/CombatEngine.ts (line 268):
 *     tickEnemyStatus(enemy: Monster, logs: any[] = [], curseAmpMult = 1,
 *         synergyDotMult = 1) {...}
 * - 호출 사이트 (1 internal callsite):
 *     · CombatEngine.ts:1076 — this.tickEnemyStatus(updatedEnemy, [],
 *       curseAmpMult, synergyDotMult)
 *     · 외부 caller 0건, test caller 0건.
 * - 결과: 4 args 모두 명시 전달. 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-548 시리즈 291번째):
 * - cycle 502-548: default 청소 메가 시리즈 47사이클.
 * - cycle 549: tickEnemyStatus single-cycle 3-default batch — cycle 524/527
 *   에 이은 single-cycle multi-default 패턴.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 logs: any[] = [] → logs: any[].
 * - signature에서 curseAmpMult = 1 → curseAmpMult: any.
 * - signature에서 synergyDotMult = 1 → synergyDotMult: any.
 * - body의 dot / status 처리 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body DoT 계산 + curseAmpMult / synergyDotMult 사용처 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 549: tickEnemyStatus signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('tickEnemyStatus(enemy');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'tickEnemyStatus logs default [] 제거');
    assert.ok(!/curseAmpMult\s*=\s*1/.test(sig),
        'tickEnemyStatus curseAmpMult default 1 제거');
    assert.ok(!/synergyDotMult\s*=\s*1/.test(sig),
        'tickEnemyStatus synergyDotMult default 1 제거');
});

test('cycle 549: 정합성 가드 — 1 internal callsite 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/this\.tickEnemyStatus\(updatedEnemy,\s*\[\],\s*curseAmpMult,\s*synergyDotMult\)/.test(source),
        'tickEnemyStatus(updatedEnemy, [], curseAmpMult, synergyDotMult) callsite 보존');
});

test('cycle 549: body DoT 계산 + dotMult 사용처 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/BALANCE\.STATUS_DOT_RATIO \* synergyDotMult/.test(source),
        'STATUS_DOT_RATIO * synergyDotMult 보존');
});

test('cycle 549: cycle 502-548 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/applyCritMpRestore\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
        'cycle 548 applyCritMpRestore relics default 0건');
    assert.ok(!/applyEntropyTick\(player: Player, enemy: Monster, activeSynergies:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
        'cycle 547 applyEntropyTick activeSynergies default 0건');
});
