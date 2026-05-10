import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 624: CombatEngine.handleVictory passiveBonus/liveConfig {} explicit
 *   default-elimination paired batch
 *   (cycle 222-623 silent dead config 시리즈 362번째 — explicit
 *   default-elimination pattern 15번째 적용, 변형 패턴 4번째 + paired batch
 *   2번째 (cycle 613 paired에 이은)).
 *
 * 발견 (2 defaults 이미 unreachable, signature 정리):
 * - src/systems/CombatEngine.ts:1424:
 *     handleVictory(player: Player, enemy: Monster, passiveBonus: any = {}, liveConfig: any = {})
 * - 호출 사이트 모두 명시 인자 전달:
 *     · combatActions/combatVictory.ts:37 — handleVictory(playerAfterCombat,
 *       deadEnemy, passiveBonus, liveConfig). 4 args 모두 명시.
 *     · cycle 265 fixture: handleVictory(player, enemy, {}, {}) / (player,
 *       enemy, {}, liveConfig) 모두 4 args 명시.
 * - default {} {} 이미 도달 불가.
 *
 * 패턴 (cycle 222-623 시리즈 362번째):
 * - cycle 502-623: default 청소 메가 시리즈 119사이클.
 * - cycle 624: explicit default-elimination 15번째.
 *   변형 패턴 4번째 + paired batch 2번째 (1 cycle에 2 default 동시 정리,
 *   cycle 613 getTraitProfile/getTraitSkill paired에 이은 2번째).
 *
 * 수정:
 * - CombatEngine.ts:1424 — passiveBonus/liveConfig default {} {} 제거.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로 (이미 명시).
 * - cycle 265 fixture (4 args 명시) 동작 그대로.
 * - body liveConfig.eventMultiplier / passiveBonus.goldMult 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 624: handleVictory signature에서 passiveBonus/liveConfig defaults 0건', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(source),
        'handleVictory passiveBonus default {} 제거');
    assert.ok(!/handleVictory\([^)]*liveConfig:\s*any\s*=\s*\{\}/.test(source),
        'handleVictory liveConfig default {} 제거');
    assert.ok(/handleVictory\(player: Player, enemy: Monster, passiveBonus: any, liveConfig: any\)/.test(source),
        'handleVictory 시그니처 4-arg 보존 (default 없이)');
});

test('cycle 624: production callsite 4 args 명시 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/CombatEngine\.handleVictory\(playerAfterCombat,\s*deadEnemy,\s*passiveBonus,\s*liveConfig\)/.test(source),
        'combatVictory.ts handleVictory 4 args 명시 보존');
});

test('cycle 624: handleVictory body liveConfig/passiveBonus 처리 보존', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(/liveConfig\?\.eventMultiplier/.test(source),
        'liveConfig.eventMultiplier 처리 보존');
    // passiveBonus 사용 (cycle 265 ad/passive bonus 분리)
    assert.ok(/passiveBonus/.test(source),
        'passiveBonus 처리 보존');
});

test('cycle 624: cycle 502-623 회귀 가드 — default 청소 시리즈 보존', async () => {
    const dm = await readSrc('src/systems/DifficultyManager.ts');
    assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(dm),
        'cycle 623 countLowHpWins threshold default 0건');
    const lt = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(lt),
        "cycle 622 trackCall callType default 0건");
});
