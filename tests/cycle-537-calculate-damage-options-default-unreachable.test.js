import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 537: calculateDamage `options = {}` default unreachable
 *   (cycle 222-536 silent dead config 시리즈 280번째 — redundant default annotation
 *   util/component/hook/system default 청소 메가 시리즈 33번째).
 *
 * 발견 (1 default unreachable):
 * - src/systems/CombatEngine.ts (line 40):
 *     calculateDamage(stats: any, options: any = {}) {
 *         const {
 *             mult = 1,
 *             guarding = false,
 *             elementMultiplier = 1,
 *             critChance = BALANCE.CRIT_CHANCE
 *             ...
 *         } = options;
 *     }
 * - 호출 사이트 (2 internal callsite):
 *     · CombatEngine.ts:486 — this.calculateDamage(statsForAtk, {...options})
 *     · CombatEngine.ts:752 — this.calculateDamage(stats, {...options})
 *     · 외부 production caller 0건 (CombatEngine.calculateDamage external 호출
 *       없음 — comments만 존재).
 *     · 테스트는 local re-implementation `function calculateDamage(stats,
 *       options = {}, rolls = {})` 사용 (3-arg deterministic mirror, 별개 함수).
 * - 결과: options 항상 object literal 명시 전달. default {} 도달 불가.
 *   destructuring 내부 default(mult=1, guarding=false, ...)는 별개 — options
 *   객체에 일부 필드만 있을 때 활성, 보존.
 *
 * 패턴 (cycle 222-536 시리즈 280번째):
 * - cycle 502-536: util/component/hook/system default 청소 메가 시리즈 33사이클.
 * - cycle 537: systems/ 추가 cleanup — cycle 536 applyExpGain에 이은 동일
 *   파일 cleanup.
 *
 * 수정 (src/systems/CombatEngine.ts):
 * - signature에서 options: any = {} → options: any.
 * - body의 destructuring (mult/guarding/elementMultiplier/critChance) defaults
 *   는 별개 보존 (caller가 부분 options 넘기는 path 활성).
 *
 * 회귀 가드:
 * - 2 internal callsite 동작 그대로.
 * - destructuring inner defaults 모두 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 537: calculateDamage signature에서 options default 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const fnIdx = source.indexOf('calculateDamage(stats: any');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/options:\s*any\s*=\s*\{\}/.test(sig),
        'calculateDamage options default {} 제거');
    assert.ok(/\boptions\b/.test(sig), 'options 파라미터 자체는 보존');
});

test('cycle 537: 정합성 가드 — 2 internal callsite 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const calls = (source.match(/this\.calculateDamage\(/g) || []).length;
    assert.equal(calls, 2, `this.calculateDamage 2 callsite 보존: ${calls}건`);
});

test('cycle 537: destructuring inner defaults 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/mult = 1/.test(source), 'mult = 1 inner default 보존');
    assert.ok(/guarding = false/.test(source), 'guarding = false inner default 보존');
    assert.ok(/elementMultiplier = 1/.test(source),
        'elementMultiplier = 1 inner default 보존');
    assert.ok(/critChance = BALANCE\.CRIT_CHANCE/.test(source),
        'critChance = BALANCE.CRIT_CHANCE inner default 보존');
});

test('cycle 537: cycle 502-536 회귀 가드 — util/component/hook/system default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/applyExpGain\(player: Player, expGained:\s*any\s*=\s*0\)/.test(ce),
        'cycle 536 applyExpGain expGained default 0건');

    const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(ca),
        'cycle 535 cycleSkill dir default 0건');
});
