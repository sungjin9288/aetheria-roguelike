import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { FIRST_STORY_QUEST_ID, QUESTS } from '../src/data/quests.ts';
import { STORY_CHAPTERS } from '../src/data/storyChapters.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { buildContentReachabilityReport } from '../src/systems/contentReachability.ts';
import { advanceBossGauge, getAreaBossName, isAreaBossChallengeable } from '../src/utils/bossGauge.ts';
import { canBossAppearInMap, isEncounterBoss } from '../src/utils/bossPresence.ts';
import { getBossGaugeChip } from '../src/utils/expeditionHud.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { doesPushAdvanceBossGauge } from '../src/utils/postCombatChoice.ts';
import { getClaimableQuestEntries } from '../src/utils/questProgress.ts';
import StoryJournal from '../src/components/StoryJournal.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 74 — 소유자 결정 "중반 이야기 8장 · 최대 공백 약 7.6시간".
 *
 * 이야기가 Lv19 → 37(21h) · Lv37 → 48(38h) 동안 비어 있었다(원장 §75.1). 8장(207 ~ 214)을 Lv26 · 31 · 35 · 41 · 43 ·
 * 45 · 46 · 47에 넣었고, 각 장은 그 구간의 보스로 끝난다.
 *
 * 설계 중 찾은 결함: 구역 보스(지역 `boss` 문자열, 조우 풀 밖)는 여정마다 한 번만 나온다(`stats.areaBossDefeated`).
 * 임무를 받기 전에 잡았으면 그 여정 안에서는 임무를 끝낼 수 없었다 — 부가 임무 134 · 142 · 151이 이미 그랬고, 구역
 * 보스로 끝나는 이야기 장은 본편 사슬을 통째로 막는다. 이제 수락했고 끝나지 않은 처치 임무가 노리는 구역 보스는 다시
 * 도전할 수 있다(`isAreaBossChallengeable` — 게이지 · 도전 카드 · 출현 · 지도 · 원정 HUD · 이동 · 전투 후 선택이 같이 읽는다).
 */

const MIDGAME = [
    { id: 207, minLv: 26, loc: '용의 둥지', target: '화염의 군주' },
    { id: 208, minLv: 31, loc: '용의 둥지', target: '레드 드래곤' },
    { id: 209, minLv: 35, loc: '저주받은 묘지', target: '묘지기 네크론' },
    { id: 210, minLv: 41, loc: '빙하 심연', target: '아이스 드래곤' },
    { id: 211, minLv: 43, loc: '용암 지대', target: '화염 군주 이프리트' },
    { id: 212, minLv: 45, loc: '폭풍의 고원', target: '천둥새 제피로스' },
    { id: 213, minLv: 46, loc: '천공 정원', target: '타락한 세계수 수호자' },
    { id: 214, minLv: 47, loc: '암흑 성', target: '혈월의 뱀파이어 로드' },
];
const STORY_CHAIN = [80, 81, 82, 207, 208, 209, 84, 83, 210, 211, 212, 213, 214, 85, 86, 87];

const quest = (id) => {
    const found = QUESTS.find((entry) => entry.id === id);
    assert.ok(found, `임무 ${id}`);
    return found;
};

const buildChain = () => {
    const chain = [FIRST_STORY_QUEST_ID];
    for (;;) {
        const next = QUESTS.find((entry) => entry.prerequisiteQuestId === chain.at(-1) && String(entry.title).startsWith('[스토리]'));
        if (!next) return chain;
        chain.push(next.id);
    }
};

// ── 데이터 · 사슬 ──────────────────────────────────────────────────────────────────

test('[사슬] 본편은 16장이고 중반 8장이 82 → 84 · 83 → 85 사이에 Lv26 · 31 · 35 · 41 · 43 · 45 · 46 · 47로 들어간다', () => {
    assert.deepEqual(buildChain(), STORY_CHAIN);
    assert.deepEqual(STORY_CHAPTERS.map((chapter) => chapter.questId), STORY_CHAIN);
    for (const chapter of MIDGAME) {
        const entry = quest(chapter.id);
        assert.ok(entry.title.startsWith('[스토리]'), `${chapter.id}`);
        assert.deepEqual([entry.minLv, entry.location, entry.target], [chapter.minLv, chapter.loc, chapter.target], `${chapter.id}`);
        assert.ok(entry.desc.includes(chapter.target) && entry.desc.includes(chapter.loc), entry.desc);
    }
    // 84는 선행이 209(Lv35)가 되어 minLv도 35다 — 표시 레벨이 실제 수락 레벨과 같다(87과 같은 정렬).
    assert.equal(quest(84).minLv, 35);
    assert.equal(quest(84).prerequisiteQuestId, 209);
    assert.equal(quest(85).prerequisiteQuestId, 214);
});

