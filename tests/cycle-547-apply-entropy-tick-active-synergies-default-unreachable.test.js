import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 547: applyEntropyTick `activeSynergies = []` default unreachable
 *   (cycle 222-546 silent dead config 시리즈 289번째 — redundant default annotation
 *   청소 메가 시리즈 42번째).
 *
 * 발견 (1 default unreachable):
 * - src/systems/CombatEngine.ts (line 193):
 *     applyEntropyTick(player: Player, enemy: Monster, activeSynergies: any[] = []) {...}
 * - 호출 사이트:
 *     · CombatEngine.ts:631 — this.applyEntropyTick(updatedPlayer, postHitEnemy,
 *       stats.activeSynergies || [])
 *     · CombatEngine.ts:1037 — this.applyEntropyTick(updatedPlayer, updatedEnemy,
 *       stats.activeSynergies || [])
 *     · tests/cycle-159, cycle-236, cycle-237 등 다수 — 모두 3 args 명시.
 * - 결과: activeSynergies 항상 명시 전달 (caller가 || [] fallback). default
 *   도달 불가.
 *
 * 패턴 (cycle 222-546 시리즈 289번째):
 * - cycle 502-546: default 청소 메가 시리즈 45사이클.
 * - cycle 547: systems/CombatEngine method default — cycle 546과 동일.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 activeSynergies: any[] = [] → activeSynergies: any[].
 * - body의 turnCount / brand entropy 처리 보존.
 *
 * 회귀 가드:
 * - 2 internal + N test callsite 동작 그대로.
 * - body relics / flags 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 547: applyEntropyTick signature에서 activeSynergies default 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('applyEntropyTick(player');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/activeSynergies:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'applyEntropyTick activeSynergies default [] 제거');
    assert.ok(/\bactiveSynergies\b/.test(sig), 'activeSynergies 파라미터 자체는 보존');
});

test('cycle 547: 정합성 가드 — 2 internal + test callsite 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const calls = (source.match(/this\.applyEntropyTick\(/g) || []).length;
    assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);

    const test1 = await readSrc('tests/cycle-159-relic-entropy-tick-brand.test.js');
    assert.ok(/CombatEngine\.applyEntropyTick\(player,\s*enemy,\s*\[\]\)/.test(test1),
        'test callsite (cycle 159) 보존');
});

test('cycle 547: body turnCount / relics 처리 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/const relics = \(player as any\)\?\.relics \|\| \[\]/.test(source),
        '(player as any)?.relics || [] defensive 보존');
    assert.ok(/turnCount = \(flags\.turnCount \|\| 0\) \+ 1/.test(source),
        'turnCount 증가 보존');
});

test('cycle 547: cycle 502-546 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/getElementMultiplier\(elem: any, enemy: Monster, relics:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
        'cycle 546 getElementMultiplier relics default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const pickFallbackEvent[^=]*history:\s*any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 545 pickFallbackEvent history default 0건');
});
