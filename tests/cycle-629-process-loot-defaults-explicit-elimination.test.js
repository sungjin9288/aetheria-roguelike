import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 629: processLoot player/signaturePityMult defaults explicit
 *   default-elimination paired batch
 *   (cycle 222-628 silent dead config 시리즈 367번째 — explicit
 *   default-elimination pattern 20번째 적용 — 이중자릿수 정착,
 *   paired batch 4번째 (cycle 613/624/626에 이은)).
 *
 * 발견 (2 defaults reachable → unreachable conversion):
 * - src/systems/CombatEngine.loot.ts:32:
 *     export const processLoot = (enemy: Monster, player: Player | null = null,
 *                                  signaturePityMult: any = 1.0) => {...}
 * - 호출 사이트 6개:
 *     · combatVictory.ts:66 — 3 args 명시 (production).
 *     · CombatEngine.ts:1610 (wrapper) — 3 args 명시.
 *     · cycle-171 fixture: processLoot(enemy) — 1 arg, 3 callers (52/77/101).
 * - 3 fixture callers에 명시 추가하면 2 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-628 시리즈 367번째):
 * - cycle 502-628: default 청소 메가 시리즈 124사이클.
 * - cycle 629: explicit default-elimination 20번째 — 이중자릿수 정착
 *   (cycle 618 첫 10번째 도달 후 11사이클 누적). paired batch 4번째.
 *
 * 수정:
 * - tests/cycle-171-loot-bonus-drop-no-table.test.js — 3 fixture caller에
 *   `null, 1.0` 명시 추가.
 * - CombatEngine.loot.ts:32 — player/signaturePityMult defaults 제거.
 *
 * 회귀 가드:
 * - production 2 callsite 동작 그대로 (이미 명시).
 * - body lootTable iteration / signaturePityMult application 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 629: processLoot signature에서 player/signaturePityMult defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.loot.ts');
    assert.ok(!/processLoot = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null/.test(source),
        'processLoot player default null 제거');
    assert.ok(!/processLoot = \([^)]*signaturePityMult:\s*any\s*=\s*1\.0/.test(source),
        'processLoot signaturePityMult default 1.0 제거');
    assert.ok(/processLoot = \(enemy:\s*Monster,\s*player:\s*Player\s*\|\s*null,\s*signaturePityMult:\s*any\)/.test(source),
        'processLoot 3-arg 시그니처 보존 (defaults 없이)');
});

test('cycle 629: production callsite 3 args 명시 보존', async () => {
    const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/CombatEngine\.processLoot\(deadEnemy,\s*updatedPlayer,\s*signaturePityMult\)/.test(cv),
        'combatVictory.ts processLoot 3 args 명시 보존');
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/_processLoot\(enemy,\s*player,\s*signaturePityMult\)/.test(ce),
        'CombatEngine wrapper _processLoot 3 args 명시 보존');
});

test('cycle 629: cycle-171 fixture 3 callers 명시 추가', async () => {
    const source = await readSrc('tests/cycle-171-loot-bonus-drop-no-table.test.js');
    const matches = (source.match(/processLoot\(enemy,\s*null,\s*1\.0\)/g) || []).length;
    assert.equal(matches, 3, "cycle-171 fixture 3 callers 'null, 1.0' 명시");
});

test('cycle 629: cycle 502-628 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sh = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(sh),
        "cycle 628 commitExploreOutcome transformPlayer default 0건");
    const m = await readSrc('src/data/messages.ts');
    assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(m),
        'cycle 627 COMBAT_ATTACK_DETAIL tags default 0건');
});