test('[보스로 끝난다] 각 장의 목표는 그 지역에서 실제로 나오는 보스다 — 조우 풀의 보스이거나 그 지역의 구역 보스', () => {
    for (const chapter of MIDGAME) {
        const map = DB.MAPS[chapter.loc];
        const inPool = (map.monsters || []).includes(chapter.target);
        const isZoneBoss = getAreaBossName(map) === chapter.target;
        assert.ok(inPool || isZoneBoss, `${chapter.id}: ${chapter.target} @ ${chapter.loc}`);
        assert.ok(isEncounterBoss(chapter.target, map), `${chapter.id}: 보스로 정산된다`);
        // 구역 보스는 한 여정에 한 번 나온다 — 그 장은 1회다(Wave 64 계약과 같은 규칙).
        if (isZoneBoss) assert.equal(quest(chapter.id).goal, 1, `${chapter.id}`);
    }
});

test('[도달 비용] 사슬의 게이트는 줄지 않고, 중반 장은 받는 레벨에 목표 지역에 들어갈 수 있으며, 종장은 마왕성 게이트다', () => {
    const { cost } = buildContentReachabilityReport();
    const gateOf = new Map(cost.gates.quests.flatMap((bucket) => bucket.members.map((id) => [id, bucket.gateLevel])));
    const gates = STORY_CHAIN.map((id) => gateOf.get(id));
    assert.deepEqual(gates, [1, 5, 15, 26, 31, 35, 35, 35, 41, 43, 45, 46, 47, 48, 48, 48]);
    for (const chapter of MIDGAME) {
        assert.equal(gateOf.get(chapter.id), chapter.minLv, `${chapter.id}: 목표 게이트 = 받는 레벨`);
        assert.equal(cost.questGateDivergence.some((row) => row.quest === chapter.id), false, `${chapter.id}`);
    }
    const demonCastleGate = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성')).gateLevel;
    assert.equal(gates.at(-1), demonCastleGate);
    // 이전 사슬의 가장 긴 레벨 공백은 82 → 84(15 → 35)와 83 → 85(35 → 48)였다 — 지금은 11레벨(15 → 26) 이하다.
    const gaps = gates.slice(1).map((gate, index) => gate - gates[index]);
    assert.ok(Math.max(...gaps) <= 11, `레벨 공백 ${gaps}`);
});

test('[이야기 기록] 수령한 장만 본문을 보인다 — 새 장도 같다', () => {
    const claimed = [80, 81, 82, 207, 208];
    const html = renderStatic(createElement(StoryJournal, { claimedQuestIds: claimed }));
    for (const chapter of STORY_CHAPTERS) {
        assert.equal(html.includes(chapter.body), claimed.includes(chapter.questId), `${chapter.questId}`);
    }
});

// ── 구역 보스 재도전 ─────────────────────────────────────────────────────────────────

const LOC = '저주받은 묘지';
const BOSS = '묘지기 네크론';
const MAP = DB.MAPS[LOC];

const playerAt = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    level: 40,
    loc: LOC,
    relics: [],
    ...overrides,
    stats: {
        ...structuredClone(INITIAL_STATE.player.stats),
        claimedQuestIds: [80, 81, 82, 207, 208],
        areaBossDefeated: { [BOSS]: true },
        ...(overrides.stats || {}),
    },
});

/** 마을에서 실제 수락 전이(ACCEPT_QUEST)로 받고 그 지역으로 돌아간다 — 임무는 안전지대에서만 받는다. */
const accept = (player, questId) => {
    const state = { ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, player: { ...player, loc: CONSTANTS.START_LOCATION } };
    const next = gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId } });
    assert.ok(next.player.quests.some((entry) => entry.id === questId), `임무 ${questId} 수락`);
    return { ...next.player, loc: player.loc };
};

const spawnForced = (player) => spawnEnemy(MAP, player, [], { addLog() {} }, { forceAreaBoss: true, rng: () => 0.5 }).mStats;

