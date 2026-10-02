import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import AscensionScreen from '../src/components/AscensionScreen.tsx';
import MapNavigator from '../src/components/MapNavigator.tsx';
import SeasonPassPanel from '../src/components/tabs/SeasonPassPanel.tsx';
import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { getSeasonDef } from '../src/data/seasonPass.ts';
import { PRESTIGE_TITLES } from '../src/data/titles.ts';
import { handleVictoryOutcome } from '../src/hooks/combatActions/combatVictory.ts';
import { runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { applyDynamicDifficulty, calcPerformanceScore, getDifficultyMults } from '../src/systems/DifficultyManager.ts';
import { getMoveRecommendations, getQuestTracker } from '../src/utils/adventureGuide.ts';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import { canBossAppearInMap } from '../src/utils/bossPresence.ts';
import { getDiscoveryOdds } from '../src/utils/explorationPacing.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getExitBadges, getHighEventChanceThreshold, getMapBaseNarrativeEventChance } from '../src/utils/mapBadges.ts';
import { getActiveSeasonRewards, SEASON_MAX_XP } from '../src/utils/seasonPassPresentation.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 61 — 엔진은 맞고 화면 문구가 틀린 결함(B 판정)을 행동으로 고정한다.
 * F8 이벤트↑ 배지 · F9 보스 표시 · F14 난이도 안내 · F17 지도 띠 레벨 · K1 연속 처치 로그 ·
 * T1 시즌 칭호 보상 · T2 계승 새 칭호 · T3 강적의 길 설명 · G1 누적 처치 안내.
 * 오라클은 언제나 실제 엔진 경로다(spawnEnemy · runQuietRollAndCombat · 리듀서 · calculateFullStats).
 */

const MAP_ENTRIES = Object.entries(DB.MAPS);
const noop = () => {};

const seeded = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
};

// ── F8: '이벤트↑' 배지는 엔진이 굴리는 서사 이벤트 확률로 붙는다 ──────────────────────────

test('F8: 지역 고유 확률은 엔진의 서사 이벤트 확률(getDiscoveryOdds — 연속 보정 없는 플레이어)과 같다', () => {
    const player = makePlayerFixture({ level: 1 });
    for (const [name, map] of MAP_ENTRIES) {
        assert.equal(
            getMapBaseNarrativeEventChance(map),
            getDiscoveryOdds(player, map).narrativeEventChance,
            name,
        );
    }
});

test('F8: 배지는 실제 확률이 문턱 이상인 지역에만 붙고, 배지 지역의 확률은 배지 없는 지역의 확률 이상이다', () => {
    const player = makePlayerFixture({ level: 1 });
    const threshold = getHighEventChanceThreshold();
    const rows = MAP_ENTRIES.map(([name, map]) => ({
        name,
        chance: getMapBaseNarrativeEventChance(map),
        badged: getExitBadges(map, player, name).some((badge) => badge.id === 'highEvent'),
    }));

    const mismatched = rows.filter((row) => row.badged !== (row.chance >= threshold)).map((row) => row.name);
    assert.deepEqual(mismatched, [], '배지 = (실제 확률 ≥ 문턱)');

    const badged = rows.filter((row) => row.badged);
    const unbadged = rows.filter((row) => !row.badged);
    assert.ok(badged.length > 0 && unbadged.length > 0, '공허하지 않다 — 배지 지역과 배지 없는 지역이 모두 있다');
    const minBadged = Math.min(...badged.map((row) => row.chance));
    const maxUnbadged = Math.max(...unbadged.map((row) => row.chance));
    assert.ok(minBadged >= maxUnbadged, `배지 최저 ${minBadged} ≥ 배지 없음 최고 ${maxUnbadged}`);

    // 감사가 짚은 지역: 설정값으로는 배지가 없던 높은 확률 3곳 · 설정값으로 배지가 붙던 낮은 확률(보스 ×0.82) 지역.
    for (const name of ['어둠의 지하 감옥', '화염의 사원', '고대 마법 탑']) {
        assert.ok(rows.find((row) => row.name === name).badged, `${name}에 배지가 붙는다`);
    }
    for (const name of ['용의 둥지', '혼돈의 심연', '세계수 숲']) {
        assert.equal(rows.find((row) => row.name === name).badged, false, `${name}(5.74%)에는 배지가 없다`);
    }
});

