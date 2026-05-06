import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDailyProtocolProgress } from '../src/reducers/handlers/helpers.js';

/**
 * cycle 232: relicShards 5/5 conversion 메커니즘 추가 (cycle 215 dead reward chain lens 확장).
 *
 * 발견 (relicShards dead):
 * - 일일 프로토콜 'gold_n' 미션 완료 시 reward.relicShard: 1 부여.
 * - applyDailyProtocolProgress에서 dp.relicShards 누적.
 * - SystemTab: 'X/5 조각' 표시 — 5개 도달 시 변환 의도 명백.
 * - 그러나 5개 도달 시 변환 코드 0건. 무한 누적되는 dead reward.
 * - cycle 215 (claimAchievement premiumCurrency 미처리) / cycle 222-229 (defined-but-unused
 *   data) lens와 같은 결.
 *
 * 수정 (src/reducers/handlers/helpers.ts applyDailyProtocolProgress):
 * - newShards >= 5 시 5개 소모 + 1 random 유물 player.relics에 추가.
 * - 단, player.relics.length < MAX_RELICS_PER_RUN(5) 일 때만 변환 — cap 시 shards 유지.
 * - 이미 보유 중인 유물은 제외(중복 방지).
 *
 * 회귀 가드:
 * - shards < 5 시 변환 안 함.
 * - relic 후보 0건(이미 모두 보유) 시 변환 안 함, shards 유지.
 * - relic 추가 시 stats.relicCount도 +1 (cycle 101 single source of truth 정합).
 * - rank 시스템 / essence 부여 등 기존 로직 보존.
 */

test('cycle 232: shards 5+ → relic 1개 자동 변환', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [],
        stats: {
            relicCount: 0,
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 4, // 4 + 1 = 5 → 변환 trigger
                missions: [
                    { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
    // 변환 후 shards = 0 (5 소모), relics +1
    assert.equal(updated.stats.dailyProtocol.relicShards, 0,
        '5 shards 소모되어야 함');
    assert.equal((updated.relics || []).length, 1,
        '1 random relic 자동 추가되어야 함');
});

test('cycle 232: shards < 5 시 변환 안 함 (회귀 가드)', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [],
        stats: {
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 2, // 2 + 1 = 3 (< 5) → 변환 안 됨
                missions: [
                    { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
    assert.equal(updated.stats.dailyProtocol.relicShards, 3, '5 미만이면 변환 안 함');
    assert.equal((updated.relics || []).length, 0, 'relic 추가 안 됨');
});

test('cycle 232: 6 shards 누적 시 1번만 변환 (남은 1개 유지)', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [],
        stats: {
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 5, // 5 + 1 = 6 → 5 소모, 1 남음
                missions: [
                    { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
    assert.equal(updated.stats.dailyProtocol.relicShards, 1,
        '6 shards → 5 소모, 1 잔존');
    assert.equal((updated.relics || []).length, 1);
});

test('cycle 232: relic cap 도달 시 변환 안 함, shards 유지', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [
            { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }, // MAX_RELICS_PER_RUN=5
        ],
        stats: {
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 4,
                missions: [
                    { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
    // cap 도달 시 변환 안 됨, shards 5로 유지
    assert.equal(updated.stats.dailyProtocol.relicShards, 5,
        'cap 도달 시 변환 안 함, shards 5로 유지');
    assert.equal((updated.relics || []).length, 5, 'relics 수 변화 없음');
});

test('cycle 232: 변환된 relic은 stats.relicCount 증분', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [],
        stats: {
            relicCount: 0,
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 4,
                missions: [
                    { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
    assert.equal(updated.stats.relicCount, 1,
        'relicCount는 cycle 101 single source — 변환 시 동기 증분');
});

test('cycle 232: 기존 essence/item 보상 처리 보존 (회귀 가드)', () => {
    const player = {
        name: 'Test', level: 10,
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
        relics: [],
        stats: {
            dailyProtocol: {
                date: '2026-05-06',
                relicShards: 0,
                missions: [
                    { id: 'kill_n', type: 'kills', goal: 5, progress: 4, done: false, reward: { essence: 50 } },
                ],
            },
        },
    };
    const updated = applyDailyProtocolProgress(player, 'kills', 1);
    // essence 50 boost → 변경 확인
    assert.equal(updated.meta.essence, 50, 'essence 보상 동작 유지');
});
