import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { EARLY_ELITE_PREFIX_NAME, getSpeciesPrefixPool } from '../src/utils/enemyIdentity.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';

/**
 * 2026-10 Wave 71 — 소유자 결정 "접두어가 종 이름과 겹치는 경우 빼는 방식으로".
 *
 * 이전: 무작위 접두어 풀(`CONSTANTS.MONSTER_PREFIXES`)이 종 이름을 보지 않아 "거대 사슴벌레"에 `거대`,
 * "고대 마법사"에 `고대`가 붙었다 — "거대 거대 사슴벌레" · "고대 고대 마법사". 전 지역 × 300시드 × 세 조건
 * (일반 · eliteOnly 도전 · 프레스티지 rank 3) 42,300회 스폰에서 96회였고, 정예 강제 풀이 고대 · 재앙의 둘뿐이라
 * eliteOnly의 "고대 마법사"는 절반이 겹쳤다.
 * 이후: `getSpeciesPrefixPool`이 종 이름의 낱말과 같은 접두어를 풀에서 뺀다. 풀만 좁히고 롤 수는 그대로다 —
 * 바뀌는 스폰은 겹치는 종의 접두어 추첨뿐이다(같은 표본에서 137회, 다른 종 · 난수 호출 수는 0회 바뀜).
 */

const SAMPLES = 300;
const base = structuredClone(INITIAL_STATE.player);
const CONDITIONS = {
    normal: (loc, level) => ({ ...base, name: '시험자', loc, level }),
    eliteOnly: (loc, level) => ({ ...base, name: '시험자', loc, level, challengeModifiers: ['eliteOnly'] }),
    rank3: (loc, level) => ({ ...base, name: '시험자', loc, level, meta: { ...base.meta, prestigeRank: 3 } }),
};

const HUNTING_MAPS = Object.entries(DB.MAPS).filter(([, map]) => (map.monsters || []).length > 0);

const spawnAt = (mapName, condition, index) => {
    const map = DB.MAPS[mapName];
    const level = typeof map.level === 'number' ? map.level : 60;
    const inner = createDomainRandom(20261006, 'wave71', mapName, condition, index);
    let calls = 0;
    const rng = () => { calls += 1; return inner(); };
    const { mStats, baseName } = spawnEnemy(map, CONDITIONS[condition](mapName, level), [], { addLog: () => {} }, { rng });
    return { mStats, baseName, calls };
};

const words = (name) => String(name).replace(/^\[\d+층\]\s+/, '').split(/\s+/).filter(Boolean);

/** 데이터에서 직접 찾은, 이름에 접두어 낱말이 든 종. */
const OVERLAPPING_SPECIES = (() => {
    const prefixNames = new Set(CONSTANTS.MONSTER_PREFIXES.map((prefix) => prefix.name));
    const species = new Set();
    for (const map of Object.values(DB.MAPS)) {
        for (const name of [...(map.monsters || []), ...(map.bossMonsters || []), map.boss]) {
            if (typeof name === 'string' && words(name).some((word) => prefixNames.has(word))) species.add(name);
        }
    }
    return [...species].sort();
})();

test('전제: 이름에 접두어 낱말이 든 종이 데이터에 있다(이 계약이 공허하지 않다)', () => {
    assert.deepEqual(OVERLAPPING_SPECIES, ['거대 거북', '거대 사슴벌레', '거대 지네', '거대 지렁이', '고대 마법사', '고대 호수의 수호신']);
});

test('접두어 풀: 종 이름의 낱말과 같은 접두어만 빠진다', () => {
    const all = CONSTANTS.MONSTER_PREFIXES.map((prefix) => prefix.name);
    assert.deepEqual(getSpeciesPrefixPool('거대 사슴벌레').map((prefix) => prefix.name), all.filter((name) => name !== '거대'));
    assert.deepEqual(getSpeciesPrefixPool('고대 마법사').map((prefix) => prefix.name), all.filter((name) => name !== '고대'));
    assert.deepEqual(getSpeciesPrefixPool('숲의 정령').map((prefix) => prefix.name), all, '겹치지 않는 종은 풀 그대로');
    assert.deepEqual(getSpeciesPrefixPool(undefined).map((prefix) => prefix.name), all);
    for (const species of OVERLAPPING_SPECIES) {
        const pool = getSpeciesPrefixPool(species);
        assert.ok(pool.some((prefix) => prefix.isElite), `${species}: 정예 강제(eliteOnly · 프레스티지)가 뽑을 정예 접두어가 남는다`);
        assert.ok(pool.some((prefix) => !prefix.isElite), `${species}: 초반 구간이 뽑을 비정예 접두어가 남는다`);
    }
});

