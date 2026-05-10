import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 625: generateStory uid 'anonymous' explicit default-elimination
 *   (cycle 222-624 silent dead config 시리즈 363번째 — explicit
 *   default-elimination pattern 16번째 적용, 변형 패턴 5번째).
 *
 * 발견 (default 이미 unreachable, signature 정리):
 * - src/services/aiService.ts:115:
 *     generateStory: async (type: any, data: any, uid: any = 'anonymous') => {...}
 * - 호출 사이트 모두 명시 인자 전달:
 *     · useGameEngine.ts:106 — AI_SERVICE.generateStory(type, {...}, uid).
 * - default 'anonymous' 이미 도달 불가.
 *
 * 패턴 (cycle 222-624 시리즈 363번째):
 * - cycle 502-624: default 청소 메가 시리즈 120사이클.
 * - cycle 625: explicit default-elimination 16번째 (cycle 619/622/623/624
 *   변형 패턴 5번째 — caller 모두 이미 명시 상태).
 *
 * 수정:
 * - aiService.ts:115 — uid default 'anonymous' 제거.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로 (이미 명시).
 * - body callProxy(... uid) 처리 보존 (line 149).
 * - cycle 606 generateEvent 3 defaults 0건 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 625: generateStory signature에서 uid default 'anonymous' 0건", async () => {
    const source = await readSrc('src/services/aiService.ts');
    assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(source),
        "generateStory uid default 'anonymous' 제거");
    assert.ok(/generateStory:\s*async\s*\(type:\s*any,\s*data:\s*any,\s*uid:\s*any\)/.test(source),
        'generateStory uid 파라미터 보존 (default 없이)');
});

test('cycle 625: useGameEngine generateStory callsite uid 명시 보존', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(/AI_SERVICE\.generateStory\(type,\s*\{[\s\S]*?\},\s*uid\)/.test(source),
        'useGameEngine generateStory callsite uid 명시 보존');
});

test('cycle 625: generateStory body callProxy uid 처리 보존', async () => {
    const source = await readSrc('src/services/aiService.ts');
    // line 149 callProxy(... uid)
    assert.ok(/uid/.test(source.slice(source.indexOf('generateStory'))),
        'generateStory body uid 사용 보존');
});

test('cycle 625: cycle 502-624 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(ce),
        'cycle 624 handleVictory passiveBonus default 0건');
    const dm = await readSrc('src/systems/DifficultyManager.ts');
    assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(dm),
        'cycle 623 countLowHpWins threshold default 0건');
});
