import test from 'node:test';
import assert from 'node:assert/strict';

import { checkTitles } from '../src/utils/gameUtils.js';
import { PRESTIGE_TITLES } from '../src/data/titles.js';

/**
 * cycle 199: checkTitles에 'prestigeRank' cond.type 핸들러 추가 (cycle 197 follow-up).
 *
 * 발견 (cycle 197 follow-up):
 * - cycle 197에서 PRESTIGE_TITLES 10종을 정식 TITLES 등록. cond.type='prestigeRank',
 *   cond.val=rank.
 * - ASCEND는 직접 newTitle payload로 PRESTIGE_TITLES[rank-1] 추가 — 정상 케이스.
 * - 그러나 checkTitles는 'prestigeRank' 분기 미구현 → 복구 케이스(저장 손실 /
 *   migration / engine bug 등)에서 prestige 칭호 자동 복원 불가.
 *
 * 수정 (src/utils/gameUtils.ts checkTitles):
 * - 'prestigeRank' cond.type 분기 추가 — player.meta.prestigeRank >= val 시 true.
 * - cycle 197 등록 정합성 + 안전 lock.
 */

const buildPlayer = (overrides = {}) => ({
    level: 50,
    titles: [],
    meta: { prestigeRank: 0 },
    stats: { kills: 0 },
    ...overrides,
});

test('cycle 199: prestigeRank 1 도달 시 각성자 칭호 자동 인식', () => {
    const player = buildPlayer({ meta: { prestigeRank: 1 } });
    const newTitles = checkTitles(player);
    // PRESTIGE_TITLES[0] = '각성자', cond.val=1.
    assert.ok(newTitles.includes('각성자'),
        `expected '각성자' in newTitles; got ${JSON.stringify(newTitles)}`);
});

test('cycle 199: prestigeRank 10 도달 시 모든 prestige 칭호 자동 인식', () => {
    const player = buildPlayer({ meta: { prestigeRank: 10 } });
    const newTitles = checkTitles(player);
    // PRESTIGE_TITLES 10종 모두 cond.val <= 10이므로 전부 충족.
    for (const t of PRESTIGE_TITLES) {
        assert.ok(newTitles.includes(t),
            `expected '${t}' in newTitles for rank 10`);
    }
});

test('cycle 199: prestigeRank 0 (기본) → prestige 칭호 0건', () => {
    const player = buildPlayer({ meta: { prestigeRank: 0 } });
    const newTitles = checkTitles(player);
    for (const t of PRESTIGE_TITLES) {
        assert.ok(!newTitles.includes(t),
            `'${t}'은 rank 0에 자동 grant 안 돼야 함`);
    }
});

test('cycle 199: 이미 보유한 prestige 칭호는 newTitles에서 제외 (회귀 가드)', () => {
    const player = buildPlayer({
        meta: { prestigeRank: 5 },
        titles: ['각성자', '초월자'],
    });
    const newTitles = checkTitles(player);
    // 이미 보유한 두 개는 결과에서 제외.
    assert.ok(!newTitles.includes('각성자'));
    assert.ok(!newTitles.includes('초월자'));
    // 나머지 rank 3-5 (cycle 197 cond.val 3,4,5)는 포함.
    assert.ok(newTitles.includes('심연의 탐험가'));
    assert.ok(newTitles.includes('에테르 기사'));
    assert.ok(newTitles.includes('허공의 지배자'));
});

test('cycle 119 회귀 가드: 기존 prestige cond.type 영향 없음', () => {
    // 기존 'prestige' cond.type을 가진 칭호는 그대로 동작 (transcendent / eternal 등).
    const player = buildPlayer({ meta: { prestigeRank: 5 } });
    const newTitles = checkTitles(player);
    // transcendent (cond { type: 'prestige', val: 5 })는 여전히 인식.
    assert.ok(newTitles.includes('transcendent'));
});
