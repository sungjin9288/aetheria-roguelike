import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 548: applyCritMpRestore `relics = []` + `logs = []` defaults batch
 *   unreachable (cycle 222-547 silent dead config 시리즈 290번째 — redundant
 *   default annotation 청소 메가 시리즈 43번째).
 *
 * 발견 (2 defaults batch):
 * - src/systems/CombatEngine.ts (line 77):
 *     applyCritMpRestore(player: Player, relics: Relic[] = [], logs: any[] = []) {
 *         const critMpRelic = relics.find(...);
 *         ...
 *     }
 * - 호출 사이트 (2 internal callsite):
 *     · CombatEngine.ts:592 — this.applyCritMpRestore(updatedPlayer, relics, logs)
 *     · CombatEngine.ts:890 — this.applyCritMpRestore(updatedPlayer, relics, critLogs)
 *     · 외부 caller 0건, test caller 0건.
 * - 결과: relics / logs 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-547 시리즈 290번째):
 * - cycle 502-547: default 청소 메가 시리즈 46사이클.
 * - cycle 548: systems/CombatEngine method default — cycle 546/547과 동일.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 relics: Relic[] = [] → relics: Relic[].
 * - signature에서 logs: any[] = [] → logs: any[].
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 2 internal callsite 동작 그대로.
 * - body crit_mp_regen 분기 + getEffectiveMaxMp 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 548: applyCritMpRestore signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('applyCritMpRestore(player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
        'applyCritMpRestore relics default [] 제거');
    assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'applyCritMpRestore logs default [] 제거');
});

test('cycle 548: 정합성 가드 — 2 internal callsite 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const calls = (source.match(/this\.applyCritMpRestore\(/g) || []).length;
    assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);
});

test('cycle 548: body crit_mp_regen 분기 + getEffectiveMaxMp 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/relics\.find\(\(relic: any\) => relic\.effect === 'crit_mp_regen'\)/.test(source),
        'crit_mp_regen find 보존');
    assert.ok(/this\.getEffectiveMaxMp\(player, relics\)/.test(source),
        'getEffectiveMaxMp(player, relics) 호출 보존');
});

test('cycle 548: cycle 502-547 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/applyEntropyTick\(player: Player, enemy: Monster, activeSynergies:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
        'cycle 547 applyEntropyTick activeSynergies default 0건');
    assert.ok(!/getElementMultiplier\(elem: any, enemy: Monster, relics:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
        'cycle 546 getElementMultiplier relics default 0건');
});