test('[결함 재현 → 수정] 이미 쓰러뜨린 구역 보스는 임무가 없으면 다시 나오지 않고, 수락한 임무가 있으면 다시 도전할 수 있다', () => {
    const before = playerAt();
    assert.equal(isAreaBossChallengeable(MAP, before), false, '임무 없음: 여정당 한 번 규칙 그대로');
    assert.notEqual(spawnForced(before).baseName, BOSS, '임무 없음: 강제 도전도 구역 보스를 부르지 않는다');
    assert.equal(advanceBossGauge(before, MAP), before.stats, '임무 없음: 게이지가 오르지 않는다');

    const withQuest = accept(before, 209);
    assert.equal(isAreaBossChallengeable(MAP, withQuest), true);
    assert.equal(spawnForced(withQuest).baseName, BOSS, '도전 카드가 부르는 적은 그 구역 보스다');
    assert.ok(advanceBossGauge(withQuest, MAP).bossGauge[LOC] > 0, '게이지가 다시 오른다');
    // 같은 판정을 읽는 표면들 — 지도 배지 · 원정 HUD · 전투 후 "밀어붙인다".
    assert.equal(canBossAppearInMap(LOC, MAP, withQuest), true);
    assert.notEqual(getBossGaugeChip(withQuest), null);
    assert.equal(doesPushAdvanceBossGauge(withQuest, MAP), true);
    assert.equal(getBossGaugeChip(before), null);
    assert.equal(doesPushAdvanceBossGauge(before, MAP), false);
});

test('[실제 전투] 다시 부른 구역 보스를 쓰러뜨리면 장이 완료되고, 그 뒤로는 다시 나오지 않는다', () => {
    const player = accept(playerAt(), 209);
    const enemy = spawnForced(player);
    const next = gameReducer({
        ...structuredClone(INITIAL_STATE),
        player,
        gameState: GS.COMBAT,
        enemy: { ...enemy, hp: 1, pattern: { guardChance: 0, heavyChance: 0 } },
        combatTurn: 0,
        combatReceipt: null,
    }, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 7, now: 1_700_000_000_007 },
    });
    assert.notEqual(next.gameState, GS.COMBAT);
    assert.equal(next.player.quests.find((entry) => entry.id === 209)?.progress, 1);
    assert.ok(getClaimableQuestEntries(next.player).some((entry) => entry.id === 209));
    assert.equal(isAreaBossChallengeable(MAP, next.player), false, '목표에 닿은 임무는 보스를 다시 부르지 않는다');
});

test('[범위] 끝난 임무 · 수령한 임무 · 다른 지역의 임무는 구역 보스를 다시 부르지 않는다', () => {
    const done = playerAt({ quests: [{ id: 209, progress: 1 }] });
    assert.equal(isAreaBossChallengeable(MAP, done), false, '목표에 닿았지만 수령 전');
    const claimed = playerAt({ quests: [{ id: 209, progress: 0 }], stats: { claimedQuestIds: [80, 81, 82, 207, 208, 209] } });
    assert.equal(isAreaBossChallengeable(MAP, claimed), false, '이미 수령한 임무');
    const elsewhere = [{ id: 'x', target: BOSS, location: '용의 둥지', goal: 1 }];
    const bountyLike = playerAt({ quests: [{ id: 'x', progress: 0, isBounty: true, ...elsewhere[0] }] });
    assert.equal(isAreaBossChallengeable(MAP, bountyLike), false, '임무의 지역이 그 보스의 지역이 아니다');
    const anywhere = playerAt({ quests: [{ id: 'y', progress: 0, isBounty: true, target: BOSS, goal: 1 }] });
    assert.equal(isAreaBossChallengeable(MAP, anywhere), true, '지역이 없는 처치 임무는 어디서 잡아도 센다');
});

test('[같은 결함의 부가 임무] 134 기계 장군 · 142 타락한 세계수 영혼 · 151 종말의 기사도 수락하면 다시 도전할 수 있다', () => {
    for (const id of [134, 142, 151]) {
        const entry = quest(id);
        const map = DB.MAPS[entry.location];
        assert.equal(getAreaBossName(map), entry.target, `${id}`);
        const player = {
            ...structuredClone(INITIAL_STATE.player),
            level: 80,
            loc: entry.location,
            quests: [{ id, progress: 0 }],
            stats: { ...structuredClone(INITIAL_STATE.player.stats), areaBossDefeated: { [entry.target]: true } },
        };
        assert.equal(isAreaBossChallengeable(map, player), true, `${id}`);
        assert.equal(spawnEnemy(map, player, [], { addLog() {} }, { forceAreaBoss: true, rng: () => 0.5 }).mStats.baseName, entry.target, `${id}`);
        assert.equal(isAreaBossChallengeable(map, { ...player, quests: [] }), false, `${id}: 임무가 없으면 여정당 한 번`);
    }
});