// ── F9: 보스 표시는 이 플레이어에게 보스가 실제로 나올 수 있을 때만 ─────────────────────────

const AREA_BOSSES = MAP_ENTRIES
    .map(([, map]) => map.boss)
    .filter((boss) => typeof boss === 'string');
const ALL_DEFEATED = Object.fromEntries(AREA_BOSSES.map((boss) => [boss, true]));

const basePlayer = (overrides = {}) => makePlayerFixture({ level: 1, quests: [], relics: [], ...overrides });
const PLAYER_STATES = {
    fresh: basePlayer(),
    areaBossesDefeated: basePlayer({ stats: { ...structuredClone(INITIAL_STATE.player.stats), areaBossDefeated: ALL_DEFEATED } }),
    hiddenUnlocked: basePlayer({
        level: 45,
        job: '시간술사',
        eventChainProgress: { last_hero: 3 },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), abyssFloor: 100 },
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 10 },
    }),
    // 해금 문턱 바로 아래 — 시간술사 Lv39 · 최후의 영웅 2단계 · 심연 99층 · 계승 9.
    justBelowUnlock: basePlayer({
        level: 39,
        job: '시간술사',
        eventChainProgress: { last_hero: 2 },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), abyssFloor: 99, areaBossDefeated: ALL_DEFEATED },
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 9 },
    }),
    everythingDone: basePlayer({
        level: 45,
        job: '시간술사',
        eventChainProgress: { last_hero: 3 },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), abyssFloor: 100, areaBossDefeated: ALL_DEFEATED },
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 10 },
    }),
};

const SPAWN_ROLLS = 400;
const ABYSS_FLOORS_AHEAD = 150;

/** 오라클 — 실제 스폰 경로만 본다: 조우 풀(시드 고정 400회) · 구역 보스 게이지 도전 · 심연 층 진행. */
const bossSpawnOracle = (mapName, map, state) => {
    const player = { ...state, loc: mapName };
    const rng = seeded(0x61f9);
    for (let i = 0; i < SPAWN_ROLLS; i += 1) {
        if (spawnEnemy(map, player, [], { addLog: noop }, { rng }).mStats?.isBoss) return true;
    }
    if (typeof map.boss === 'string') {
        const forced = spawnEnemy(map, player, [], { addLog: noop }, { forceAreaBoss: true, rng });
        if (forced.baseName === map.boss && forced.mStats?.isBoss) return true;
    }
    if (map.level === 'infinite') {
        const start = player.stats?.abyssFloor || 0;
        for (let cleared = start; cleared < start + ABYSS_FLOORS_AHEAD; cleared += 1) {
            let enemy = null;
            runQuietRollAndCombat({ ...player, stats: { ...player.stats, abyssFloor: cleared } }, map, {
                dispatch: (action) => { if (action.type === AT.SET_ENEMY) enemy = action.payload; },
                addLog: noop,
                getFullStats: () => ({}),
                commitExploreOutcome: noop,
                rng: () => 0.999,
            });
            if (enemy?.isBoss) return true;
        }
    }
    return false;
};

const ORACLE = new Map();
const oracleFor = (stateName, mapName) => {
    const key = `${stateName}|${mapName}`;
    if (!ORACLE.has(key)) ORACLE.set(key, bossSpawnOracle(mapName, DB.MAPS[mapName], PLAYER_STATES[stateName]));
    return ORACLE.get(key);
};

