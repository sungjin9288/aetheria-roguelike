import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENTS } from '../src/data/quests.js';
import { getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';

/**
 * cycle 101: relicCount achievement 진행도 double-counting 회귀 fix.
 *
 * 발견된 버그:
 * - getAchievementCurrentValue('relicCount') 가 `(player.relics || []).length +
 *   (stats?.relicCount || 0)` 로 계산됨.
 * - 그러나 ADD_RELIC handler(progressionHandlers.ts:43-55)는 매 relic 획득 시
 *   player.relics 배열에 push하면서 동시에 stats.relicCount도 +1 증분.
 * - 즉 `stats.relicCount` 자체가 이미 "획득한 모든 relic 수"를 정확히 반영.
 *   거기에 현재 인벤토리의 relics.length를 더하면 현재 런의 relic이 두 번
 *   카운트됨.
 * - 결과: achievement "유물 5개 획득"(ach_relic_5)이 실제로는 3개에서 unlock
 *   (3 + 3 = 6 ≥ 5). 마찬가지로 15개 → 8개에서, 30개 → 15개에서 풀림. 의도
 *   대비 완료가 50% 빠른 부풀림 회귀.
 *
 * fix: getAchievementCurrentValue 의 relicCount 분기에서 `+ relics.length` 제거.
 * 이제 stats.relicCount 단일 source of truth로 — checkTitles('relicCount')와 정합.
 *
 * Ascension 후 relics 배열은 reset되지만 stats.relicCount는 보존되므로
 * (progressionHandlers.ts:78), prestige 누적 카운트도 그대로 유지된다.
 */

const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

test('getAchievementCurrentValue: relicCount 5 → 5 (relics 배열 길이와 무관)', () => {
    const player = {
        relics: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
        stats: { relicCount: 5 },
    };
    assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 5);
});

test('isAchievementUnlocked: ach_relic_5 — relicCount 정확히 5에서 unlock', () => {
    // 4개 시점: 미잠금
    assert.equal(
        isAchievementUnlocked(findAch('ach_relic_5'), {
            relics: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}` })),
            stats: { relicCount: 4 },
        }),
        false,
        'should NOT unlock at 4 relics'
    );
    // 5개 시점: 잠금 해제
    assert.equal(
        isAchievementUnlocked(findAch('ach_relic_5'), {
            relics: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` })),
            stats: { relicCount: 5 },
        }),
        true,
        'should unlock at exactly 5 relics'
    );
});

test('isAchievementUnlocked: ach_relic_5 — 3개 시점에 더 이상 false unlock 안 됨 (회귀 가드)', () => {
    // 회귀: 이전엔 (3 + 3 = 6 ≥ 5) 로 unlock 됐음
    const player = {
        relics: Array.from({ length: 3 }, (_, i) => ({ id: `r${i}` })),
        stats: { relicCount: 3 },
    };
    assert.equal(
        isAchievementUnlocked(findAch('ach_relic_5'), player),
        false,
        'must NOT false-unlock with 3 relics (fix double-counting)'
    );
});

test('Ascension 후 relicCount 보존 시나리오: relics=[] but relicCount=12 → ach_relic_5/15 unlocked', () => {
    // 첫 런에서 12개 획득 후 ascend → relics=[]로 리셋되지만 stats.relicCount=12 보존.
    const player = { relics: [], stats: { relicCount: 12 } };
    assert.equal(isAchievementUnlocked(findAch('ach_relic_5'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_relic_15'), player), false, '15는 아직 부족');
});

test('relics 누락 (legacy save) → relicCount만으로도 정상 평가', () => {
    const player = { stats: { relicCount: 10 } };
    assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 10);
});
