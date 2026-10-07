import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { rollExplorationEvent, runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { resolveExplorationRhythmOutcomeStep, ACTIVE_EXPLORATION_RHYTHM } from '../src/systems/explorationRhythmSimulator.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { getDiscoveryOdds } from '../src/utils/explorationPacing.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 77 (소유자 결정 1a "칸이 차도 같은 확률로 발견, 교체 제안으로") — 유물 칸이 가득 찬 뒤에도
 * 탐험의 유물 발견 추첨은 같은 확률로 돌고, 발견하면 기존 교체 화면(`REPLACE_RELIC` · `DECLINE_RELIC`)으로 열린다.
 *
 * 이전에는 두 발견 지점(조용한 탐험의 발견 · 전투 직전 발견)이 `playerRelics.length < maxRelics`일 때만 굴렸다.
 * 칸은 자연 플레이 중앙값 Lv9 · 2.5h에 차고, 그 뒤 유물 제안은 보스 보상 교체 제안뿐이라 시간당 0.19번이었다
 * (원장 §80.3 — 회차의 약 96%에서 유물 선택이 사실상 없었다).
 */

const MAP = DB.MAPS['고요한 숲'];
const RANK0_CAP = getPrestigeUnlocks(0).maxRelics;
const RANK2 = getPrestigeUnlocks(2);

const ownedRelics = (count) => structuredClone(RELICS.slice(0, count));

/** 앞부분은 대본대로, 뒤는 0.5 — 후보 추첨이 어떤 값을 쓰든 분기는 대본이 정한다. */
const scripted = (values) => {
    let index = 0;
    return () => (index < values.length ? values[index++] : 0.5);
};

const basePlayer = (relicCount, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '탐험가',
    job: '전사',
    level: 20,
    hp: 200,
    maxHp: 200,
    mp: 50,
    maxMp: 50,
    loc: '고요한 숲',
    inv: [],
    relics: ownedRelics(relicCount),
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0 },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), exploreState: { sinceRelic: 0, quietStreak: 0 } },
    ...overrides,
});

const record = () => {
    const actions = [];
    const logs = [];
    const commits = [];
    return {
        actions,
        logs,
        commits,
        dispatch: (action) => actions.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        commitExploreOutcome: (outcome) => commits.push(outcome),
        getFullStats: () => ({ maxHp: 200, maxMp: 50, atk: 40, def: 20 }),
    };
};

const pendingOf = (rec) => rec.actions.find((action) => action.type === AT.SET_PENDING_RELICS)?.payload ?? null;

/** 조용한 탐험의 발견: 이상 현상 롤(0.999 = 지나침) → 유물 롤. */
const rollQuietDiscovery = (player, relicRoll) => {
    const rec = record();
    const result = rollExplorationEvent(player, MAP, player.relics, { ...rec, rng: scripted([0.999, relicRoll]) });
    return { rec, result };
};

/** 전투 직전 발견: 조용함 롤(0.999 = 전투 쪽) → 유물 롤. */
const runPreCombatDiscovery = (player, relicRoll) => {
    const rec = record();
    runQuietRollAndCombat(player, MAP, { ...rec, rng: scripted([0.999, relicRoll]) });
    return rec;
};

test('조용한 탐험의 유물 발견은 칸이 가득 차도 굴리고 교체 제안으로 연다', () => {
    const player = basePlayer(RANK0_CAP);
    const { rec, result } = rollQuietDiscovery(player, 0);
    assert.equal(result, 'relic_found');
    const pending = pendingOf(rec);
    assert.ok(pending, '칸이 가득 차도 유물 제안이 열린다');
    assert.equal(pending.length, getPrestigeUnlocks(0).relicChoices);
    for (const relic of pending) {
        assert.ok(!player.relics.some((owned) => owned.id === relic.id), '이미 가진 유물은 제안하지 않는다');
    }
    assert.deepEqual(rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_REPLACE_OFFER }]);
});

test('칸이 남아 있으면 이전 문구 그대로다', () => {
    const { rec, result } = rollQuietDiscovery(basePlayer(RANK0_CAP - 1), 0);
    assert.equal(result, 'relic_found');
    assert.deepEqual(rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_DISCOVERED }]);
});

test('전투 직전 유물 발견도 칸이 가득 차면 교체 제안으로 전투를 대신한다', () => {
    const rec = runPreCombatDiscovery(basePlayer(RANK0_CAP), 0);
    assert.deepEqual(rec.commits, ['relic_found']);
    assert.ok(pendingOf(rec));
    assert.ok(!rec.actions.some((action) => action.type === AT.SET_ENEMY), '발견하면 적이 나오지 않는다');
    assert.deepEqual(rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_REPLACE_OFFER }]);

    const below = runPreCombatDiscovery(basePlayer(RANK0_CAP - 1), 0);
    assert.deepEqual(below.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_FOUND }]);
});

