import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { QUESTS } from '../src/data/quests.ts';
import { PRESTIGE_TITLES, TITLES, TITLE_PASSIVES } from '../src/data/titles.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { checkTitles } from '../src/utils/gameUtils.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getClaimableQuestEntries, syncQuestProgress } from '../src/utils/questProgress.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

/**
 * 임무 보상 약속 계약 (2026-10 Wave 62, 원장 §61.4 C9 · C10 — 소유자 결정 "규칙은 구현").
 *
 * C9 — 임무 154 "종말의 기사 3회 처치": 종말의 기사는 종말의 전장의 구역 보스라 한 여정에 한 번만 나오고(첫 처치가
 *   `areaBossDefeated`를 세운다), 임무는 여정이 끝나면 사라진다 — 진행도가 1/3을 넘을 수 없었다. 소유자 결정은 목표 1회.
 * C10 — 임무 200 "50번 탐색 후 새 칭호 획득": 보상에 칭호가 없었다. 소유자 결정은 칭호를 준다 — 새 칭호 '대륙의 여행자'.
 *   그 칭호는 임무 수령으로만 열린다(다른 조건으로 자동 해금되는 같은 이름의 칭호가 없다).
 */

const QUEST_154 = QUESTS.find((quest) => quest.id === 154);
const QUEST_200 = QUESTS.find((quest) => quest.id === 200);
const NEW_TITLE = '대륙의 여행자';
const BOSS_FIELD = '종말의 전장';

const baseState = (playerOverrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.IDLE,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        loc: CONSTANTS.START_LOCATION,
        ...playerOverrides,
    },
});

const accept = (state, questId) => {
    const next = gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId } });
    assert.ok(next.player.quests.some((quest) => quest.id === questId), `임무 ${questId} 수락`);
    return next;
};

const claim = (state, questId) => gameReducer(state, { type: AT.CLAIM_QUEST_REWARD, payload: { questId } });

// ── C9 ──────────────────────────────────────────────────────────────────

test('C9: 임무 154의 목표는 1회이고 설명이 목표 횟수와 어긋나지 않는다', () => {
    assert.ok(QUEST_154);
    assert.equal(QUEST_154.goal, 1);
    assert.equal(QUEST_154.target, '종말의 기사');
    assert.equal(QUEST_154.location, BOSS_FIELD);
    assert.ok(QUEST_154.desc.includes(QUEST_154.target));
    const counted = QUEST_154.desc.match(/(\d+)\s*회/);
    assert.ok(!counted || Number(counted[1]) === QUEST_154.goal, `설명의 횟수(${counted?.[1]})가 목표와 같아야 한다`);
    assert.equal(QUEST_154.reward.title, '종말의 정복자');
});

test('C9: 종말의 기사는 구역 보스다 — 한 여정에 한 번만 나오므로 목표가 1을 넘으면 완료할 수 없다', () => {
    const map = DB.MAPS[BOSS_FIELD];
    assert.equal(map.boss, QUEST_154.target, '종말의 전장의 구역 보스');
    assert.ok(!(map.monsters || []).includes(QUEST_154.target), '일반 조우에는 없다');
    const player = { ...structuredClone(INITIAL_STATE.player), level: 75, loc: BOSS_FIELD };
    const first = spawnEnemy(map, player, [], { addLog() {} }, { forceAreaBoss: true, rng: () => 0.5 }).mStats;
    assert.equal(first.baseName, QUEST_154.target, '처치 전에는 도전으로 나온다');
    const defeated = { ...player, stats: { ...player.stats, areaBossDefeated: { [QUEST_154.target]: true } } };
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
        const again = spawnEnemy(map, defeated, [], { addLog() {} }, { forceAreaBoss: true, rng: () => roll }).mStats;
        assert.notEqual(again.baseName, QUEST_154.target, '같은 여정에서 다시 나오지 않는다');
    }
});

test('C9: 한 여정 안에서 수락 → 종말의 기사 처치(실제 전투 전이) → 완료 → 수령(칭호)까지 이어진다', () => {
    let state = accept(baseState({ level: 75 }), 154);
    assert.equal(state.player.quests.find((quest) => quest.id === 154).progress, 0);

    // 종말의 전장에서 구역 보스 도전 — 스폰은 실제 spawnEnemy, 처치는 실제 전투 1턴 리듀서 전이.
    const player = { ...state.player, loc: BOSS_FIELD };
    const boss = spawnEnemy(DB.MAPS[BOSS_FIELD], player, [], { addLog() {} }, { forceAreaBoss: true, rng: () => 0.5 }).mStats;
    assert.equal(boss.baseName, QUEST_154.target);
    state = {
        ...state,
        player,
        gameState: GS.COMBAT,
        enemy: { ...boss, hp: 1, pattern: { guardChance: 0, heavyChance: 0 } },
        combatTurn: 0,
        combatReceipt: null,
    };
    state = gameReducer(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 3, now: 1_700_000_000_000 },
    });
    assert.notEqual(state.gameState, GS.COMBAT, '처치로 전투가 끝난다');
    assert.equal(state.player.stats.areaBossDefeated?.[QUEST_154.target], true);
    const progress = state.player.quests.find((quest) => quest.id === 154)?.progress;
    assert.equal(progress, 1);
    assert.ok(getClaimableQuestEntries(state.player).some((entry) => entry.id === 154), '수령 가능');

    const claimed = claim({ ...state, gameState: GS.IDLE, player: { ...state.player, loc: CONSTANTS.START_LOCATION } }, 154);
    assert.ok(claimed.player.titles.includes('종말의 정복자'));
    assert.ok(claimed.player.stats.claimedQuestIds.includes(154));
});