test('전 지역 × 세 조건(일반 · eliteOnly · 프레스티지 rank 3): 스폰된 이름에 같은 낱말이 두 번 나오지 않는다', () => {
    let spawned = 0;
    let overlapSpecies = 0;
    for (const [mapName] of HUNTING_MAPS) {
        for (const condition of Object.keys(CONDITIONS)) {
            for (let index = 0; index < SAMPLES; index += 1) {
                const { mStats, baseName } = spawnAt(mapName, condition, index);
                if (!mStats) continue;
                spawned += 1;
                if (OVERLAPPING_SPECIES.includes(baseName) && mStats.name !== baseName) overlapSpecies += 1;
                const list = words(mStats.name);
                assert.equal(new Set(list).size, list.length, `${mapName} · ${condition} · ${index}: ${mStats.name}`);
            }
        }
    }
    assert.ok(spawned > 40_000, `표본 ${spawned}`);
    assert.ok(overlapSpecies > 100, `겹치는 종이 접두어를 받은 스폰이 표본에 있어야 한다: ${overlapSpecies}`);
});

test('고정 · 장식 낱말(초반 정예 · 격노한)은 어느 종 이름에도 없다 — 그 장식은 풀 거르기를 거치지 않는다', () => {
    for (const map of Object.values(DB.MAPS)) {
        for (const name of [...(map.monsters || []), ...(map.bossMonsters || []), map.boss]) {
            if (typeof name !== 'string') continue;
            assert.ok(!words(name).includes(EARLY_ELITE_PREFIX_NAME), name);
            assert.ok(!words(name).includes('격노한'), name);
        }
    }
});

test('롤 수 불변 · 다른 종 불변 — 기능 이전 코드(ee2e47ea)에서 잰 스폰과 대조', () => {
    // 겹치던 스폰: 같은 난수열에서 이름만 풀에서 다음 접두어로 바뀌고 난수 호출 수는 같다.
    const beetle = spawnAt('고요한 숲', 'normal', 84);
    assert.equal(beetle.calls, 5);
    assert.equal(beetle.mStats.name, '광폭한 거대 사슴벌레', '이전: 거대 거대 사슴벌레 (hp 165)');
    assert.equal(beetle.mStats.hp, 143);
    const mage = spawnAt('고대 마법 탑', 'eliteOnly', 4);
    assert.equal(mage.calls, 2);
    assert.equal(mage.mStats.name, '재앙의 고대 마법사', '이전: 고대 고대 마법사 — 정예 강제 풀에 재앙의만 남는다');
    assert.equal(mage.mStats.hp, 2175);

    // 같은 지역의 다른 종: 이전과 값 · 난수 호출 수가 같다.
    const sprite = spawnAt('고요한 숲', 'normal', 4);
    assert.deepEqual(
        { name: sprite.mStats.name, hp: sprite.mStats.hp, atk: sprite.mStats.atk, exp: sprite.mStats.exp, calls: sprite.calls },
        { name: '날렵한 숲의 정령', hp: 112, atk: 20, exp: 22, calls: 5 },
    );
    const guardian = spawnAt('고대 마법 탑', 'eliteOnly', 1);
    assert.deepEqual(
        { name: guardian.mStats.name, hp: guardian.mStats.hp, atk: guardian.mStats.atk, exp: guardian.mStats.exp, calls: guardian.calls },
        { name: '고대 탑 수호자', hp: 1800, atk: 226, exp: 520, calls: 2 },
    );
});