test('F9: canBossAppearInMap은 실제 스폰 오라클과 지역 전수 × 플레이어 상태 5종에서 같다', () => {
    const mismatched = [];
    for (const stateName of Object.keys(PLAYER_STATES)) {
        let positives = 0;
        for (const [mapName, map] of MAP_ENTRIES) {
            const expected = oracleFor(stateName, mapName);
            if (expected) positives += 1;
            if (canBossAppearInMap(mapName, map, PLAYER_STATES[stateName]) !== expected) {
                mismatched.push(`${stateName} · ${mapName}: 오라클 ${expected}`);
            }
        }
        assert.ok(positives > 0 && positives < MAP_ENTRIES.length, `${stateName}: 공허하지 않다(${positives})`);
    }
    assert.deepEqual(mismatched, []);
});

test('F9: 감사가 짚은 지역 — 숨은 보스는 해금 뒤에만, 구역 보스는 쓰러뜨리기 전에만, 심연은 층 보스가 남은 동안', () => {
    const can = (stateName, mapName) => canBossAppearInMap(mapName, DB.MAPS[mapName], PLAYER_STATES[stateName]);
    for (const mapName of ['지하 미궁', '공중 신전', '금지된 도서관']) {
        assert.equal(can('fresh', mapName), false, `${mapName}: 해금 전`);
        assert.equal(can('justBelowUnlock', mapName), false, `${mapName}: 문턱 바로 아래`);
        assert.equal(can('hiddenUnlocked', mapName), true, `${mapName}: 해금 뒤`);
    }
    assert.equal(can('fresh', '신성한 호수'), true);
    assert.equal(can('areaBossesDefeated', '신성한 호수'), false, '구역 보스를 쓰러뜨리면 보스가 없다');
    assert.equal(can('areaBossesDefeated', '혼돈의 심연'), true, '심연 층 보스가 남아 있다');
    assert.equal(can('everythingDone', '혼돈의 심연'), false, '100층 뒤에는 층 보스가 없다');
    assert.equal(can('fresh', '봄의 정원'), true, '`boss` 필드가 없어도 조우 풀의 보스(봄의 여왕)는 보스다');
});

test('F9: 출구 배지의 보스 = 판정 (지역 전수 × 상태 5종)', () => {
    const mismatched = [];
    for (const stateName of Object.keys(PLAYER_STATES)) {
        for (const [mapName, map] of MAP_ENTRIES) {
            const badges = getExitBadges(map, PLAYER_STATES[stateName], mapName);
            if (badges.some((badge) => badge.id === 'boss') !== oracleFor(stateName, mapName)) mismatched.push(`${stateName} · ${mapName}`);
            if (badges.some((badge) => badge.id === 'bossGauge') && !badges.some((badge) => badge.id === 'boss')) {
                mismatched.push(`${stateName} · ${mapName}: 게이지 배지만 남았다`);
            }
        }
    }
    assert.deepEqual(mismatched, []);
});

const forecastValues = (html) => Object.fromEntries(
    [...html.matchAll(/aether-type-label[^>]*>(위험|예상)<\/div><div[^>]*>([^<]*)</g)].map((match) => [match[1], match[2]]),
);
const topologyBossNodes = (html) => Object.fromEntries(
    [...html.matchAll(/aria-label="([^",]+)[^"]*" class="aether-route-topology-node([^"]*)"/g)]
        .map((match) => [match[1], /\bis-boss\b/.test(match[2])]),
);

test('F9: 지도 선택 카드의 위험 · 예상과 경로 노드의 보스 표시 = 판정 (지역 전수 × 상태 3종)', () => {
    const mismatched = [];
    for (const stateName of ['fresh', 'areaBossesDefeated', 'everythingDone']) {
        for (const [mapName, map] of MAP_ENTRIES) {
            // 레벨은 상태 그대로 둔다 — 숨은 보스 해금(시간술사 Lv40)이 레벨을 읽는다.
            const player = { ...PLAYER_STATES[stateName], loc: mapName };
            const html = renderStatic(createElement(MapNavigator, { player, grave: undefined, stats: null }));
            const forecast = forecastValues(html);
            assert.ok(forecast['위험'] && forecast['예상'], `${mapName}: 선택 카드 = 현재 위치`);
            if (map.type !== 'safe') {
                const expected = oracleFor(stateName, mapName);
                if ((forecast['위험'] === '보스') !== expected) mismatched.push(`${stateName} · ${mapName} 위험 ${forecast['위험']}`);
                if ((forecast['예상'] === '보스 교전') !== expected) mismatched.push(`${stateName} · ${mapName} 예상 ${forecast['예상']}`);
            }
            for (const [exitName, isBoss] of Object.entries(topologyBossNodes(html))) {
                if (!DB.MAPS[exitName]) continue;
                if (isBoss !== oracleFor(stateName, exitName)) mismatched.push(`${stateName} · ${mapName} → ${exitName} 노드`);
            }
        }
    }
    assert.deepEqual(mismatched, []);
});

