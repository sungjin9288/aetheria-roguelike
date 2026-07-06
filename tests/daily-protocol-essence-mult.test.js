import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDailyProtocolProgress } from '../src/reducers/handlers/helpers.ts';
import { BALANCE } from '../src/data/constants.ts';

/**
 * 일일 프로토콜 에센스 지급 배율 일관성 (2026-07, 에테르 거울 PR #17 후속).
 *
 * 전투/승천 경로(CombatEngine.outcome.ts)는 프레스티지 rank essenceMult ×
 * 거울 essence_flow 배율을 곱연산 적용하는데, 일일 프로토콜 지급 경로
 * (applyDailyProtocolProgress)만 배율 없이 원액 지급하던 지급처 간 불일치를
 * 고정한다. 공식은 전투 경로와 동일: max(1, floor(gain × rankMult × mirrorMult)).
 */

const mkPlayer = (meta = {}, essenceReward = 10) => ({
    name: '테스터', level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    inv: [], relics: [], stats: {
        dailyProtocol: {
            date: new Date().toISOString().slice(0, 10),
            relicShards: 0,
            missions: [
                { type: 'kills', goal: 1, progress: 0, done: false, reward: { essence: essenceReward } },
            ],
        },
    },
    meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, ...meta },
});

const essenceAfter = (meta, reward = 10) =>
    applyDailyProtocolProgress(mkPlayer(meta, reward), 'kills', 1).meta.essence;

test('rank0 + 거울 없음 → 배율 1 (기존 지급량 불변)', () => {
    assert.equal(essenceAfter({}), 10);
});

test('rank1 → 에센스 +10% (rank 배율, 전투 경로와 동일)', () => {
    const expected = Math.floor(10 * (1 + BALANCE.PRESTIGE_ESSENCE_BONUS));
    assert.equal(essenceAfter({ prestigeRank: 1 }), expected);
    assert.equal(expected, 11);
});

test('rank8 → 에센스 +20% 누적 (rank1 + rank8)', () => {
    const expected = Math.floor(10 * (1 + BALANCE.PRESTIGE_ESSENCE_BONUS + BALANCE.PRESTIGE_R8_ESSENCE_BONUS));
    assert.equal(essenceAfter({ prestigeRank: 8 }), expected);
    assert.equal(expected, 12);
});

test('거울 essence_flow Lv2 → ×1.2 (rank0)', () => {
    assert.equal(essenceAfter({ mirror: { essence_flow: 2 } }), 12);
});

test('rank8 × 거울 Lv2 → 곱연산 누적 (floor(10 × 1.2 × 1.2) = 14)', () => {
    assert.equal(essenceAfter({ prestigeRank: 8, mirror: { essence_flow: 2 } }), 14);
});

test('배율 적용 후에도 최소 1 보장 (소액 보상 × floor)', () => {
    // reward 1 × 1.0 → floor(1)=1. 배율이 있어도 0으로 떨어지지 않는 계약.
    assert.equal(essenceAfter({}, 1), 1);
});

test('에센스 미보상 미션(essenceGain 0)은 meta 무변화 경로 유지', () => {
    const player = mkPlayer({}, 10);
    player.stats.dailyProtocol.missions = [
        { type: 'kills', goal: 1, progress: 0, done: false, reward: { relicShard: 1 } },
    ];
    const next = applyDailyProtocolProgress(player, 'kills', 1);
    assert.equal(next.meta.essence, 0);
});
