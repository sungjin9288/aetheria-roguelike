import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { shouldTriggerScout, buildScoutEvent } from '../src/utils/scoutEvents.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { applyScoutGuaranteedRelic, buildPassiveBonusWithScout } from '../src/hooks/combatActions/_helpers.js';
import { MAX_RELICS_PER_RUN } from '../src/data/relics.js';

/**
 * 탐험 스카우팅 (2026-07 감사 (b)): "정보 없는 단일 버튼 탐험" 갭 대응.
 * 던전 탐험 시 확률적으로 사전 정찰 카드 2~3장을 제시 — 선택 즉시 같은 탐험 턴
 * 안에서 해소된다. 체인 > 캠프파이어 > 스카우팅 > 나머지 롤 우선순위.
 */

const withStubbedRandom = (value, fn) => {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
};

// ── shouldTriggerScout ──────────────────────────────────────────────────────

test('shouldTriggerScout: 던전 + random < SCOUT_CHANCE → 발동', () => {
    const mapData = { type: 'dungeon' };
    assert.equal(shouldTriggerScout(mapData, () => 0), true);
});

test('shouldTriggerScout: 던전이지만 random >= SCOUT_CHANCE → 미발동', () => {
    const mapData = { type: 'dungeon' };
    assert.equal(shouldTriggerScout(mapData, () => 0.99), false);
});

test('shouldTriggerScout: 안전지대(safe)는 확률 무관 항상 미발동', () => {
    const mapData = { type: 'safe' };
    assert.equal(shouldTriggerScout(mapData, () => 0), false);
});

test('shouldTriggerScout: field/boss 타입도 안전지대만 아니면 발동 가능', () => {
    assert.equal(shouldTriggerScout({ type: 'field' }, () => 0), true);
    assert.equal(shouldTriggerScout({ type: 'boss' }, () => 0), true);
});

test('shouldTriggerScout: mapData 없으면 미발동', () => {
    assert.equal(shouldTriggerScout(null, () => 0), false);
    assert.equal(shouldTriggerScout(undefined, () => 0), false);
});

// ── buildScoutEvent: 카드 구성 ───────────────────────────────────────────────

test('buildScoutEvent: 기본 3장 (전투/이상신호/안개) — 정예 카드 미당첨', () => {
    // 마지막 rng 호출(정예 대체 롤)이 SCOUT_ELITE_CARD_CHANCE 이상이면 기본 카드 유지
    const rngSeq = [0.5]; // 정예 대체 롤에만 사용
    let i = 0;
    const rng = () => rngSeq[Math.min(i++, rngSeq.length - 1)];
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, rng);

    assert.equal(ev.isScout, true);
    assert.equal(ev.desc, MSG.SCOUT_DESC);
    assert.equal(ev.choices.length, 3);
    assert.equal(ev.outcomes.length, 3);
    assert.equal(ev.outcomes[0].scoutEffect, 'combat');
    assert.equal(ev.outcomes[1].scoutEffect, 'anomaly');
    assert.equal(ev.outcomes[2].scoutEffect, 'unknown');
    assert.equal(ev.choices[0], MSG.SCOUT_COMBAT_CHOICE);
    assert.equal(ev.choices[1], MSG.SCOUT_ANOMALY_CHOICE);
    assert.equal(ev.choices[2], MSG.SCOUT_UNKNOWN_CHOICE);
});

test('buildScoutEvent: 정예 카드 당첨(random < SCOUT_ELITE_CARD_CHANCE) → 3번째 슬롯 대체', () => {
    const rng = () => 0; // 정예 대체 롤 0 < SCOUT_ELITE_CARD_CHANCE(0.15) → 항상 당첨
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, rng);

    assert.equal(ev.choices.length, 3);
    assert.equal(ev.outcomes[2].scoutEffect, 'elite');
    assert.equal(ev.choices[2], MSG.SCOUT_ELITE_CHOICE);
    // 앞 두 카드(전투/이상신호)는 그대로 유지
    assert.equal(ev.outcomes[0].scoutEffect, 'combat');
    assert.equal(ev.outcomes[1].scoutEffect, 'anomaly');
});