const BOSS_APPROACHES = new Set(['보스 진입', '정비 후 진입']);
const BOSS_MOODS = new Set(['보스 권역', '보스 전조']);

test('F9: 모험 가이드의 이동 추천(배지 · 경로 계획 · 탐험 전망) = 판정 (지역 전수 × 상태 5종)', () => {
    const mismatched = [];
    for (const stateName of Object.keys(PLAYER_STATES)) {
        for (const [mapName, map] of MAP_ENTRIES) {
            const player = { ...PLAYER_STATES[stateName], loc: mapName, hp: 500, maxHp: 500, mp: 200, maxMp: 200 };
            for (const route of getMoveRecommendations(player, null, map, DB.MAPS)) {
                if (DB.MAPS[route.name].type === 'safe') continue;
                const expected = oracleFor(stateName, route.name);
                const state = route.chips.find((chip) => chip.label === 'STATE')?.value;
                if (BOSS_APPROACHES.has(route.routePlan.approach) !== expected) mismatched.push(`${stateName} · ${route.name} 경로 계획`);
                if (BOSS_MOODS.has(state) !== expected) mismatched.push(`${stateName} · ${route.name} 전망 ${state}`);
                if (route.badge === '보스' && !expected) mismatched.push(`${stateName} · ${route.name} 배지`);
            }
        }
    }
    assert.deepEqual(mismatched, []);
});

// ── F14: 난이도 하향 안내는 골드 · 경험치 감소도 말한다 ───────────────────────────────────

// 승리의 남은 생명 0은 점수 계산에서 0.5로 읽힌다(`hpRatio || 0.5`) — 위기 픽스처는 0.01을 쓴다.
const battleHistory = (wins, deaths) => [
    ...Array.from({ length: wins }, () => ({ result: 'win', hpRatio: 0.01 })),
    ...Array.from({ length: deaths }, () => ({ result: 'death', hpRatio: 0 })),
];

test('F14: 위기 · 열세 안내는 실제로 줄어드는 골드 · 경험치를 함께 말한다', () => {
    const cases = [
        { label: MSG.DIFFICULTY_LABEL_CRISIS, message: MSG.DIFFICULTY_GM_CRISIS, battles: battleHistory(1, 9) },
        { label: MSG.DIFFICULTY_LABEL_DISADVANTAGE, message: MSG.DIFFICULTY_GM_DISADVANTAGE, battles: battleHistory(0, 10) },
    ];
    for (const { label, message, battles } of cases) {
        const player = makePlayerFixture({ level: 30, stats: { ...structuredClone(INITIAL_STATE.player.stats), recentBattles: battles } });
        assert.equal(getDifficultyMults(calcPerformanceScore(player)).label, label, `픽스처가 ${label} 단계다`);
        const enemy = { name: '적', baseName: '적', hp: 1000, maxHp: 1000, atk: 1000, def: 10, exp: 1000, gold: 1000 };
        const logs = [];
        const { mStats } = applyDynamicDifficulty(enemy, player, (type, text) => logs.push(text));
        assert.deepEqual(logs, [message]);
        assert.ok(mStats.gold < enemy.gold && mStats.exp < enemy.exp, `${label}: 골드 · 경험치가 실제로 줄어든다`);
        assert.ok(message.includes('골드') && message.includes('경험치'), `${label}: 안내가 골드 · 경험치 감소를 말한다`);
    }
});

