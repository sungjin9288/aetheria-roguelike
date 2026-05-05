import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTS } from '../src/data/quests.js';
import { MAPS } from '../src/data/maps.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 184: quest.target 도달 가능성 가드 + 6 unreachable 퀘스트 매핑 fix.
 *
 * 발견 (cycle 164 follow-up):
 * - cycle 164는 quest target이 MONSTERS keys에 존재하는지 검사 (정합성).
 * - 그러나 monster가 MONSTERS에 등록돼도 어떤 map의 monsters[] / bossMonsters[] /
 *   boss / ABYSS_BOSS_NAMES 어디에도 안 들어가면 spawn 안 됨 → 퀘스트 진행도
 *   영원히 0 (도달 불가).
 * - 6 quests 발견 — quest 105/106/107/108/109/150이 spawn pool 미참여 monster
 *   타겟. cycle 173 baseline 보강과 같은 카테고리의 잠복 회귀.
 *
 * 수정 (perl batch):
 *
 * | Quest ID | 기존 target          | → 교체 (map-reachable)             |
 * |----------|----------------------|------------------------------------|
 * | 105      | 에테르 방랑자        | 에테르 잔류체 (에테르 폐허 monsters) |
 * | 106      | 차원의 포식자        | 차원 포식자 (공허의 회랑 monsters/boss) |
 * | 107      | 공허의 감시자        | 공허 감시병 (에테르 폐허 monsters) |
 * | 108      | 허무의 기사          | 허무 집행관 (공허의 회랑 monsters) |
 * | 109      | 에테르 심판자        | 에테르 드래곤 (에테르 관문 boss)   |
 * | 150      | 공허의 대행자        | 공허 집행관 (에테르 관문 monsters) |
 *
 * cycle 164 quest target → MONSTERS 정합성 가드와 같이 lock — 두 단계:
 * 1. monster name이 MONSTERS keys에 존재 (cycle 164).
 * 2. monster가 어떤 map의 spawn pool에 포함됨 (cycle 184, 본 사이클).
 */

const SYSTEM_TARGETS = new Set([
    'Level', 'level', 'kills', 'explores', 'deaths', 'rests', 'crafts', 'synths',
    'bossKills', 'bountiesCompleted', 'discoveries', 'discoveryChains',
    'maxKillStreak', 'prestige', 'relicCount', 'abyssRecord', 'demonKingSlain',
    'escapes', 'signaturesDiscovered', 'signatureSetsCompleted', 'total_gold',
    'arcane', 'crusher', 'dual', 'fortress', 'lowHpWins',
]);

const collectReachableMonsters = () => {
    const reachable = new Set();
    // 일반 spawn pool
    for (const mapData of Object.values(MAPS)) {
        for (const m of (mapData.monsters || [])) reachable.add(m);
        for (const m of (mapData.bossMonsters || [])) reachable.add(m);
        if (typeof mapData.boss === 'string') reachable.add(mapData.boss);
    }
    // ABYSS_BOSS_NAMES — abyss 깊이별 spawn
    for (const name of Object.values(BALANCE.ABYSS_BOSS_NAMES || {})) {
        reachable.add(name);
    }
    // hidden bosses (exploreUtils.ts 하드코딩)
    ['시간의 파수꾼', '원한의 용사', '공허의 군주'].forEach((n) => reachable.add(n));
    return reachable;
};

test('quest.target 도달 가능성: 모든 monster target이 spawn pool에 포함됨', () => {
    const reachable = collectReachableMonsters();
    const unreachable = [];
    for (const q of QUESTS) {
        if (typeof q.target !== 'string') continue;
        if (SYSTEM_TARGETS.has(q.target)) continue;
        if (!reachable.has(q.target)) {
            unreachable.push(`quest ${q.id} '${q.title}': '${q.target}'`);
        }
    }
    assert.deepEqual(unreachable, [],
        `unreachable quest targets:\n  ${unreachable.join('\n  ')}`);
});

test('cycle 184: 6 quest 매핑 명시 가드', () => {
    const findQuest = (id) => QUESTS.find((q) => q.id === id);
    assert.equal(findQuest(105)?.target, '에테르 잔류체');
    assert.equal(findQuest(106)?.target, '차원 포식자');
    assert.equal(findQuest(107)?.target, '공허 감시병');
    assert.equal(findQuest(108)?.target, '허무 집행관');
    assert.equal(findQuest(109)?.target, '에테르 드래곤');
    assert.equal(findQuest(150)?.target, '공허 집행관');
});