test('buildScoutEvent: 정예 카드 확률 경계값 — SCOUT_ELITE_CARD_CHANCE와 정확히 같으면 미당첨', () => {
    const rng = () => BALANCE.SCOUT_ELITE_CARD_CHANCE; // 경계값은 미포함 (< 비교)
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, rng);
    assert.equal(ev.outcomes[2].scoutEffect, 'unknown');
});

test('buildScoutEvent: 전투 카드 outcome은 처치 보상 +10% 버프 정보를 포함', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const combatOutcome = ev.outcomes.find((o) => o.scoutEffect === 'combat');
    assert.equal(combatOutcome.rewardBonus, BALANCE.SCOUT_COMBAT_REWARD_BONUS);
});

test('buildScoutEvent: outcomes에 choiceIndex가 순서대로 부여됨 (일반 이벤트 outcome 스키마 준수)', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    ev.outcomes.forEach((o, idx) => assert.equal(o.choiceIndex, idx));
});

// ── handleEventChoice 통합: 카드별 즉시 해소 ─────────────────────────────────

const makeDeps = (currentEvent, overrides = {}) => {
    const dispatches = [];
    const logs = [];
    const deps = {
        player: {
            hp: 100, mp: 20, maxHp: 100, maxMp: 20,
            loc: '고요한 숲', level: 1, relics: [], quests: [], history: [], stats: {}, meta: {},
            ...overrides.player,
        },
        currentEvent,
        dispatch: (a) => dispatches.push(a),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 100, maxMp: 20 }),
        uid: 'test-uid',
        ...overrides.deps,
    };
    const shared = {
        emitUnlockedTitles: () => {},
        commitExploreOutcome: (outcome, transform) => {
            dispatches.push({ type: 'COMMIT_EXPLORE_OUTCOME', payload: outcome });
            if (typeof transform === 'function') transform(deps.player);
        },
    };
    const actions = createEventActions(deps, shared);
    return { actions, dispatches, logs };
};

const findDispatch = (dispatches, type) => [...dispatches].reverse().find((d) => d.type === type);

test('전투의 기척 선택 → 전투 확정 스폰 (SET_ENEMY + GS.COMBAT)', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const mapData = { type: 'dungeon', level: 1, monsters: ['슬라임'] };
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    withStubbedRandom(0.9, () => actions.handleEventChoice(0));

    const setEnemy = findDispatch(dispatches, 'SET_ENEMY');
    assert.ok(setEnemy, 'SET_ENEMY dispatch 존재');
    assert.ok(setEnemy.payload, '적 스탯 payload 존재');
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'combat');
});

test('전투의 기척 선택 → 스폰된 적에 scoutRewardBonus 마커 부여', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    actions.handleEventChoice(0);

    const setEnemy = findDispatch(dispatches, 'SET_ENEMY');
    assert.equal(setEnemy.payload.scoutRewardBonus, BALANCE.SCOUT_COMBAT_REWARD_BONUS);
});

test('이상 신호 선택 → 전투 미발생 (SET_ENEMY 없음), 이벤트 종료', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    actions.handleEventChoice(1);

    assert.equal(findDispatch(dispatches, 'SET_ENEMY'), undefined, '이상 신호는 전투를 발생시키지 않음');
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'idle');
});

test('짙은 안개 선택 → 이벤트 상태 해제 (기존 롤로 위임, 전투 강제 없음)', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    actions.handleEventChoice(2);

    const setEvent = findDispatch(dispatches, 'SET_EVENT');
    assert.equal(setEvent.payload, null, '짙은 안개는 이벤트를 닫아 기존 explore 롤로 위임');
});

test('짙은 안개 선택 → 같은 턴 안에서 기존 롤 파이프가 즉시 재실행되어 결과가 나옴 (quiet 롤 성공 시나리오)', () => {
    // quiet 롤이 확실히 뜨도록 quietChance가 항상 통과하는 상황을 만들 순 없으므로(내부 Math.random),
    // 대신 "무언가 dispatch가 일어났다"(전투/유물/quiet 중 하나)를 확인한다 — 빈 방치가 아님을 검증.
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    actions.handleEventChoice(2);

    const meaningfulDispatch = dispatches.some((d) => (
        d.type === 'SET_ENEMY' || d.type === 'SET_PENDING_RELICS' || d.type === 'COMMIT_EXPLORE_OUTCOME'
    ));
    assert.ok(meaningfulDispatch, '짙은 안개는 같은 턴에 quiet/유물/전투 중 하나의 결과를 즉시 만들어야 함');
});

