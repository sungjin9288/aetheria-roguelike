import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { BOSS_MONSTERS } from '../src/data/monsters.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { getBountyTargets } from '../src/reducers/handlers/questHandlers.ts';
import { nonWalkingEntryOf } from '../src/utils/mapRouteGate.ts';

/**
 * 현상수배 대상 레벨 계약 (2026-10 Wave 62, 원장 §61.4 C12 — 소유자 결정 "고레벨 현상수배 대상").
 *
 * 게시판은 "현재 레벨 기준 토벌 의뢰"라고 말한다. 대상 생성기가 `boss` 필드가 있는 지역을 통째로 빼던 동안
 * (Wave 29 이후 `boss`는 구역 보스의 이름이라 52곳 중 28곳) Lv69부터 대상이 0이었고, 슬라임으로 떨어진 채 보상만
 * 레벨 비례로 커졌다. 이제 규칙은:
 *  - 대상 지역 = 걸어서 들어갈 수 있는(시즌 · 열쇠 지역 제외) 사냥 지역 중 진입 레벨이 [레벨 − BELOW, 레벨 + ABOVE]인 곳.
 *    창 안에 대상이 없으면 아래쪽 경계를 BELOW씩 넓힌다(결정론, 가장 가까운 레벨대).
 *  - 대상 = 그 지역의 일반 조우 몬스터 중 보스로 정산되지 않는 것(몬스터 자신 · 지역 `bossMonsters` · `BOSS_MONSTERS`).
 * 아래 오라클은 생성기 내부를 쓰지 않고 지도 데이터에서 직접 계산한다.
 */

const MAX_LEVEL = 99;
const BELOW = BALANCE.BOUNTY_LEVEL_WINDOW_BELOW;
const ABOVE = BALANCE.BOUNTY_LEVEL_WINDOW_ABOVE;

const entryLevelOf = (map) => (Array.isArray(map.level) ? Number(map.level[0]) : Number(map.level));

/** 걸어갈 수 있는 숫자 레벨 사냥 지역. */
const HUNTING_MAPS = Object.entries(DB.MAPS)
    .filter(([name, map]) => !nonWalkingEntryOf(name, map) && map.level !== 'infinite' && (map.monsters || []).length > 0)
    .map(([name, map]) => ({ name, map, entry: entryLevelOf(map) }));

const isBossIn = (monster, map) => Boolean(
    DB.MONSTERS[monster]?.isBoss
    || (map.bossMonsters || []).includes(monster)
    || BOSS_MONSTERS.includes(monster),
);

/** 오라클: 비어 있지 않은 가장 좁은 창과 그 창의 대상 집합. */
const oracle = (level) => {
    for (let below = BELOW; ; below += BELOW) {
        const min = Math.max(1, level - below);
        const max = level + ABOVE;
        const maps = HUNTING_MAPS.filter(({ entry }) => entry >= min && entry <= max);
        const targets = new Set(maps.flatMap(({ map }) => (map.monsters || []).filter((monster) => !isBossIn(monster, map))));
        if (targets.size > 0 || min <= 1) return { min, max, maps, targets };
    }
};

test('Lv1 ~ 99 모두 대상이 있고, 대상 집합이 오라클(가장 좁은 비어 있지 않은 창)과 같다', () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
        const targets = getBountyTargets(level);
        assert.ok(targets.length > 0, `Lv${level}: 대상이 있다`);
        const expected = oracle(level);
        assert.deepEqual(new Set(targets), expected.targets, `Lv${level}: 창 [${expected.min}, ${expected.max}]`);
    }
});

test('대상은 보스가 아니고, 걸어갈 수 있는 지역에서 창 안의 진입 레벨로 일반 조우한다', () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
        const { min, max } = oracle(level);
        for (const target of new Set(getBountyTargets(level))) {
            assert.ok(!DB.MONSTERS[target]?.isBoss, `Lv${level}: ${target}는 보스 프로필이 아니다`);
            assert.ok(!BOSS_MONSTERS.includes(target), `Lv${level}: ${target}는 BOSS_MONSTERS가 아니다`);
            const sources = HUNTING_MAPS.filter(({ map, entry }) => entry >= min && entry <= max
                && (map.monsters || []).includes(target) && !isBossIn(target, map));
            assert.ok(sources.length > 0, `Lv${level}: ${target}가 나오는 창 안 지역`);
        }
    }
});

test('기본 창이 비는 레벨에서만 넓히고, 슬라임으로 떨어지지 않는다', () => {
    const highestEntry = Math.max(...HUNTING_MAPS.map(({ entry }) => entry));
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
        const { min } = oracle(level);
        const baseMin = Math.max(1, level - BELOW);
        if (level - BELOW <= highestEntry) assert.equal(min, baseMin, `Lv${level}: 기본 창`);
        else assert.ok(min < baseMin, `Lv${level}: 넓힌 창`);
        if (level >= 69) assert.ok(!getBountyTargets(level).includes('슬라임'), `Lv${level}: 슬라임 폴백 없음`);
    }
    // 고치기 전 Lv69 ~ 99는 대상이 0이라 ['슬라임']이었다.
    assert.notDeepEqual(getBountyTargets(80), ['슬라임']);
});

test('구역 보스 이름이 있는 지역도 일반 몬스터는 대상이고, 그 지역의 보스 몬스터는 대상이 아니다', () => {
    const corridor = DB.MAPS['공허의 회랑'];
    assert.equal(typeof corridor.boss, 'string', '구역 보스 이름이 있는 지역');
    const targets = getBountyTargets(70);
    for (const monster of corridor.monsters) {
        if (isBossIn(monster, corridor)) assert.ok(!targets.includes(monster), `${monster}는 보스`);
        else assert.ok(targets.includes(monster), `${monster}는 대상`);
    }
    assert.ok(corridor.bossMonsters.includes('공허의 대행자'));
    assert.ok(!targets.includes('공허의 대행자'));
});

test('REQUEST_BOUNTY: Lv80 현상수배는 레벨 대 몬스터를 대상으로 발급된다', () => {
    const state = {
        ...structuredClone(INITIAL_STATE),
        gameState: GS.IDLE,
        player: { ...structuredClone(INITIAL_STATE.player), level: 80, loc: CONSTANTS.START_LOCATION, quests: [] },
    };
    for (const seed of [0, 0.3, 0.6, 0.99]) {
        const next = gameReducer(state, { type: AT.REQUEST_BOUNTY, payload: { seed, requestedAt: Date.now() } });
        const bounty = next.player.quests.find((quest) => quest.isBounty);
        assert.ok(bounty, `seed ${seed}: 발급`);
        assert.ok(oracle(80).targets.has(bounty.target), `seed ${seed}: ${bounty.target}`);
        assert.notEqual(bounty.target, '슬라임');
    }
});
