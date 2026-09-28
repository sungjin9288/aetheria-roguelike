import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';

/**
 * 2026-09 Wave 28 (D7, 소유자 결정 "초반 구간은 완전 정예 제외").
 *
 * A-4는 "완전 엘리트(1.8~2.5×)는 Lv1에 불공정"이라며 초반 전용 완화 정예(`정예`, ×1.4)를 두었지만,
 * 일반 접두어 경로(`PREFIX_CHANCE`)는 초반 구간에서도 전체 접두어 풀을 써서 `재앙의`(2.5×)·`고대`(1.8×)를
 * 각 ~2.4% 뽑았다 — 자연 플레이 감사의 사망 41건 중 37건이 정예였다.
 *
 * 계약: 맵 레벨 ≤ EARLY_ELITE_LEVEL_CAP에서 **일반 경로**는 완전 엘리트를 내지 않는다. 대신
 * ① 초반 전용 완화 정예는 남고 ② 비정예 접두어는 그대로 나오며 ③ 플레이어가 고른 난이도
 * (`eliteOnly` 도전 · 프레스티지 정예)는 초반에도 완전 엘리트이고 ④ cap 바로 위 지역은 예전 그대로다.
 * 시드 고정 샘플링이라 결정론적이다.
 */

const SAMPLES = 4000;
const FULL_ELITE_NAMES = new Set(CONSTANTS.MONSTER_PREFIXES.filter((prefix) => prefix.isElite).map((prefix) => prefix.name));
const NON_ELITE_NAMES = new Set(CONSTANTS.MONSTER_PREFIXES.filter((prefix) => !prefix.isElite).map((prefix) => prefix.name));

const player = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '시험자',
    ...overrides,
});

const prefixOf = (enemy) => {
    const [head, ...rest] = String(enemy.name).split(' ');
    return rest.length > 0 && (FULL_ELITE_NAMES.has(head) || NON_ELITE_NAMES.has(head) || head === '정예') ? head : null;
};

/** 한 지역에서 시드 고정으로 SAMPLES번 스폰해 접두어별 횟수를 센다(보스는 접두어 경로 밖이라 뺀다). */
const census = (mapName, who = player({ loc: mapName })) => {
    const counts = new Map();
    for (let index = 0; index < SAMPLES; index += 1) {
        const rng = createDomainRandom(20260928, 'wave28-d7', mapName, index);
        const { mStats } = spawnEnemy(DB.MAPS[mapName], who, [], { addLog: () => {} }, { rng });
        if (!mStats || mStats.isBoss) continue;
        const prefix = prefixOf(mStats) ?? '(없음)';
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
    }
    return counts;
};

const count = (counts, names) => [...counts].reduce((sum, [name, n]) => sum + (names.has(name) ? n : 0), 0);

const EARLY_MAPS = Object.entries(DB.MAPS)
    .filter(([, map]) => typeof map.level === 'number'
        && map.level <= BALANCE.EARLY_ELITE_LEVEL_CAP
        && map.type !== 'safe'
        && (map.monsters || []).length > 0)
    .map(([name]) => name);

test('[D7] 초반 구간의 모든 지역에서 일반 스폰은 완전 엘리트(재앙의·고대)를 내지 않는다', () => {
    assert.ok(EARLY_MAPS.length >= 3, `초반 구간 지역이 있어야 한다: ${EARLY_MAPS}`);
    for (const mapName of EARLY_MAPS) {
        const counts = census(mapName);
        assert.equal(count(counts, FULL_ELITE_NAMES), 0, `${mapName}: ${JSON.stringify([...counts])}`);
    }
});

test('[D7 비공허] 초반 구간에서도 비정예 접두어와 초반 전용 완화 정예는 그대로 나온다', () => {
    for (const mapName of EARLY_MAPS) {
        const counts = census(mapName);
        assert.ok(count(counts, NON_ELITE_NAMES) > SAMPLES * 0.05, `${mapName}: 비정예 접두어가 사라지면 안 된다 ${JSON.stringify([...counts])}`);
        assert.ok((counts.get('정예') || 0) > SAMPLES * 0.05, `${mapName}: 초반 전용 정예는 유지된다 ${JSON.stringify([...counts])}`);
    }
});

test('[D7 경계] cap 바로 위 지역은 예전처럼 완전 엘리트가 일반 스폰에 섞인다', () => {
    // `boss` 문자열만 있고 `bossMonsters`가 없는 지역은 모든 스폰이 보스로 분류돼 접두어 경로를 타지 않는다
    //   (예: 신성한 호수 Lv7) — 일반 스폰이 실제로 있는 cap 위 첫 지역을 고른다.
    const above = Object.entries(DB.MAPS)
        .filter(([, map]) => typeof map.level === 'number'
            && map.level > BALANCE.EARLY_ELITE_LEVEL_CAP
            && map.type !== 'safe'
            && (map.monsters || []).length > 0)
        .sort(([, left], [, right]) => left.level - right.level)
        .find(([name]) => [...census(name).values()].reduce((sum, n) => sum + n, 0) > 0);
    assert.ok(above, 'cap 위에 일반 스폰이 있는 지역이 있어야 한다');
    assert.ok(above[1].level <= BALANCE.EARLY_ELITE_LEVEL_CAP + 5, `경계 근처여야 한다: ${above[0]}(Lv${above[1].level})`);
    const counts = census(above[0]);
    assert.ok(count(counts, FULL_ELITE_NAMES) > 0, `${above[0]}(Lv${above[1].level}): ${JSON.stringify([...counts])}`);
    assert.equal(counts.get('정예') || 0, 0, 'cap 위에는 초반 전용 정예가 없다');
});

test('[D7 선택 난이도] eliteOnly 도전과 프레스티지 정예는 초반 구간에서도 완전 엘리트다', () => {
    const early = EARLY_MAPS[0];
    const challenger = census(early, player({ loc: early, challengeModifiers: ['eliteOnly'] }));
    assert.equal(count(challenger, NON_ELITE_NAMES), 0, `eliteOnly: ${JSON.stringify([...challenger])}`);
    assert.ok(count(challenger, FULL_ELITE_NAMES) > SAMPLES * 0.9, `eliteOnly: ${JSON.stringify([...challenger])}`);

    const rank = [...Array(20).keys()].find((candidate) => getPrestigeUnlocks(candidate).eliteChanceBonus > 0);
    assert.ok(rank !== undefined, '프레스티지 정예 해금 rank가 있어야 한다');
    const veteran = player({ loc: early, meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank } });
    const veteranCounts = census(early, veteran);
    assert.ok(count(veteranCounts, FULL_ELITE_NAMES) > 0, `rank ${rank}: ${JSON.stringify([...veteranCounts])}`);
});
