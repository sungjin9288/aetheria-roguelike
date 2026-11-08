// 적 레벨 폭 계약 (2026-11, 소유자 결정 "지역 레벨 ±4 · 강한 종은 폭 위쪽 · 접두어는 레벨 비례 — 지금 강함 유지").
//   ① 일반 조우는 지역 레벨 ± 폭(Lv1 아래로는 좁힌다) 안이고 지역 평균은 지역 레벨이다
//   ② 같은 지역에서 강한 종(생명 × 공격력 배율)은 약한 종보다 평균 레벨이 높다
//   ③ 레벨은 탐험 난수를 쓰지 않는다 — 탐험 수만 다르면 추첨 수 · 종 · 접두어가 같다
//   ④ 같은 탐험 · 지역 · 종이면 같은 레벨이다(리로드로 다시 굴릴 수 없다)
//   ⑤ 보스 · 이야기 전투 · 구역 보스 · 토벌 우두머리는 지역 레벨 그대로다
//   ⑤-2 심연은 레벨 폭 밖이다 — 층이 레벨을 정하고 지역 레벨을 남기지 않는다(전리품 등급이 층 레벨을 읽는다)
//   ⑥ 접두어 강함은 배율 그대로이고 화면 레벨 보너스는 그 배율과 같은 강함이다
//   ⑦ 전투 화면이 적 레벨을 그린다
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getEnemyLevelSpread, getEnemyRewardLevel, getPrefixLevelBonus, getSpeciesLevelBias, rollEnemyLevel } from '../src/utils/enemyLevel.ts';
import { isEncounterBoss } from '../src/utils/bossPresence.ts';
import { applyHuntChampion } from '../src/utils/huntContracts.ts';
import { HUNT_CONTRACTS } from '../src/data/huntContracts.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import StatusBar from '../src/components/StatusBar.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const noLog = { addLog: () => undefined };
const huntingMaps = Object.entries(DB.MAPS)
    .filter(([, map]) => typeof map.level === 'number' && map.type !== 'safe' && (map.monsters || []).length > 0);
const power = (name) => (DB.MONSTERS[name]?.hpMult || 1) * (DB.MONSTERS[name]?.atkMult || 1);
const playerAt = (loc, explores, extra = {}) => makePlayerFixture({ loc, level: 30, stats: { ...makePlayerFixture().stats, explores }, ...extra });

/** 기록용 rng — 호출 수를 센다. */
const countingRng = (values) => {
    let index = 0;
    const rng = () => values[index++ % values.length];
    return { rng, calls: () => index };
};

test('① 일반 조우는 지역 레벨 ± 폭 안이고 지역 평균은 지역 레벨이다', () => {
    // 소유자 결정 "지역 레벨÷5, 최대 ±4": 초반 지역은 고정이다(고정 ±4는 첫 1시간 사망이 6배였다, 원장 §157).
    assert.deepEqual([1, 3, 4, 5, 9, 10, 15, 19, 20, 30, 60].map(getEnemyLevelSpread), [0, 0, 0, 1, 1, 2, 3, 3, 4, 4, 4]);
    assert.equal(getEnemyLevelSpread(30), BALANCE.ENEMY_LEVEL_SPREAD);
    for (const [loc, map] of huntingMaps) {
        const spread = getEnemyLevelSpread(map.level);
        const pool = map.monsters.filter((name) => !isEncounterBoss(name, map));
        let sum = 0;
        let count = 0;
        for (const name of pool) {
            for (let explores = 0; explores < 400; explores += 1) {
                const level = rollEnemyLevel(map.level, name, map, playerAt(loc, explores));
                assert.ok(level >= Math.max(1, map.level - spread) && level <= map.level + spread, `${loc} ${name} ${level}`);
                sum += level;
                count += 1;
            }
        }
        assert.ok(Math.abs(sum / count - map.level) < 0.15, `${loc} 평균 ${sum / count} ≠ ${map.level}`);
    }
});

test('② 같은 지역에서 강한 종은 약한 종보다 평균 레벨이 높다 — 같은 강함은 같은 치우침', () => {
    for (const [loc, map] of huntingMaps) {
        const spread = getEnemyLevelSpread(map.level);
        const pool = map.monsters.filter((name) => !isEncounterBoss(name, map));
        for (const a of pool) {
            for (const b of pool) {
                const biasA = getSpeciesLevelBias(a, map, spread);
                const biasB = getSpeciesLevelBias(b, map, spread);
                if (power(a) > power(b)) assert.ok(biasA > biasB || spread < 2, `${loc}: ${a} ≤ ${b}`);
                if (power(a) === power(b)) assert.equal(biasA, biasB, `${loc}: ${a} · ${b}`);
            }
        }
    }
    // 실제 예: 호수의 신전에서 거대 거북(×1.15)은 다른 세 종보다 높게 나온다.
    const lake = DB.MAPS['호수의 신전'];
    assert.ok(getSpeciesLevelBias('거대 거북', lake, 4) > getSpeciesLevelBias('머맨', lake, 4));
});

