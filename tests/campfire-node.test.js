import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { BALANCE } from '../src/data/constants.js';

// 주입 경로(explore() → 캠프파이어 dispatch)는 firebase import 체인(import.meta.env)
// 때문에 node 단위 테스트로 로드 불가 → 브라우저 스모크에서 검증한다.

/**
 * Phase 2 (B+ 2026-06): 캠프파이어 노드 — "휴식 vs 단련" 결정 (StS 캠프파이어).
 * 휴식 = 즉시 HP/MP 회복, 단련 = 다음 전투 ATK 버프(tempBuff).
 */

// ── 빌더 (순수) ──────────────────────────────────────────────────────────────

test('campfire 빌더: 2선택 + 회복/버프 outcome 구조', () => {
    const ev = buildCampfireEvent({ maxHp: 200, maxMp: 100 });
    assert.equal(ev.isCampfire, true);
    assert.equal(ev.choices.length, 2);
    assert.equal(ev.outcomes.length, 2);

    const rest = ev.outcomes[0];
    assert.equal(rest.choiceIndex, 0);
    assert.equal(rest.hp, Math.floor(200 * BALANCE.CAMPFIRE_HEAL_RATIO)); // 80
    assert.equal(rest.mp, Math.floor(100 * BALANCE.CAMPFIRE_HEAL_RATIO)); // 40

    const forge = ev.outcomes[1];
    assert.equal(forge.choiceIndex, 1);
    assert.equal(forge.buff.atk, BALANCE.CAMPFIRE_FORGE_ATK);
    assert.equal(forge.buff.turn, BALANCE.CAMPFIRE_FORGE_TURNS);
    assert.equal(forge.buff.name, '모닥불 단련');
});

// ── 핸들러 통합 ───────────────────────────────────────────────────────────────

const makeEventDeps = (currentEvent, playerOverrides = {}) => {
    const dispatches = [];
    const deps = {
        player: { hp: 100, mp: 20, quests: [], history: [], stats: {}, ...playerOverrides },
        currentEvent,
        dispatch: (a) => dispatches.push(a),
        addLog: () => {},
        getFullStats: () => ({ maxHp: 200, maxMp: 100 }),
    };
    const actions = createEventActions(deps, { emitUnlockedTitles: () => {} });
    return { actions, dispatches };
};

const findSetPlayer = (dispatches) => {
    const setPlayer = [...dispatches].reverse().find((d) => d.type === 'SET_PLAYER');
    return setPlayer?.payload;
};

test('campfire 휴식(선택 0): HP/MP 회복 (maxHp 상한 적용)', () => {
    const ev = buildCampfireEvent({ maxHp: 200, maxMp: 100 });
    const { actions, dispatches } = makeEventDeps(ev, { hp: 100, mp: 20 });
    actions.handleEventChoice(0);
    const updated = findSetPlayer(dispatches);
    assert.ok(updated, 'SET_PLAYER dispatch 존재');
    assert.equal(updated.hp, 180, '100 + 80 회복'); // floor(200*0.4)=80
    assert.equal(updated.mp, 60, '20 + 40 회복');
});

test('campfire 단련(선택 1): 다음 전투 ATK 버프(tempBuff) 부여', () => {
    const ev = buildCampfireEvent({ maxHp: 200, maxMp: 100 });
    const { actions, dispatches } = makeEventDeps(ev, { hp: 100, mp: 20 });
    actions.handleEventChoice(1);
    const updated = findSetPlayer(dispatches);
    assert.ok(updated, 'SET_PLAYER dispatch 존재');
    assert.equal(updated.tempBuff.atk, BALANCE.CAMPFIRE_FORGE_ATK);
    assert.equal(updated.tempBuff.turn, BALANCE.CAMPFIRE_FORGE_TURNS);
    assert.equal(updated.tempBuff.name, '모닥불 단련');
    // 단련은 회복하지 않음 (결정의 트레이드오프)
    assert.equal(updated.hp, 100, '단련 선택 시 HP 회복 없음');
});
