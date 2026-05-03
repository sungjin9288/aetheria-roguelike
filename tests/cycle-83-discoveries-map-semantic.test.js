import test from 'node:test';
import assert from 'node:assert/strict';

import { syncQuestProgress } from '../src/utils/questProgress.js';
import { checkTitles, getAchievementCurrentValue } from '../src/utils/gameUtils.js';
import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.js';
import { TITLES } from '../src/data/titles.js';

/**
 * cycle 83: 'discoveries' 시맨틱 통일 — 지도 발견 카운트 = visitedMaps.length.
 *
 * 배경:
 * - `ach_discover_5/10/15` ("새 지역 N곳 발견") + 퀘스트 201 ("15곳 발견") +
 *   타이틀 `cartographer` ("지도 제작자") 모두 의도가 "지도(맵) 발견 카운트".
 * - 그러나 cycle X에서 `stats.discoveries`라는 별도의 이벤트 카운터가
 *   _shared.ts에서 narrative_event/relic_found/anomaly/key_event 발생 시 +1
 *   되도록 추가되었고, questProgress/checkTitles/StatsPanel이 이를 잘못 읽어
 *   "탐험 중 흥미로운 사건 마주친 횟수"로 취급되고 있었음.
 * - 결과: 타이틀 cartographer가 10번의 이벤트만으로 풀려 의도(10개 맵 발견)
 *   대비 한참 일찍 unlock. 퀘스트 201도 동일.
 *
 * 이번 사이클: questProgress + checkTitles + StatsPanel 모두 visitedMaps.length로
 * 통일. getAchievementCurrentValue('discoveries')가 이미 그렇게 읽고 있던
 * 정합성 기준선에 맞춤.
 */

const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);
const findQuest = (id) => QUESTS.find((q) => q.id === id);
const findTitle = (id) => TITLES.find((t) => t.id === id);

const makePlayer = (visitedMaps, discoveries = 0) => ({
    level: 30,
    job: '검사',
    quests: [],
    stats: {
        kills: 0, deaths: 0, total_gold: 0, killRegistry: {},
        visitedMaps,
        discoveries,
    },
});

test('quest 201 (15곳 발견): visitedMaps 14곳 → progress 14, 15곳 → progress 15', () => {
    const quest201 = findQuest(201);
    assert.ok(quest201, 'quest 201 should exist');
    assert.equal(quest201.type, 'discovery_count');
    assert.equal(quest201.target, 'discoveries');

    const player14 = {
        ...makePlayer(Array.from({ length: 14 }, (_, i) => `맵${i}`), 100),
        quests: [{ id: 201, progress: 0 }],
    };
    const out14 = syncQuestProgress(player14);
    assert.equal(out14.updatedQuests[0].progress, 14, '14 maps → 14 progress (not 100 from events)');

    const player15 = {
        ...makePlayer(Array.from({ length: 15 }, (_, i) => `맵${i}`), 0),
        quests: [{ id: 201, progress: 0 }],
    };
    const out15 = syncQuestProgress(player15);
    assert.equal(out15.updatedQuests[0].progress, 15, '15 maps → 15 progress (goal reached)');
});

test('quest 72 (탐험 발견 6회): visitedMaps 6곳 → progress 6', () => {
    const quest72 = findQuest(72);
    assert.ok(quest72, 'quest 72 should exist');
    const player = {
        ...makePlayer(['a', 'b', 'c', 'd', 'e', 'f'], 99),
        quests: [{ id: 72, progress: 0 }],
    };
    const out = syncQuestProgress(player);
    assert.equal(out.updatedQuests[0].progress, 6);
});

test('title cartographer (지도 제작자): val 10 — visitedMaps 10곳 → 활성', () => {
    const title = findTitle('cartographer');
    assert.ok(title, 'cartographer title should exist');
    assert.equal(title.cond.type, 'discoveries');
    assert.equal(title.cond.val, 10);

    const player10 = makePlayer(Array.from({ length: 10 }, (_, i) => `m${i}`), 0);
    const earned10 = checkTitles(player10);
    assert.ok(earned10.includes('cartographer'), 'with 10 visited maps cartographer should be earned');

    const player9 = makePlayer(Array.from({ length: 9 }, (_, i) => `m${i}`), 999);
    const earned9 = checkTitles(player9);
    assert.ok(!earned9.includes('cartographer'), 'with 9 visited maps cartographer should NOT be earned even with 999 events');
});

test('getAchievementCurrentValue("discoveries") 회귀 — visitedMaps.length 유지', () => {
    const player = makePlayer(['a', 'b', 'c', 'd', 'e'], 100);
    const ach = findAch('ach_discover_5');
    const value = getAchievementCurrentValue(ach, player);
    assert.equal(value, 5, 'achievement should still read visitedMaps.length (regression baseline)');
});
