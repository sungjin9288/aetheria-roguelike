import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';

/**
 * cycle 194: abyss 'prestige_points' dead reward type 정리.
 *
 * 발견:
 * - BALANCE.ABYSS_MILESTONE_REWARDS의 floor 75/200/500이 'prestige_points' type 보상.
 * - 그러나 player.prestigePoints는 combatBossHandlers.ts 한 곳에서 +1만 되고
 *   spend/UI/ASCEND/save 어디에서도 사용 안 됨 — dead currency.
 * - 결과: abyss 75/200/500층 도달 시 visible 보상 0건. 'prestige points +N' 로그만
 *   출력되고 실제 게임 변화 없음.
 *
 * 수정:
 * 1. src/data/constants.ts ABYSS_MILESTONE_REWARDS 75/200/500을 의미 있는 type으로 교체:
 *    - 75: relic_choice (선택지 다양화)
 *    - 200: legendary_item (50/100/300 일관)
 *    - 500: relic_choice (최종 마일스톤도 의미 있는 보상)
 * 2. src/hooks/combatActions/combatBossHandlers.ts 'prestige_points' 분기 제거.
 * 3. src/data/messages.ts MSG.ABYSS_PRESTIGE_POINTS 제거 (dead).
 *
 * cycle 134/138/147/159/172/176/178/193 dead config 활성/정리 시리즈 8번째 fix.
 */

test('cycle 194: ABYSS_MILESTONE_REWARDS에 prestige_points type 0건', () => {
    const types = new Set();
    for (const reward of Object.values(BALANCE.ABYSS_MILESTONE_REWARDS || {})) {
        if (reward?.type) types.add(reward.type);
    }
    assert.ok(!types.has('prestige_points'),
        `'prestige_points' type은 dead — relic_choice/legendary_item으로 교체됐어야 함`);
});

test('cycle 194: floor 75/200/500 보상이 의미 있는 type으로 교체됨', () => {
    const r75 = BALANCE.ABYSS_MILESTONE_REWARDS[75];
    const r200 = BALANCE.ABYSS_MILESTONE_REWARDS[200];
    const r500 = BALANCE.ABYSS_MILESTONE_REWARDS[500];
    assert.equal(r75?.type, 'relic_choice');
    assert.equal(r200?.type, 'legendary_item');
    assert.equal(r500?.type, 'relic_choice');
});

test('cycle 194: ABYSS_MILESTONE_REWARDS 모든 type이 의미 있는 set에 속함', () => {
    const VALID_TYPES = new Set(['relic_choice', 'legendary_item']);
    const issues = [];
    for (const [floor, reward] of Object.entries(BALANCE.ABYSS_MILESTONE_REWARDS || {})) {
        if (!reward?.type || !VALID_TYPES.has(reward.type)) {
            issues.push(`floor ${floor}: type '${reward?.type}'`);
        }
    }
    assert.deepEqual(issues, [],
        `ABYSS_MILESTONE_REWARDS의 unknown type:\n  ${issues.join('\n  ')}`);
});

test('cycle 194: MSG.ABYSS_PRESTIGE_POINTS 제거됨 (dead)', () => {
    assert.equal(MSG.ABYSS_PRESTIGE_POINTS, undefined,
        'MSG.ABYSS_PRESTIGE_POINTS는 prestige_points dead reward와 함께 제거');
});

test('cycle 194: combatBossHandlers에 prestige_points 분기 없음 (회귀 가드)', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatBossHandlers.ts'), 'utf8');
    // milestone.type === 'prestige_points' 분기는 없어야 함 (코멘트의 prestige_points 단어는 OK).
    assert.doesNotMatch(src, /milestone\.type === ['"]prestige_points['"]/);
});
