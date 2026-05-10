import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 559: getEnemyTacticalProfile `stats = {}` default unreachable
 *   (cycle 222-558 silent dead config 시리즈 300번째 — redundant default annotation
 *   청소 메가 시리즈 53번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/runProfile.ts (line 397):
 *     export const getEnemyTacticalProfile = (enemy: Monster,
 *         stats: any = {}) => {
 *         if (!enemy) return null;
 *         void stats; // cycle 270: stats는 dead, 시그니처 호환만 보존.
 *         ...
 *     };
 * - 호출 사이트:
 *     · CombatPanel.tsx:58 — getEnemyTacticalProfile(enemy, stats) 명시.
 *     · tests/run-profile-utils.test.js:96 — getEnemyTacticalProfile({...},
 *       { def: 40 })
 *     · tests/cycle-270 — 4 callers 모두 2 args 명시 ({def:10} 등).
 *     · cycle-270:90 — getEnemyTacticalProfile(null, {}) — null + {}.
 * - 결과: stats 항상 명시 전달. default 도달 불가.
 *
 * 패턴 (cycle 222-558 시리즈 300번째):
 * - cycle 502-558: default 청소 메가 시리즈 57사이클.
 * - cycle 559: runProfile.ts 추가 cleanup. cycle 270 stats dead notation
 *   유지 (`void stats`).
 *
 * 수정 (src/utils/runProfile.ts):
 * - signature에서 stats: any = {} → stats: any.
 * - body의 void stats / cycle 270 주석 보존.
 *
 * 회귀 가드:
 * - 1 production + 5 test callsite 동작 그대로.
 * - body pattern / phase / counterHint 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 559: getEnemyTacticalProfile signature에서 stats default 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnIdx = source.indexOf('export const getEnemyTacticalProfile');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
        'getEnemyTacticalProfile stats default {} 제거');
});

test('cycle 559: 정합성 가드 — production + test callsite 보존', async () => {
    const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/getEnemyTacticalProfile\(enemy,\s*stats\)/.test(cp),
        'CombatPanel getEnemyTacticalProfile 보존');

    const test270 = await readSrc('tests/cycle-270-tactical-profile-dead-cleanup.test.js');
    assert.ok(/getEnemyTacticalProfile\(enemy,\s*\{ def: 10 \}\)/.test(test270),
        'cycle-270 test callsite 보존');
});

test('cycle 559: cycle 270 stats dead notation 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/void stats/.test(source),
        'void stats 시그니처 호환 보존');
    assert.ok(/cycle 270: stats 파라미터는 estimatedHit\/estimatedHeavy 계산용이었으나 dead/.test(source),
        'cycle 270 주석 보존');
});

test('cycle 559: cycle 502-558 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/const buildTraitSkill[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
        'cycle 558 buildTraitSkill stats default 0건');
    assert.ok(!/export const getTraitBonus[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
        'cycle 558 getTraitBonus stats default 0건');
});
