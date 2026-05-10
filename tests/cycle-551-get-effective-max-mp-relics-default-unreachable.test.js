import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 551: getEffectiveMaxMp `relics = []` default unreachable
 *   (cycle 222-550 silent dead config 시리즈 292번째 — redundant default annotation
 *   청소 메가 시리즈 45번째). systems/CombatEngine method 시리즈 5번째.
 *
 * 발견 (1 default unreachable):
 * - src/systems/CombatEngine.ts (line 68):
 *     getEffectiveMaxMp(player: Player, relics: Relic[] = []) {
 *         const rmp = 1 + relics.reduce(...);
 *         ...
 *     }
 * - 호출 사이트 (4 internal callsite):
 *     · CombatEngine.ts:84 — this.getEffectiveMaxMp(player, relics)
 *     · CombatEngine.ts:370 — this.getEffectiveMaxMp(updated, relics)
 *     · CombatEngine.ts:957 — this.getEffectiveMaxMp(updatedPlayer, relics)
 *     · CombatEngine.ts:987 — this.getEffectiveMaxMp(player, relics)
 *     · 외부 caller 0건, test caller 0건.
 * - 결과: relics 항상 명시 전달. default 도달 불가.
 *
 * 패턴 (cycle 222-550 시리즈 292번째):
 * - cycle 502-550: default 청소 메가 시리즈 49사이클.
 * - cycle 551: systems/CombatEngine method 시리즈 5번째 — cycle 546-549에
 *   이은 동일 모듈 추가 cleanup.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 relics: Relic[] = [] → relics: Relic[].
 * - body의 reduce / Math.floor 처리 보존.
 *
 * 회귀 가드:
 * - 4 internal callsite 동작 그대로.
 * - body mp_mult / omega effect 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 551: getEffectiveMaxMp signature에서 relics default 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('getEffectiveMaxMp(player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
        'getEffectiveMaxMp relics default [] 제거');
});

test('cycle 551: 정합성 가드 — 4 internal callsite 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const calls = (source.match(/this\.getEffectiveMaxMp\(/g) || []).length;
    assert.equal(calls, 4, `internal callsite 4건 보존: ${calls}건`);
});

test('cycle 551: body mp_mult / omega effect 처리 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/relic\.effect === 'mp_mult'/.test(source),
        'mp_mult effect 분기 보존');
    assert.ok(/relic\.effect === 'omega'/.test(source),
        'omega effect 분기 보존');
});

test('cycle 551: cycle 502-550 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/tickEnemyStatus\(enemy: Monster, logs:\s*any\[\]\s*=\s*\[\]/.test(ce),
        'cycle 549 tickEnemyStatus logs default 0건');
    assert.ok(!/applyCritMpRestore\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
        'cycle 548 applyCritMpRestore relics default 0건');
});
