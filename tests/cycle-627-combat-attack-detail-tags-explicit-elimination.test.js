import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 627: COMBAT_ATTACK_DETAIL tags [] explicit default-elimination
 *   (cycle 222-626 silent dead config 시리즈 365번째 — explicit
 *   default-elimination pattern 18번째 적용, 변형 패턴 6번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/data/messages.ts:10:
 *     COMBAT_ATTACK_DETAIL: (name: any, dmg: any, cur: any, max: any, tags: any = []) =>
 *         `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`
 * - 호출 사이트 모두 명시 인자 전달:
 *     · CombatEngine.ts:629 — MSG.COMBAT_ATTACK_DETAIL(enemy.name, finalDamage,
 *       Math.max(0, newEnemyHp), enemy.maxHp, tags). 5 args 모두 명시.
 * - default [] 이미 도달 불가.
 *
 * 패턴 (cycle 222-626 시리즈 365번째):
 * - cycle 502-626: default 청소 메가 시리즈 122사이클.
 * - cycle 627: explicit default-elimination 18번째 (변형 패턴 6번째 —
 *   caller 모두 이미 명시 상태).
 *
 * 수정:
 * - messages.ts:10 — tags default [] 제거.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로 (이미 명시).
 * - body `${tags.length ? ` [${tags.join(', ')}]` : ''}` 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 627: COMBAT_ATTACK_DETAIL signature에서 tags default [] 0건', async () => {
    const source = await readSrc('src/data/messages.ts');
    assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(source),
        'COMBAT_ATTACK_DETAIL tags default [] 제거');
    assert.ok(/COMBAT_ATTACK_DETAIL:[^=]+tags:\s*any\)\s*=>/.test(source),
        'COMBAT_ATTACK_DETAIL tags 파라미터 보존 (default 없이)');
});

test('cycle 627: CombatEngine callsite 5 args 명시 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/MSG\.COMBAT_ATTACK_DETAIL\(enemy\.name,\s*finalDamage,\s*Math\.max\(0,\s*newEnemyHp\),\s*enemy\.maxHp,\s*tags\)/.test(source),
        'CombatEngine COMBAT_ATTACK_DETAIL 5 args 명시 보존');
});

test('cycle 627: COMBAT_ATTACK_DETAIL body tags.length / join 처리 보존', async () => {
    const source = await readSrc('src/data/messages.ts');
    assert.ok(/tags\.length\s*\?\s*` \[\$\{tags\.join\(', '\)\}\]`\s*:\s*''/.test(source),
        'tags.length ? [...] join 처리 보존');
});

test('cycle 627: cycle 502-626 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(cp),
        "cycle 626 renderActionButton extraClass default 0건");
    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(ai),
        "cycle 625 generateStory uid default 0건");
});