test('같은 확률이다 — 칸이 찬 플레이어와 빈 칸이 있는 플레이어의 문턱이 같다', () => {
    for (const count of [RANK0_CAP - 1, RANK0_CAP]) {
        const player = basePlayer(count);
        const quietThreshold = getDiscoveryOdds(player, MAP).relicChance;
        assert.equal(rollQuietDiscovery(player, quietThreshold - 1e-9).result, 'relic_found', `${count}개 · 문턱 아래`);
        assert.equal(rollQuietDiscovery(player, quietThreshold + 1e-9).result, 'nothing', `${count}개 · 문턱 위`);

        const preCombatThreshold = BALANCE.RELIC_FIND_CHANCE * 0.5;
        assert.deepEqual(runPreCombatDiscovery(player, preCombatThreshold - 1e-9).commits, ['relic_found'], `${count}개 · 전투 직전 문턱 아래`);
        assert.ok(
            !runPreCombatDiscovery(player, preCombatThreshold + 1e-9).commits.includes('relic_found'),
            `${count}개 · 전투 직전 문턱 위`,
        );
    }
});

test('계승 2단계부터는 6칸 · 4지선다 — 5개면 그냥 발견, 6개면 교체 제안', () => {
    const rank2 = (count) => basePlayer(count, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2 } });
    const five = rollQuietDiscovery(rank2(RANK2.maxRelics - 1), 0);
    assert.deepEqual(five.rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_DISCOVERED }]);
    const six = rollQuietDiscovery(rank2(RANK2.maxRelics), 0);
    assert.deepEqual(six.rec.logs, [{ type: 'event', text: MSG.EXPLORE_RELIC_REPLACE_OFFER }]);
    assert.equal(pendingOf(six.rec).length, RANK2.relicChoices);
});

test('칸이 찬 제안은 교체 · 넘기기로만 닫히고 유물 수는 늘지 않는다', () => {
    const player = basePlayer(RANK0_CAP);
    const { rec } = rollQuietDiscovery(player, 0);
    const pending = pendingOf(rec);
    const state = { ...structuredClone(INITIAL_STATE), logs: [], player, pendingRelics: pending };

    const added = gameReducer(state, { type: AT.ADD_RELIC, payload: pending[0] });
    assert.equal(added.player.relics.length, RANK0_CAP, '추가는 거부된다');
    assert.equal(added.pendingRelics, pending, '제안은 남아 교체 · 넘기기를 기다린다');

    const replaced = gameReducer(state, {
        type: AT.REPLACE_RELIC,
        payload: { relicId: pending[0].id, replaceRelicId: player.relics[0].id },
    });
    assert.equal(replaced.player.relics.length, RANK0_CAP);
    assert.equal(replaced.player.relics[0].id, pending[0].id);
    assert.equal(replaced.pendingRelics, null);

    const declined = gameReducer(state, { type: AT.DECLINE_RELIC });
    assert.deepEqual(declined.player.relics.map((relic) => relic.id), player.relics.map((relic) => relic.id));
    assert.equal(declined.pendingRelics, null);
});

test('선택 화면은 칸이 찬 탐험 발견을 교체 안내와 함께 그린다', () => {
    const player = basePlayer(RANK0_CAP);
    const pending = pendingOf(rollQuietDiscovery(player, 0).rec);
    const html = renderStatic(createElement(RelicChoicePanel, { pendingRelics: pending, dispatch: () => {}, player }));
    assert.ok(html.includes('data-testid="relic-choice-capacity-notice"'));
    assert.ok(html.includes(MSG.RELIC_CHOICE_CAPACITY_FULL(RANK0_CAP, RANK0_CAP)));
});

test('탐험 리듬 모델(진단 증빙의 근거)도 같은 규칙이다 — 칸 수와 무관하게 같은 결과', () => {
    // 직전 탐험이 선택 이벤트라(간격 0) 선택 이벤트 롤은 난수를 쓰지 않는다 — 조용함 → 이상 현상 → 유물 순서다.
    const exploreState = { sinceNarrativeEvent: 0, sinceDiscovery: 0, sinceRelic: 3, quietStreak: 0, lastOutcome: 'narrative_event' };
    const step = (count, values) => resolveExplorationRhythmOutcomeStep({
        map: MAP,
        player: { meta: { prestigeRank: 0, mirror: {} }, relics: ownedRelics(count), stats: { exploreState } },
        exploreState,
        policy: ACTIVE_EXPLORATION_RHYTHM,
        eventChanceBonus: 0,
        rng: scripted(values),
    });
    const cases = [
        [[0, 0.999, 0], 'relic'],
        [[0, 0.999, 0.999], 'nothing'],
        [[0.999, 0], 'relic'],
        [[0.999, 0.999], 'combat'],
    ];
    for (const [values, expected] of cases) {
        assert.equal(step(RANK0_CAP, values), expected, `칸이 찬 모델 · ${JSON.stringify(values)}`);
        assert.equal(step(1, values), expected, `칸이 남은 모델 · ${JSON.stringify(values)}`);
    }
});
