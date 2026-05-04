import test from 'node:test';
import assert from 'node:assert/strict';

import { syncQuestProgress } from '../src/utils/questProgress.js';

/**
 * cycle 94: 퀘스트 진행도 latch — 윈도우 기반 카운터 회귀 방지.
 *
 * 발견된 회귀 위험:
 * - syncQuestProgress의 'survive_low_hp' 분기는 countLowHpWins(stats, threshold)
 *   를 호출하는데, 그 함수는 stats.recentBattles(50개 윈도우) 안에서 hpRatio
 *   <= threshold 인 win 횟수를 센다.
 * - 플레이어가 일찍 5번의 저-HP 승리를 달성해 progress=5(goal=5)에 도달했다가
 *   퀘스트를 청구하지 않은 채 50번의 일반 승리를 더 하면, 윈도우에서 옛 저-HP
 *   승리가 밀려나 current=4가 되고 progress도 5→4로 회귀해 청구가 막힘.
 * - cycle 74에서 같은 패턴(stats.escapes를 명시 카운터로 도입)으로 도주 회귀를
 *   막았으나, 그 fix는 escapes 한 곳에 국한.
 *
 * 이번 사이클은 questProgress 레이어에서 latch 패턴(Math.max)을 적용해 모든
 * 카운터 기반 진행도가 한 번 올라가면 내려가지 않게 만든다. 카운터가 단조
 * 증가인 다른 분기(explores/crafts/escapes 등)에는 무해하고, 윈도우 기반인
 * survive_low_hp의 회귀를 막는다.
 */

const buildLowHpWinsQuestPlayer = ({ progress, recentBattles }) => ({
    level: 30,
    job: '검사',
    quests: [{ id: 62, progress }],
    stats: {
        kills: 100, deaths: 0, total_gold: 5000,
        recentBattles,
    },
});

test('survive_low_hp: 진행도 5에서 recentBattles 빈 상태로도 progress 5 유지 (latch)', () => {
    // 시나리오: 이미 5번의 저-HP 승리를 모았고 quest.progress=5. 그 뒤로 50번의
    // 일반 승리로 윈도우가 회전하여 저-HP 승리가 모두 밀려난 상태(recentBattles
    // 에 hpRatio<=0.2인 win이 0건). 기존 코드라면 progress=0으로 회귀.
    const recentBattles = Array.from({ length: 50 }, () => ({ result: 'win', hpRatio: 0.9 }));
    const player = buildLowHpWinsQuestPlayer({ progress: 5, recentBattles });
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 62);
    assert.equal(quest.progress, 5, 'progress should latch at 5, not regress to 0');
});

test('survive_low_hp: 진행도 0에서 저-HP 승리 3건 → progress 3 (정상 증가)', () => {
    const recentBattles = [
        { result: 'win', hpRatio: 0.15 },
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.05 },
        { result: 'win', hpRatio: 0.5 }, // not low-HP
    ];
    const player = buildLowHpWinsQuestPlayer({ progress: 0, recentBattles });
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 62);
    assert.equal(quest.progress, 3, 'normal monotonic progress when increasing');
});

test('survive_low_hp: latch 후에도 새 저-HP 승리는 추가로 누적', () => {
    const recentBattles = [
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.18 },
        { result: 'win', hpRatio: 0.18 },
    ];
    const player = buildLowHpWinsQuestPlayer({ progress: 4, recentBattles });
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 62);
    assert.equal(quest.progress, 5, '4 + new wins → cap at goal=5');
});

test('explore_count quest: 회귀 없이 stats.explores 정상 매핑 (회귀 보존)', () => {
    const player = {
        level: 12, job: '모험가',
        stats: { kills: 0, deaths: 0, total_gold: 0, explores: 8 },
        quests: [{ id: 61, progress: 0 }],
    };
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 61);
    assert.equal(quest.progress, 8);
});

test('explore_count quest: latch 적용 — explores가 줄어도 progress 유지', () => {
    // 상상적 케이스 — explores 카운터가 어떤 이유로 감소한 경우
    const player = {
        level: 12, job: '모험가',
        stats: { kills: 0, deaths: 0, total_gold: 0, explores: 3 },
        quests: [{ id: 61, progress: 12 }], // 이전엔 progress=12까지 올라감
    };
    const result = syncQuestProgress(player);
    const quest = result.updatedQuests.find((q) => q.id === 61);
    assert.equal(quest.progress, 12, 'latch protects against any unexpected counter regression');
});
