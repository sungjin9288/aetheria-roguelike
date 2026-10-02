import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { MAPS } from '../src/data/maps.js';
import { QUESTS } from '../src/data/quests.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { getQuestObjectiveGate } from '../src/utils/questObjectiveGate.js';
import { getMapSignatureDrops } from '../src/utils/mapSignatureHints.js';

/**
 * 2026-10 Wave 61 (원장 §61 A2, 소유자 결정 "지역 조우에 넣는다") — 지역의 `bossMonsters`에 적힌 보스는 실제로 나와야 한다.
 *
 * `spawnEnemy`의 조우 풀은 `monsters` + 해금된 숨은 보스이고 구역 보스는 게이지 도전(`forceAreaBoss`)으로만 나온다. Wave 56이
 * 허공의 눈을 "풀에 이미 있는 보스의 가중치"로 바꾼 뒤 `bossMonsters`에만 있던 6종(프로토타입 제로 · 에테르 심판자 · 공허의 대행자 ·
 * 봄의 여왕 · 서리 군주 · 에테르 관문의 무한의 화신)은 지역당 6,000회에서도 0회였다 — 임무 109 · 150 완료 불가, 도감 254 미완,
 * 지역 탐험 완료 불가, 전설 각인 안내(세계수의 지팡이 · 빙결의 왕관검)가 거짓이었다. 도달 비용 리포트는 `bossMonsters`를 출현
 * 경로로 세서 이것을 못 봤다. 이 파일은 그 가정(= `bossMonsters`는 나온다)을 실제 스폰으로 고정한다.
 */

const ROLLS = 4_000;

// 숨은 보스 4종의 해금 조건을 모두 만족하는 플레이어(시간술사 Lv40 · 최후의 영웅 3단계 · 심연 100층 · 계승 10).
const unlockedPlayer = (loc) => ({
    loc,
    level: 40,
    job: '시간술사',
    stats: { abyssFloor: 100 },
    meta: { prestigeRank: 10 },
    eventChainProgress: { last_hero: 3 },
    quests: [],
    relics: [],
});

const seeded = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
};

const spawnedNames = (mapName, map) => {
    const names = new Set();
    const rng = seeded(0x61a2);
    const player = unlockedPlayer(mapName);
    for (let i = 0; i < ROLLS; i += 1) {
        const { baseName } = spawnEnemy(map, player, [], { addLog: () => {} }, { rng });
        if (baseName) names.add(baseName);
    }
    if (typeof map.boss === 'string') {
        const { baseName } = spawnEnemy(map, player, [], { addLog: () => {} }, { forceAreaBoss: true, rng });
        if (baseName) names.add(baseName);
    }
    // 혼돈의 심연의 층 보스는 `exploreFlow`가 보스 층에서 `BALANCE.ABYSS_BOSS_NAMES`로 세운다.
    if (map.level === 'infinite') {
        for (const floor of BALANCE.ABYSS_BOSS_FLOORS) names.add(BALANCE.ABYSS_BOSS_NAMES[floor]);
    }
    return names;
};

const SPAWN_CACHE = new Map();
const spawnable = (mapName) => {
    if (!SPAWN_CACHE.has(mapName)) SPAWN_CACHE.set(mapName, spawnedNames(mapName, MAPS[mapName]));
    return SPAWN_CACHE.get(mapName);
};

test('Wave 61 A2: 모든 지역의 bossMonsters는 그 지역에서 실제로 스폰된다 (조우 · 구역 보스 · 숨은 보스 · 심연 층)', () => {
    const missing = [];
    for (const [mapName, map] of Object.entries(MAPS)) {
        for (const boss of map.bossMonsters || []) {
            if (!spawnable(mapName).has(boss)) missing.push(`${mapName} → ${boss}`);
        }
    }
    assert.deepEqual(missing, []);
});

test('Wave 61 A2: 나오지 않던 6종은 자기 지역 일반 조우에서 나온다', () => {
    const cases = [
        ['기계 폐도', '프로토타입 제로'],
        ['에테르 폐허', '에테르 심판자'],
        ['공허의 회랑', '공허의 대행자'],
        ['봄의 정원', '봄의 여왕'],
        ['서리 폭풍 유적', '서리 군주'],
    ];
    for (const [mapName, boss] of cases) {
        assert.ok(MAPS[mapName].monsters.includes(boss), `${mapName}: ${boss}가 조우 풀에 없다`);
        // 숨은 보스 조건 없이도(Lv1 신규 플레이어) 나온다.
        const rng = seeded(0x61a3);
        const player = { loc: mapName, level: 1, stats: {}, meta: {}, quests: [], relics: [] };
        let seen = 0;
        for (let i = 0; i < ROLLS; i += 1) {
            if (spawnEnemy(MAPS[mapName], player, [], { addLog: () => {} }, { rng }).baseName === boss) seen += 1;
        }
        assert.ok(seen > 0, `${mapName}: ${boss} 0/${ROLLS}`);
    }
});

test('Wave 61 A2: 무한의 화신은 혼돈의 심연 50층 보스다 — 에테르 관문 목록에 없고, 심연 목록이 층 보스 10종 전부를 든다', () => {
    assert.equal(MAPS['에테르 관문'].bossMonsters.includes('무한의 화신'), false);
    const abyss = Object.entries(MAPS).find(([, map]) => map.level === 'infinite');
    assert.ok(abyss, '무한 심연 지역이 없다');
    const floorBosses = BALANCE.ABYSS_BOSS_FLOORS.map((floor) => BALANCE.ABYSS_BOSS_NAMES[floor]);
    assert.deepEqual([...abyss[1].bossMonsters].sort(), [...floorBosses].sort());
});

test('Wave 61 A2: 임무 109 · 150 · 96의 목표 지역은 그 보스가 실제로 나오는 곳이다', () => {
    const expected = { 109: '에테르 폐허', 150: '공허의 회랑', 96: '혼돈의 심연' };
    for (const [id, mapName] of Object.entries(expected)) {
        const quest = QUESTS.find((entry) => entry.id === Number(id));
        assert.ok(quest, `임무 ${id} 없음`);
        const gate = getQuestObjectiveGate(quest, MAPS);
        assert.equal(gate?.map, mapName, `임무 ${id} (${quest.target})`);
        assert.ok(spawnable(mapName).has(quest.target), `임무 ${id}: ${quest.target}가 ${mapName}에서 나오지 않는다`);
    }
});

test('Wave 61 A2: 지역 전설 각인 안내는 그 지역에서 실제로 나오는 몬스터의 드롭 표에서 온다', () => {
    // 봄의 정원 · 서리 폭풍 유적은 나오지 않는 보스(봄의 여왕 · 서리 군주)의 각인(세계수의 지팡이 · 빙결의 왕관검)을 안내했다.
    const bad = [];
    for (const mapName of Object.keys(MAPS)) {
        for (const drop of getMapSignatureDrops(mapName)) {
            const fromSpawnable = [...spawnable(mapName)].some((monster) => (DROP_TABLES[monster] || [])
                .some((entry) => entry?.item === drop.name));
            if (!fromSpawnable) bad.push(`${mapName}: ${drop.name}`);
        }
    }
    assert.deepEqual(bad, []);
    assert.ok(getMapSignatureDrops('봄의 정원').some((drop) => drop.name === '세계수의 지팡이'));
    assert.ok(getMapSignatureDrops('서리 폭풍 유적').some((drop) => drop.name === '빙결의 왕관검'));
});