test('③ 레벨은 탐험 난수를 쓰지 않는다 — 탐험 수만 바꾸면 추첨 수 · 종 · 접두어가 같다', () => {
    const map = DB.MAPS['몰락한 전초기지'];
    const sequences = [[0.1, 0.05, 0.3, 0.7], [0.9, 0.01, 0.6, 0.2], [0.42, 0.13, 0.13, 0.99]];
    for (const values of sequences) {
        const baseline = countingRng(values);
        const first = spawnEnemy(map, playerAt('몰락한 전초기지', 0), [], noLog, { rng: baseline.rng }).mStats;
        const levels = new Set([first.level]);
        for (let explores = 1; explores < 40; explores += 1) {
            const counted = countingRng(values);
            const enemy = spawnEnemy(map, playerAt('몰락한 전초기지', explores), [], noLog, { rng: counted.rng }).mStats;
            assert.equal(counted.calls(), baseline.calls());
            assert.equal(enemy.baseName, first.baseName);
            assert.equal(enemy.name.replace(enemy.baseName, ''), first.name.replace(first.baseName, ''));
            levels.add(enemy.level);
        }
        assert.ok(levels.size > 1, '탐험마다 레벨이 바뀐다');
    }
});

test('④ 같은 탐험 · 지역 · 종이면 같은 레벨이다', () => {
    const map = DB.MAPS['수정 동굴'];
    for (let explores = 0; explores < 50; explores += 1) {
        const a = rollEnemyLevel(map.level, '수정 골렘', map, playerAt('수정 동굴', explores));
        const b = rollEnemyLevel(map.level, '수정 골렘', map, playerAt('수정 동굴', explores));
        assert.equal(a, b);
    }
});

test('⑤ 보스 · 이야기 전투 · 구역 보스 · 토벌 우두머리는 지역 레벨 그대로다', () => {
    for (const [loc, map] of huntingMaps) {
        for (let explores = 0; explores < 20; explores += 1) {
            const player = playerAt(loc, explores);
            for (const name of map.monsters) {
                const story = spawnEnemy(map, player, [], noLog, { storyMonster: name, rng: () => 0.99 }).mStats;
                assert.equal(story.level, map.level, `${loc} 이야기 ${name}`);
            }
            for (const boss of map.monsters.filter((name) => isEncounterBoss(name, map))) {
                const enemy = spawnEnemy({ ...map, monsters: [boss] }, player, [], noLog, { rng: () => 0.99 }).mStats;
                assert.equal(enemy.level, map.level, `${loc} 보스 ${boss}`);
            }
        }
        if (typeof map.boss === 'string') {
            const player = playerAt(loc, 7, { stats: { ...makePlayerFixture().stats, explores: 7, areaBossDefeated: {} } });
            const area = spawnEnemy(map, player, [], noLog, { forceAreaBoss: true, rng: () => 0.99 }).mStats;
            if (area?.baseName === map.boss) assert.equal(area.level, map.level, `${loc} 구역 보스`);
        }
    }
    // 토벌 우두머리: 굴린 레벨과 무관하게 지역 레벨이고, 지역 레벨 개체에 건 우두머리와 같은 스탯이다.
    for (const contract of HUNT_CONTRACTS) {
        const map = DB.MAPS[contract.map];
        const species = map.monsters.find((name) => !isEncounterBoss(name, map));
        const at = (explores) => playerAt(contract.map, explores, {
            huntContracts: { [contract.map]: { stage: 2, progress: BALANCE.HUNT_CHAMPION_OMEN_KILLS, round: 1 } },
        });
        const fixed = spawnEnemy({ ...map, monsters: [species] }, at(0), [], noLog, { storyMonster: species, rng: () => 0.99 }).mStats;
        const expected = applyHuntChampion(fixed, at(0), map);
        assert.ok(expected.huntChampion, `${contract.map} 우두머리 판정`);
        let differed = false;
        for (let explores = 0; explores < 30; explores += 1) {
            const rolled = spawnEnemy({ ...map, monsters: [species] }, at(explores), [], noLog, { rng: () => 0.99 }).mStats;
            if (rolled.level !== map.level) differed = true;
            const champion = applyHuntChampion(rolled, at(explores), map);
            assert.equal(champion.level, map.level);
            // 레벨 곡선 비율로 옮기므로 내림 오차만 남는다(0.5% 안).
            assert.ok(Math.abs(champion.maxHp / expected.maxHp - 1) < 0.005, `${contract.map} 생명 ${champion.maxHp} ≠ ${expected.maxHp}`);
            assert.ok(Math.abs(champion.atk / expected.atk - 1) < 0.01, `${contract.map} 공격력 ${champion.atk} ≠ ${expected.atk}`);
        }
        assert.ok(differed, `${contract.map}: 굴린 레벨이 지역 레벨과 다른 경우를 실제로 거쳤다`);
    }
});

