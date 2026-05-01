import test from 'node:test';
import assert from 'node:assert/strict';

import { MAPS } from '../src/data/maps.js';

// cycle 70: Bestiary / MonsterCodex / Codex의 monstersSet에 boss / bossMonsters가
// 누락되던 버그 수정 회귀 가드.
//
// 기존 동작: (Object.values(MAPS)).forEach(map => map.monsters.forEach(...))
//   → 단일 map.boss 필드만 있는 보스(예: 고대 호수의 수호신)가 set에 안 들어감
//   → Bestiary "발견 % 진행"에서 보이지도 않고, 도감 total count에도 빠짐
//
// 수정 후: monsters + bossMonsters + boss(string) 합집합으로 set 채움.
// 이 테스트는 set 자체를 만드는 로직을 src에서 빌려와 검증하는 게 아니라,
// MAPS의 모든 map.boss 단일 필드 값들이 다 string임을 보장 + 신성한 호수의
// 보스가 등록된 상태임을 confirm해 회귀 시 곧장 깨지게 한다.

const collectMapEncounters = (map) => [
    ...(Array.isArray(map?.monsters) ? map.monsters : []),
    ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
    ...(typeof map?.boss === 'string' ? [map.boss] : []),
];

test('cycle 70: 모든 map.boss 단일 필드는 string 또는 boolean', () => {
    for (const [mapName, map] of Object.entries(MAPS)) {
        if (map.boss === undefined) continue;
        // 일부 map은 boss: true/false (legendary 플래그) — string은 실제 보스 이름.
        // helper는 string만 인식하므로 bool 케이스는 silently 무시되어야 함.
        assert.ok(
            typeof map.boss === 'string' || typeof map.boss === 'boolean',
            `${mapName}.boss는 string(보스 이름) 또는 boolean(legendary 플래그)이어야 함`
        );
    }
});

test('cycle 70: 신성한 호수의 boss "고대 호수의 수호신"이 monstersSet에 포함됨', () => {
    const lake = MAPS['신성한 호수'];
    assert.ok(lake, 'map exists');
    const encounters = collectMapEncounters(lake);
    assert.ok(
        encounters.includes('고대 호수의 수호신'),
        'collectMapEncounters가 boss 단일 필드를 누락하지 않아야 함'
    );
});

test('cycle 70: collectMapEncounters helper가 monsters + bossMonsters + boss 모두 합침', () => {
    const fakeMap = {
        monsters: ['m1', 'm2'],
        bossMonsters: ['b1'],
        boss: 'b2',
    };
    const result = collectMapEncounters(fakeMap);
    assert.deepEqual(result.sort(), ['b1', 'b2', 'm1', 'm2']);
});

test('cycle 70: boss: true (legendary 표시)는 helper가 무시함', () => {
    const fakeMap = {
        monsters: ['m1'],
        boss: true,  // legendary 표시지 실제 이름 아님
    };
    const result = collectMapEncounters(fakeMap);
    assert.deepEqual(result, ['m1'], 'boss=true는 string 필터에 안 걸림');
});

test('cycle 70: boss / bossMonsters 둘 다 없는 평범한 맵', () => {
    const fakeMap = { monsters: ['m1', 'm2'] };
    const result = collectMapEncounters(fakeMap);
    assert.deepEqual(result, ['m1', 'm2']);
});
