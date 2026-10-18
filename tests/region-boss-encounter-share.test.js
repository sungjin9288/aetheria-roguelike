import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { RELICS } from '../src/data/relics.js';
import { selectEncounterMonster, spawnEnemy } from '../src/utils/exploreUtils.js';
import { createSeededRandom } from '../src/utils/seededRandom.js';

/**
 * 2026-10 Wave 118 — 소유자 결정 "보스를 조우의 일부로"(원장 §125).
 *
 * 용의 둥지는 조우 풀 4종 중 2종(화염의 군주 · 레드 드래곤)이 보스라 조우의 절반이 보스였고, 1회차 사망의 55%가 그 지역이었다.
 * 교전당 위험은 다른 보스와 같았다(1.4 ~ 2.8%) — 원인은 노출이라 수치가 아니라 조우 구성을 바꿨다.
 * 계약: ① `bossEncounterShare` 지역의 풀 보스는 보스마다 `REGION_BOSS_ENCOUNTER_CHANCE`(15%), 일반 종은 나머지를 고르게
 * ② 추첨은 여전히 한 번 — 이 구간이 없으면 이전과 같은 칸 ③ 그 보스를 노리는 임무는 목표 집중을 그대로 받는다
 * ④ 허공의 눈은 이 보스에도 같은 배수 ⑤ 선언 지역은 결정 범위(용의 둥지) 하나.
 */

const N = 6_000;
const sweep = (fn) => {
    const counts = new Map();
    for (let k = 0; k < N; k += 1) {
        const roll = (k + 0.5) / N;
        const name = fn(() => roll);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
};

const NEST = DB.MAPS['용의 둥지'];
const NEST_BOSSES = ['화염의 군주', '레드 드래곤'];
const playerAt = (loc, extra = {}) => ({ loc, level: 30, job: '모험가', stats: {}, meta: {}, challengeModifiers: [], quests: [], ...extra });
const noLog = { addLog: () => {} };

test('조우 비율로 뽑는 지역은 결정 범위(용의 둥지) 하나이고, 풀에 보스가 둘이다', () => {
    const declared = Object.entries(DB.MAPS).filter(([, map]) => map.bossEncounterShare).map(([name]) => name);
    assert.deepEqual(declared, ['용의 둥지']);
    assert.deepEqual(NEST.monsters.filter((name) => NEST.bossMonsters.includes(name)), NEST_BOSSES);
    assert.equal(BALANCE.REGION_BOSS_ENCOUNTER_CHANCE, 0.15);
});

test('용의 둥지 조우: 보스마다 15%, 일반 두 종이 나머지 70%를 나눈다 — 실제 spawnEnemy 경로', () => {
    const counts = new Map();
    const SAMPLES = 4_000;
    for (let seed = 1; seed <= SAMPLES; seed += 1) {
        const { baseName } = spawnEnemy(NEST, playerAt('용의 둥지'), [], noLog, { rng: createSeededRandom(seed) });
        counts.set(baseName, (counts.get(baseName) || 0) + 1);
    }
    for (const boss of NEST_BOSSES) {
        const share = (counts.get(boss) || 0) / SAMPLES;
        assert.ok(Math.abs(share - 0.15) < 0.025, `${boss} ${share}`);
    }
    for (const normal of NEST.monsters.filter((name) => !NEST_BOSSES.includes(name))) {
        const share = (counts.get(normal) || 0) / SAMPLES;
        assert.ok(Math.abs(share - 0.35) < 0.03, `${normal} ${share}`);
    }
});

test('추첨은 한 번이다 — 구간이 없으면 이전과 같은 칸, 있으면 위쪽 구간이 보스', () => {
    const pool = ['a', 'b', 'c', 'd'];
    const map = { monsters: pool };
    const player = playerAt('x');
    let draws = 0;
    selectEncounterMonster(['a', 'b'], map, player, () => { draws += 1; return 0.9; }, [], 0, ['B1', 'B2'], 0.3);
    assert.equal(draws, 1);
    // regionShare 0 → 칸 배치가 이전(숨은 보스만 있는 호출)과 같다.
    for (let k = 0; k < 200; k += 1) {
        const roll = (k + 0.5) / 200;
        assert.equal(
            selectEncounterMonster(pool, map, player, () => roll, ['H'], 0.03, ['B1'], 0),
            selectEncounterMonster(pool, map, player, () => roll, ['H'], 0.03),
        );
    }
    // 숨은 보스(맨 위) · 지역 보스(그 아래) · 일반이 같은 굴림을 나눈다.
    const counts = sweep((random) => selectEncounterMonster(['a', 'b'], map, player, random, ['H'], 0.03, ['B1', 'B2'], 0.3));
    assert.equal(counts.get('H'), Math.round(N * 0.03));
    assert.equal(counts.get('B1'), Math.round(N * 0.15));
    assert.equal(counts.get('B2'), Math.round(N * 0.15));
    assert.equal(counts.get('a') + counts.get('b'), Math.round(N * 0.67));
});

test('그 보스를 노리는 이야기 임무(208 레드 드래곤)는 목표 집중을 그대로 받는다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 208);
    assert.equal(quest.target, '레드 드래곤');
    const player = playerAt('용의 둥지', { quests: [{ id: 208, progress: 0 }] });
    const rolls = [0.1, 0.0];
    const picked = selectEncounterMonster(['화염 와이번', '드래곤 나이트'], NEST, player, () => rolls.shift(), [], 0, NEST_BOSSES, 0.3);
    assert.equal(picked, '레드 드래곤');
});

test('허공의 눈은 조우 비율 보스에도 같은 배수다(×3 → 보스마다 45%)', () => {
    const eye = RELICS.find((relic) => relic.effect === 'boss_hunter');
    assert.ok(eye);
    const counts = new Map();
    const SAMPLES = 3_000;
    for (let seed = 1; seed <= SAMPLES; seed += 1) {
        const { baseName } = spawnEnemy(NEST, playerAt('용의 둥지'), [eye], noLog, { rng: createSeededRandom(seed) });
        counts.set(baseName, (counts.get(baseName) || 0) + 1);
    }
    const spawn = Math.max(1, Math.floor(eye.val.spawn || 1));
    for (const boss of NEST_BOSSES) {
        const share = (counts.get(boss) || 0) / SAMPLES;
        assert.ok(Math.abs(share - 0.15 * spawn) < 0.03, `${boss} ${share}`);
    }
});