// ── F17: 지도 띠의 레벨 범위는 그 띠의 실제 지역이다 ─────────────────────────────────────

test('F17: 지도 목록 띠마다 레벨 범위 = 그 띠에 놓인 지역 레벨의 최소 ~ 최대 (변방 = 1~15, 여행자의 쉼터 포함)', () => {
    const html = renderStatic(createElement(MapNavigator, {
        player: makePlayerFixture({ level: 20, loc: '시작의 마을' }),
        grave: undefined,
        stats: null,
    }));
    const list = html.slice(html.indexOf('data-testid="map-world-list"'));
    const sections = list.split('<section').slice(1);
    assert.equal(sections.length, 5);
    for (const section of sections) {
        const label = section.match(/data-testid="map-band-level">([^<]*)</)[1];
        const levels = [...section.matchAll(/>레벨 (\d+)</g)].map((match) => Number(match[1]));
        const hasAbyss = />심연</.test(section);
        assert.ok(levels.length > 0, label);
        const min = Math.min(...levels);
        const max = Math.max(...levels);
        assert.equal(label, hasAbyss ? MSG.MAP_BAND_LEVEL_FROM(min) : MSG.MAP_BAND_LEVEL_RANGE(min, max));
    }
    const frontier = sections[0];
    assert.ok(frontier.includes('>여행자의 쉼터<'), '쉼터는 변방 띠에 있다');
    assert.equal(frontier.match(/data-testid="map-band-level">([^<]*)</)[1], MSG.MAP_BAND_LEVEL_RANGE(1, 15));
});

// ── K1: 연속 처치 로그는 치명타 보너스도 말한다 ───────────────────────────────────────

test('K1: 연속 처치 단계 로그의 치명타 확률은 실제 능력치(calculateFullStats)가 오르는 값이다', () => {
    for (const [tierIndex, tier] of BALANCE.KILL_STREAK_TIERS.entries()) {
        const player = makePlayerFixture({
            level: 10, loc: '고요한 숲', quests: [], killStreak: tier - 1, lastKillAt: 9_000,
        });
        const deadEnemy = { name: '슬라임', baseName: '슬라임', level: 1, hp: 0, maxHp: 50, atk: 1, def: 0, exp: 0, gold: 0, isBoss: false };
        const logs = [];
        handleVictoryOutcome({
            playerAfterCombat: player,
            deadEnemy,
            stats: calculateFullStats(player),
            dispatch: noop,
            addLog: (type, text) => logs.push(text),
            addStoryLog: noop,
            emitUnlockedTitles: noop,
            liveConfig: { eventMultiplier: 1 },
            rng: seeded(tierIndex + 1),
            now: () => 10_000,
        });
        // 단계 보너스는 누적이 아니라 그 단계의 값이다(공격력 문구와 같다) — 연속 처치가 없을 때와 비교한다.
        const critGain = calculateFullStats({ ...player, killStreak: tier }).critChance
            - calculateFullStats({ ...player, killStreak: 0 }).critChance;
        assert.ok(critGain > 0, `${tier}연속: 치명타가 실제로 오른다`);
        const expected = MSG.KILL_STREAK_BONUS(
            tier,
            Math.round(BALANCE.KILL_STREAK_ATK_BONUS[tierIndex] * 100),
            Math.round(critGain * 100),
        );
        assert.ok(logs.includes(expected), `${tier}연속 로그: ${expected}`);
    }
});

// ── T1: 시즌 보상의 칭호는 이미 가진 칭호면 '보유 중' ──────────────────────────────────

const seasonPlayer = (ordinal, titles) => makePlayerFixture({
    titles,
    seasonPass: { xp: SEASON_MAX_XP, tier: 30, claimed: [], isPremium: true, seasonId: getSeasonDef(ordinal).id, ordinal },
});
const titleRewards = (player) => getActiveSeasonRewards(player.seasonPass)
    .flatMap((row) => [row.free, row.premium].filter((reward) => reward?.title).map((reward) => ({ tier: row.tier, title: reward.title })));

