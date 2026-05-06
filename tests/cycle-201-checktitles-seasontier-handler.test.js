import test from 'node:test';
import assert from 'node:assert/strict';

import { checkTitles } from '../src/utils/gameUtils.js';

/**
 * cycle 201: checkTitles에 'seasonTier' cond.type 핸들러 추가 (cycle 175 follow-up).
 *
 * 발견 (cycle 199 lens 동일 패턴 재발견):
 * - cycle 175에서 시즌 패스 보상 칭호 3종(시즌 선구자/정복자/마스터)을 정식 TITLES 등록.
 *   cond.type='seasonTier', cond.val=10/20/30.
 * - CLAIM_SEASON_REWARD(rewardHandlers.ts)가 직접 player.titles에 push — 정상 케이스 OK.
 * - 그러나 checkTitles는 'seasonTier' 분기 미구현 → 복구 케이스(저장 손실 / migration /
 *   engine bug 등)에서 시즌 칭호 자동 복원 불가. cycle 199 'prestigeRank' 회귀와 동일.
 *
 * 수정 (src/utils/gameUtils.ts checkTitles):
 * - 'seasonTier' cond.type 분기 추가 — player.seasonPass.tier >= val 시 true.
 * - cycle 175 등록 정합성 + 안전 lock.
 */

const buildPlayer = (overrides = {}) => ({
    level: 50,
    titles: [],
    meta: { prestigeRank: 0 },
    stats: { kills: 0 },
    seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
    ...overrides,
});

test('cycle 201: seasonTier 10 도달 시 시즌 선구자 자동 인식', () => {
    const player = buildPlayer({
        seasonPass: { xp: 0, tier: 10, claimed: [], isPremium: false, seasonId: 'S1' },
    });
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('시즌 선구자'),
        `expected '시즌 선구자' in newTitles; got ${JSON.stringify(newTitles)}`);
});

test('cycle 201: seasonTier 30 도달 시 3종 모두 자동 인식', () => {
    const player = buildPlayer({
        seasonPass: { xp: 0, tier: 30, claimed: [], isPremium: false, seasonId: 'S1' },
    });
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('시즌 선구자'));
    assert.ok(newTitles.includes('시즌 정복자'));
    assert.ok(newTitles.includes('시즌 마스터'));
});

test('cycle 201: seasonTier 0 (기본) → 시즌 칭호 0건', () => {
    const player = buildPlayer();
    const newTitles = checkTitles(player);
    assert.ok(!newTitles.includes('시즌 선구자'));
    assert.ok(!newTitles.includes('시즌 정복자'));
    assert.ok(!newTitles.includes('시즌 마스터'));
});

test('cycle 201: seasonTier 25 → 10/20만 인식, 30 미인식 (boundary)', () => {
    const player = buildPlayer({
        seasonPass: { xp: 0, tier: 25, claimed: [], isPremium: false, seasonId: 'S1' },
    });
    const newTitles = checkTitles(player);
    assert.ok(newTitles.includes('시즌 선구자'));
    assert.ok(newTitles.includes('시즌 정복자'));
    assert.ok(!newTitles.includes('시즌 마스터'));
});

test('cycle 201: 이미 보유한 시즌 칭호는 newTitles에서 제외 (회귀 가드)', () => {
    const player = buildPlayer({
        seasonPass: { xp: 0, tier: 30, claimed: [], isPremium: false, seasonId: 'S1' },
        titles: ['시즌 선구자'],
    });
    const newTitles = checkTitles(player);
    assert.ok(!newTitles.includes('시즌 선구자'));
    assert.ok(newTitles.includes('시즌 정복자'));
    assert.ok(newTitles.includes('시즌 마스터'));
});

test('cycle 201: seasonPass 미정의 (구형 save) → 시즌 칭호 0건 + 크래시 없음', () => {
    const player = buildPlayer();
    delete player.seasonPass;
    const newTitles = checkTitles(player);
    assert.ok(!newTitles.includes('시즌 선구자'));
    assert.ok(!newTitles.includes('시즌 정복자'));
    assert.ok(!newTitles.includes('시즌 마스터'));
});