test('⑤-2 심연은 레벨 폭 밖이다 — 층이 레벨을 정하고 지역 레벨을 남기지 않는다', () => {
    const abyss = Object.entries(DB.MAPS).filter(([, map]) => map.level === 'infinite');
    assert.ok(abyss.length > 0, '심연 지역이 있다');
    for (const [loc, map] of abyss) {
        for (const abyssFloor of [0, 9, 40]) {
            const depth = abyssFloor + 1;
            const levels = new Set();
            for (let explores = 0; explores < 40; explores += 1) {
                const player = playerAt(loc, explores, { stats: { ...makePlayerFixture().stats, explores, abyssFloor } });
                const enemy = spawnEnemy(map, player, [], noLog, { rng: () => 0.99 }).mStats;
                if (!enemy) continue;
                levels.add(enemy.level);
                assert.equal(enemy.regionLevel, undefined, `${loc} ${abyssFloor}층 지역 레벨`);
                // exploreFlow가 층 레벨(50 + 층)로 다시 쓴 뒤 전리품 등급은 그 레벨을 읽는다
                assert.equal(getEnemyRewardLevel({ ...enemy, level: 50 + depth }), 50 + depth);
            }
            assert.deepEqual([...levels], [50 + Math.floor(depth / 2)], `${loc} ${abyssFloor}층 — 탐험 수로 흔들리지 않는다`);
        }
    }
});

test('⑥ 접두어 강함은 배율 그대로이고 레벨 보너스는 그 배율과 같은 강함이다', () => {
    const map = DB.MAPS['몰락한 전초기지'];
    const player = playerAt('몰락한 전초기지', 3);
    // 접두어 없음(PREFIX_CHANCE 위) vs 접두어(아래) — 같은 탐험이라 같은 레벨이다.
    const plain = spawnEnemy(map, player, [], noLog, { rng: () => 0.99 }).mStats;
    assert.equal(plain.levelBonus, undefined);
    let sawPrefix = false;
    for (const pick of [0.0, 0.2, 0.4, 0.6, 0.8, 0.95]) {
        const values = [0.0, 0.01, pick];
        let index = 0;
        const enemy = spawnEnemy({ ...map, monsters: [plain.baseName] }, player, [], noLog, {
            rng: () => (index < values.length ? values[index++] : 0.5),
        }).mStats;
        const prefix = CONSTANTS.MONSTER_PREFIXES.find((entry) => enemy.name.startsWith(`${entry.name} `));
        if (!prefix) continue;
        sawPrefix = true;
        const base = spawnEnemy({ ...map, monsters: [plain.baseName] }, player, [], noLog, { rng: () => 0.99 }).mStats;
        assert.equal(enemy.level, base.level, '접두어는 레벨 굴림을 바꾸지 않는다');
        assert.equal(enemy.maxHp, Math.floor(base.maxHp * prefix.mod));
        assert.equal(enemy.atk, Math.floor(base.atk * prefix.mod));
        assert.equal(enemy.levelBonus, getPrefixLevelBonus(enemy.level, prefix.mod));
    }
    assert.ok(sawPrefix);
    // 레벨 보너스 = (배율 − 1) × (레벨 + 오프셋), 레벨 1 아래로 내리지 않는다.
    assert.equal(getPrefixLevelBonus(10, 1.3), 4);
    assert.equal(getPrefixLevelBonus(50, 2.5), 80);
    assert.equal(getPrefixLevelBonus(10, 0.7), -4);
    assert.equal(getPrefixLevelBonus(1, 0.7), 0);
    // 화면 보너스는 전리품 · 보상 판정에 들어가지 않는다 — 읽는 곳은 스폰 · 표시뿐이다(부재 불변식). 표시는 적 카드(2026-11 A1에 StatusBar에서 분리).
    const srcRoot = path.resolve('src');
    const readers = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(entry.name) && readFileSync(full, 'utf8').includes('levelBonus')) readers.push(path.relative(srcRoot, full));
        }
    };
    walk(srcRoot);
    assert.deepEqual(readers.sort(), ['components/combat/EnemyStatus.tsx', 'types/monster.ts', 'utils/enemyLevel.ts', 'utils/exploreUtils.ts']);
});

test('⑦ 전투 화면은 적 레벨과 접두어 레벨 보너스를 그린다', () => {
    const player = makePlayerFixture({ name: '아리아', level: 12 });
    const render = (enemy) => renderStatic(createElement(StatusBar, { player, stats: calculateFullStats(player), enemy, enemyHitCrit: false }));
    const plain = render({ name: '수정 골렘', baseName: '수정 골렘', level: 13, hp: 100, maxHp: 100, atk: 10 });
    assert.ok(plain.includes('data-testid="enemy-level-badge"'));
    assert.ok(plain.includes(MSG.SHELL_ENEMY_LEVEL(13, 0)));
    assert.equal(MSG.SHELL_ENEMY_LEVEL(13, 0), '레벨 13');
    const prefixed = render({ name: '광폭한 수정 골렘', baseName: '수정 골렘', level: 13, levelBonus: 5, hp: 100, maxHp: 100, atk: 10 });
    assert.ok(prefixed.includes('레벨 18 (+5)'));
    assert.equal(MSG.SHELL_ENEMY_LEVEL(10, -4), '레벨 6 (−4)');
});