test('T1: 이미 가진 시즌 칭호는 보상 줄에서 보유 중으로 보이고, 수령해도 칭호가 지급되지 않는다', () => {
    const probe = titleRewards(seasonPlayer(2, []));
    assert.ok(probe.length >= 3, '시즌 2에도 칭호 보상 단계가 있다');
    const ownedTitles = [...new Set(probe.map((reward) => reward.title))];
    const player = seasonPlayer(2, ownedTitles);
    const html = renderStatic(createElement(SeasonPassPanel, { player, dispatch: noop }));
    for (const { tier, title } of probe) {
        const owned = MSG.SEASON_REWARD_TITLE_OWNED(title);
        assert.ok(html.includes(owned), `${title}: 보유 중 표시`);
        assert.ok(!html.split(owned).join('').includes(MSG.SEASON_REWARD_TITLE(title)), `${title}: 받을 수 있는 칭호처럼 보이지 않는다`);
        const state = { ...structuredClone(INITIAL_STATE), player };
        const claimed = gameReducer(state, { type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
        assert.notEqual(claimed, state, `${tier}단계 수령이 실제로 처리된다`);
        assert.deepEqual(claimed.player.titles, player.titles, `${tier}단계: 가진 칭호는 다시 지급되지 않는다`);
    }
});

test('T1 대조군: 아직 없는 시즌 칭호는 그대로 보상으로 보이고 수령하면 지급된다', () => {
    const player = seasonPlayer(1, []);
    const html = renderStatic(createElement(SeasonPassPanel, { player, dispatch: noop }));
    for (const { tier, title } of titleRewards(player)) {
        assert.ok(html.includes(MSG.SEASON_REWARD_TITLE(title)), title);
        assert.ok(!html.includes(MSG.SEASON_REWARD_TITLE_OWNED(title)), title);
        const claimed = gameReducer({ ...structuredClone(INITIAL_STATE), player }, { type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
        assert.ok(claimed.player.titles.includes(title), `${tier}단계 수령이 ${title}을 지급한다`);
    }
});

// ── T2: 계승은 아직 없는 칭호만 새 칭호라 알린다 ─────────────────────────────────────

const ascensionState = (rank, titles) => {
    const state = structuredClone(INITIAL_STATE);
    state.gameState = GS.ASCENSION;
    state.player = {
        ...state.player,
        name: '계승자',
        quests: [],
        titles,
        meta: { ...state.player.meta, prestigeRank: rank },
    };
    return state;
};
const ascend = (state) => gameReducer(state, {
    type: AT.ASCEND,
    payload: {
        expectedPrestigeRank: state.player.meta.prestigeRank,
        sourceReceiptKey: state.player.meta.endgame?.lastEndgameReceiptKey ?? null,
        seed: 7,
    },
});

test('T2: 계승 11단계 이상은 이미 가진 칭호를 새 칭호라 알리지 않는다 (로그 · 계승 화면)', () => {
    const state = ascensionState(10, [...PRESTIGE_TITLES]);
    const outcome = getAscensionOutcome(state.player.meta);
    assert.equal(outcome.nextRank, 11);
    assert.ok(state.player.titles.includes(outcome.title), '11단계 칭호는 이미 가진 칭호다');

    const next = ascend(state);
    assert.equal(next.player.meta.prestigeRank, 11, '계승이 실제로 진행된다');
    const texts = next.logs.map((log) => log.text);
    assert.ok(texts.includes(MSG.ASCEND_DONE(11, null)));
    assert.ok(!texts.includes(MSG.ASCEND_DONE(11, outcome.title)), '새 칭호 알림 없음');

    const html = renderStatic(createElement(AscensionScreen, { player: state.player, actions: new Proxy({}, { get: () => noop }) }));
    assert.ok(html.includes(MSG.ASCEND_TITLE_OWNED_LABEL));
    assert.ok(!html.includes(`>${MSG.ASCEND_NEW_TITLE_LABEL}<`));
});

test('T2 대조군: 처음 받는 계승 칭호는 새 칭호로 알린다', () => {
    for (const rank of [0, 9]) {
        const state = ascensionState(rank, []);
        const outcome = getAscensionOutcome(state.player.meta);
        const next = ascend(state);
        assert.ok(next.logs.map((log) => log.text).includes(MSG.ASCEND_DONE(rank + 1, outcome.title)), `${rank + 1}단계`);
        const html = renderStatic(createElement(AscensionScreen, { player: state.player, actions: new Proxy({}, { get: () => noop }) }));
        assert.ok(html.includes(`>${MSG.ASCEND_NEW_TITLE_LABEL}<`), `${rank + 1}단계 화면`);
    }
});

// ── T3: 강적의 길은 보스를 정예로 만들지 않는다 — 설명도 그렇게 말한다 ──────────────────────

test('T3: 강적의 길 설명은 보스 제외를 말하고, 실제 스폰은 보스가 아닌 적을 모두 정예로 · 보스는 강제하지 않는다', () => {
    const modifier = BALANCE.CHALLENGE_MODIFIERS.find((entry) => entry.id === 'eliteOnly');
    assert.ok(modifier.desc.includes('보스를 제외'), modifier.desc);

    let bosses = 0;
    let plainBosses = 0;
    let normals = 0;
    for (const mapName of ['용의 둥지', '에테르 관문', '마왕성', '고요한 숲']) {
        const player = makePlayerFixture({ loc: mapName, level: 80, quests: [], challengeModifiers: ['eliteOnly'] });
        const rng = seeded(0x7e3);
        for (let i = 0; i < 200; i += 1) {
            const { mStats } = spawnEnemy(DB.MAPS[mapName], player, [], { addLog: noop }, { rng });
            if (mStats.isBoss) {
                // 보스는 강제되지 않는다 — 일반 접두어 추첨(BALANCE.PREFIX_CHANCE)으로만 가끔 정예가 된다.
                bosses += 1;
                if (!mStats.isElite) plainBosses += 1;
            } else {
                normals += 1;
                assert.equal(mStats.isElite, true, `${mapName} ${mStats.name}: 보스가 아닌 적은 정예다`);
            }
        }
    }
    assert.ok(bosses > 0 && normals > 0, '보스와 일반 적이 모두 표본에 있다');
    assert.ok(plainBosses / bosses > 0.5, `보스 대부분은 정예가 아니다(${plainBosses}/${bosses}) — 강적의 길이 보스를 정예로 만들지 않는다`);
});

// ── G1: 누적 처치 안내는 보스 처치도 센다 ───────────────────────────────────────────

test('G1: 누적 처치 임무의 다음 단계는 일반 몬스터라 하지 않는다 — 보스 처치도 kills를 올린다', () => {
    const tracker = getQuestTracker({ level: 25, quests: [{ id: 91, progress: 137 }], stats: { kills: 137, bossKills: 4 } });
    assert.equal(tracker.nextStep, MSG.QUEST_NEXT_STEP_KILLS(363));
    assert.ok(!tracker.nextStep.includes('일반'));

    const bossName = '고대 호수의 수호신';
    const player = makePlayerFixture({
        level: 20, loc: '신성한 호수', quests: [],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), kills: 10, bossKills: 0, areaBossDefeated: {} },
    });
    let current = player;
    handleVictoryOutcome({
        playerAfterCombat: player,
        deadEnemy: { ...DB.MONSTERS[bossName], name: bossName, baseName: bossName, isBoss: true, hp: 0, maxHp: 500, exp: 0, gold: 0, drop: [] },
        stats: calculateFullStats(player),
        dispatch: (action) => {
            if (action.type !== AT.SET_PLAYER) return;
            current = { ...current, ...(typeof action.payload === 'function' ? action.payload(current) : action.payload) };
        },
        addLog: noop,
        addStoryLog: noop,
        emitUnlockedTitles: noop,
        liveConfig: { eventMultiplier: 1 },
        rng: seeded(3),
        now: () => 10_000,
    });
    assert.equal(current.stats.bossKills, 1);
    assert.equal(current.stats.kills, 11, '보스 처치도 누적 처치(kills)를 올린다');
});