test('정예의 흔적 선택 → 정예 확정 스폰 + 유물 보장 플래그', () => {
    const rng = () => 0; // 정예 카드 당첨
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, rng);
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '고요한 숲' } });

    actions.handleEventChoice(2);

    const setEnemy = findDispatch(dispatches, 'SET_ENEMY');
    assert.ok(setEnemy, 'SET_ENEMY dispatch 존재');
    assert.equal(setEnemy.payload.isElite, true, '정예 확정 스폰');
    assert.equal(setEnemy.payload.scoutGuaranteedRelic, true, '승리 시 유물 보장 마커');
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'combat');
});

// ── applyScoutGuaranteedRelic (combatVictory.ts 승리 후처리 헬퍼) ───────────

test('applyScoutGuaranteedRelic: scoutGuaranteedRelic 없으면 무동작', () => {
    const dispatches = [];
    const dispatch = (a) => dispatches.push(a);
    applyScoutGuaranteedRelic({ isElite: true }, { relics: [], meta: {} }, { dispatch, addLog: () => {} });
    assert.equal(dispatches.length, 0);
});

test('applyScoutGuaranteedRelic: scoutGuaranteedRelic=true → SET_PENDING_RELICS dispatch', () => {
    const dispatches = [];
    const dispatch = (a) => dispatches.push(a);
    applyScoutGuaranteedRelic(
        { scoutGuaranteedRelic: true },
        { relics: [], meta: {} },
        { dispatch, addLog: () => {} }
    );
    const setPendingRelics = findDispatch(dispatches, 'SET_PENDING_RELICS');
    assert.ok(setPendingRelics, 'SET_PENDING_RELICS dispatch 존재');
    assert.ok(Array.isArray(setPendingRelics.payload) && setPendingRelics.payload.length > 0, '유물 후보 배열 존재');
});

test('applyScoutGuaranteedRelic: 유물 슬롯이 가득 찼으면 무동작 (기존 pity 인프라와 동일 가드)', () => {
    const dispatches = [];
    const dispatch = (a) => dispatches.push(a);
    const fullRelics = Array.from({ length: MAX_RELICS_PER_RUN }, (_, i) => ({ id: `relic_${i}` }));
    applyScoutGuaranteedRelic(
        { scoutGuaranteedRelic: true },
        { relics: fullRelics, meta: {} },
        { dispatch, addLog: () => {} }
    );
    assert.equal(findDispatch(dispatches, 'SET_PENDING_RELICS'), undefined, '슬롯 가득 차면 큐잉하지 않음');
});

// ── buildPassiveBonusWithScout (combatVictory.ts EXP/골드 보너스 합산) ─────────

test('buildPassiveBonusWithScout: scoutRewardBonus 없으면 기존 passiveBonus만 반영', () => {
    const result = buildPassiveBonusWithScout({ passiveGoldMult: 0.05, passiveExpMult: 0.02 }, { isElite: true });
    assert.equal(result.goldMult, 0.05);
    assert.equal(result.expMult, 0.02);
});

test('buildPassiveBonusWithScout: scoutRewardBonus(+10%)가 기존 passiveBonus에 가산됨', () => {
    const result = buildPassiveBonusWithScout(
        { passiveGoldMult: 0.05, passiveExpMult: 0.02 },
        { scoutRewardBonus: BALANCE.SCOUT_COMBAT_REWARD_BONUS }
    );
    assert.equal(result.goldMult, 0.05 + BALANCE.SCOUT_COMBAT_REWARD_BONUS);
    assert.equal(result.expMult, 0.02 + BALANCE.SCOUT_COMBAT_REWARD_BONUS);
});

test('buildPassiveBonusWithScout: stats 없어도 안전 (기본값 0)', () => {
    const result = buildPassiveBonusWithScout(undefined, { scoutRewardBonus: 0.1 });
    assert.equal(result.goldMult, 0.1);
    assert.equal(result.expMult, 0.1);
});