// ── C10 ─────────────────────────────────────────────────────────────────

test('C10: "새 칭호 획득"을 말하는 임무는 칭호를 주고, 임무 보상 칭호는 모두 정의 · 효과를 가진다', () => {
    assert.equal(QUEST_200.reward.title, NEW_TITLE);
    const promising = QUESTS.filter((quest) => (quest.desc || '').includes('칭호'));
    assert.ok(promising.some((quest) => quest.id === 200));
    for (const quest of promising) assert.ok(quest.reward?.title, `임무 ${quest.id}: 설명이 칭호를 약속한다`);
    for (const quest of QUESTS.filter((entry) => entry.reward?.title)) {
        const definition = TITLES.find((title) => title.id === quest.reward.title);
        assert.ok(definition, `임무 ${quest.id}: 칭호 ${quest.reward.title} 정의`);
        assert.equal(definition.name, quest.reward.title);
        assert.ok(TITLE_PASSIVES[quest.reward.title], `임무 ${quest.id}: 칭호 효과`);
    }
});

test('C10: 새 칭호는 임무 200 수령으로만 열린다 — 같은 이름의 다른 칭호가 없고 탐험 수로 자동 해금되지 않는다', () => {
    const definition = TITLES.find((title) => title.id === NEW_TITLE);
    assert.deepEqual(definition.cond, { type: 'questReward', val: 200 });
    assert.equal(TITLES.filter((title) => title.name === NEW_TITLE || title.id === NEW_TITLE).length, 1, '이름 · id가 하나뿐');
    assert.ok(!PRESTIGE_TITLES.includes(NEW_TITLE));
    assert.equal(QUESTS.filter((quest) => quest.reward?.title === NEW_TITLE).length, 1, '주는 임무는 200 하나');

    const explorer = (explores, claimedQuestIds = []) => ({
        ...structuredClone(INITIAL_STATE.player),
        level: 99,
        titles: [],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), explores, claimedQuestIds },
    });
    for (const explores of [0, 50, 100, 500, 10_000]) {
        assert.ok(!checkTitles(explorer(explores)).includes(NEW_TITLE), `탐험 ${explores}회 — 수령 없이 열리지 않는다`);
    }
    assert.ok(checkTitles(explorer(50, [200])).includes(NEW_TITLE), '수령 기록이 있으면 복구된다');
});

test('C10: 임무 200 수락 → 탐험 50회(실제 진행 갱신) → 수령이 새 칭호를 준다', () => {
    let state = accept(baseState({ level: 5 }), 200);
    const explored = { ...state.player, stats: { ...state.player.stats, explores: 50 } };
    state = { ...state, player: { ...explored, quests: syncQuestProgress(explored, '', DB.QUESTS).updatedQuests } };
    assert.equal(state.player.quests.find((quest) => quest.id === 200).progress, 50);

    const claimed = claim(state, 200);
    assert.ok(claimed.player.titles.includes(NEW_TITLE));
    assert.ok(claimed.logs.some((log) => log.text === MSG.TITLE_UNLOCKED(NEW_TITLE)));
    // 칭호 효과가 실제 능력치에 들어간다(데이터가 선언한 값 그대로).
    const passive = TITLE_PASSIVES[NEW_TITLE];
    const withTitle = calculateFullStats({ ...claimed.player, activeTitle: NEW_TITLE });
    const without = calculateFullStats({ ...claimed.player, activeTitle: null });
    assert.equal(withTitle.maxHp - without.maxHp, passive.hp);
    assert.equal(withTitle.maxMp - without.maxMp, passive.mp);
});

test('C10: 새 칭호 효과는 탐험 100회 칭호(방랑자)보다 약하고 라벨이 수치와 같다', () => {
    const passive = TITLE_PASSIVES[NEW_TITLE];
    const wanderer = TITLE_PASSIVES.wanderer;
    const total = (entry) => (entry.atk || 0) + (entry.def || 0) + (entry.hp || 0) + (entry.mp || 0) + (entry.crit || 0) * 100;
    assert.ok(total(passive) > 0);
    assert.ok(total(passive) < total(wanderer), '방랑자(탐험 100회)보다 약하다');
    for (const key of ['atk', 'def', 'hp', 'mp']) assert.ok((passive[key] || 0) <= (wanderer[key] || 0), key);
    assert.equal(passive.label, `MP +${passive.mp} · HP +${passive.hp}`);
});
