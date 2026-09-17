import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import {
    buildScoutEvent,
    consumeScoutCharge,
    getRemainingScoutCharges,
    getScoutAvailability,
    getScoutEliteCardChance,
    getScoutGoldCost,
} from '../src/utils/scoutEvents.js';
import { getMirrorEffects } from '../src/systems/mirrorUpgrades.js';
import { MIRROR_NODES } from '../src/data/mirror.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { DB } from '../src/data/db.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';

/**
 * 2026-09 D1 — 플레이어가 직접 부르는 정찰.
 *
 * 기존 25% 랜덤 발동은 그대로 두고, 골드(또는 거울 무료 횟수)를 지불하는 능동 정찰을
 * 추가했다. 카드 자체는 같은 buildScoutEvent → eventActions 해소 경로를 그대로 쓴다.
 */

const DUNGEON = { type: 'dungeon', level: 10, eventChance: 0.1 };
const TOWN = { type: 'safe', level: 1 };

const makePlayer = (overrides = {}) => ({
    name: '정찰자',
    hp: 100,
    maxHp: 100,
    gold: 500,
    loc: '어스름 숲',
    stats: { exploreState: { sinceRelic: 0 } },
    meta: {},
    ...overrides,
});

// 고정 난수 — 호출 순서를 그대로 소비한다.
const seq = (values) => {
    let i = 0;
    return () => (i < values.length ? values[i++] : values[values.length - 1]);
};

// ── ① 정예 카드 편향 (유물 pity ↑ / 저생명 ↓) ─────────────────────────────
test('① 유물 pity가 임계 이하이면 정예 카드 확률은 기본값 그대로다', () => {
    const player = makePlayer({ stats: { exploreState: { sinceRelic: BALANCE.SCOUT_ELITE_PITY_THRESHOLD } } });
    assert.equal(getScoutEliteCardChance(player, DUNGEON), BALANCE.SCOUT_ELITE_CARD_CHANCE);
});

test('① 유물이 오래 안 나올수록 정예 카드 확률이 단조 증가한다', () => {
    const low = getScoutEliteCardChance(
        makePlayer({ stats: { exploreState: { sinceRelic: 4 } } }),
        DUNGEON,
    );
    const high = getScoutEliteCardChance(
        makePlayer({ stats: { exploreState: { sinceRelic: 8 } } }),
        DUNGEON,
    );
    assert.ok(high > low, 'pity가 클수록 확률이 높아야 한다');
    assert.ok(low > BALANCE.SCOUT_ELITE_CARD_CHANCE, '임계 초과분은 기본값보다 높아야 한다');
    assert.ok(high <= BALANCE.SCOUT_ELITE_MAX_CARD_CHANCE, '상한을 넘지 않는다');
});

test('① 생명이 낮으면 정예 카드 확률이 내려간다', () => {
    const stats = { exploreState: { sinceRelic: 8 } };
    const healthy = getScoutEliteCardChance(makePlayer({ stats, hp: 100, maxHp: 100 }), DUNGEON);
    const wounded = getScoutEliteCardChance(
        makePlayer({ stats, hp: Math.floor(100 * BALANCE.SCOUT_LOW_HP_RATIO), maxHp: 100 }),
        DUNGEON,
    );
    assert.ok(wounded < healthy, '저생명에서는 고위험 카드를 덜 제시한다');
    assert.ok(Math.abs(wounded - healthy * BALANCE.SCOUT_LOW_HP_ELITE_MULT) < 1e-9);
});

test('① 확률 상한은 SCOUT_ELITE_MAX_CARD_CHANCE로 고정된다', () => {
    const player = makePlayer({ stats: { exploreState: { sinceRelic: 999 } } });
    assert.equal(getScoutEliteCardChance(player, DUNGEON), BALANCE.SCOUT_ELITE_MAX_CARD_CHANCE);
});

test('① 지역 pacing profile(relicMult)이 pity 가산에 반영된다 — 보스 권역이 더 높다', () => {
    const stats = { exploreState: { sinceRelic: BALANCE.SCOUT_ELITE_PITY_THRESHOLD + 2 } };
    const frontier = getScoutEliteCardChance(makePlayer({ stats }), { type: 'dungeon', level: 5 });
    const bossArea = getScoutEliteCardChance(makePlayer({ stats }), { type: 'dungeon', level: 5, boss: '숲의 군주' });
    assert.ok(bossArea > frontier);
});

// ── ② buildScoutEvent가 실제로 player/mapData를 사용한다 ──────────────────
test('② 같은 seed라도 pity가 높으면 정예 카드가 나온다 (인자가 실제로 쓰인다)', () => {
    const roll = BALANCE.SCOUT_ELITE_CARD_CHANCE + 0.02;
    const calm = buildScoutEvent(makePlayer(), DUNGEON, seq([roll]));
    const pitied = buildScoutEvent(
        makePlayer({ stats: { exploreState: { sinceRelic: 9 } } }),
        DUNGEON,
        seq([roll]),
    );

    assert.equal(calm.outcomes[2].scoutEffect, 'unknown');
    assert.equal(pitied.outcomes[2].scoutEffect, 'elite');
    assert.equal(pitied.choices[2], MSG.SCOUT_ELITE_CHOICE);
});

test('② rng 소비는 1회로 유지된다 (seed 순서 보존)', () => {
    let calls = 0;
    buildScoutEvent(makePlayer(), DUNGEON, () => {
        calls += 1;
        return 0.9;
    });
    assert.equal(calls, 1);
});

// ── ③ 비용 / 지불 가능 여부 ────────────────────────────────────────────────
test('③ 정찰 비용은 기본값에 지역 레벨당 가산이 완만하게 붙는다', () => {
    assert.equal(getScoutGoldCost({ type: 'dungeon', level: 0 }), BALANCE.SCOUT_GOLD_COST);
    assert.equal(
        getScoutGoldCost(DUNGEON),
        BALANCE.SCOUT_GOLD_COST + 10 * BALANCE.SCOUT_GOLD_COST_PER_MAP_LEVEL,
    );
    assert.equal(getScoutGoldCost({ type: 'dungeon', level: 'infinite' }), BALANCE.SCOUT_GOLD_COST);
});

test('③ 안전지대에서는 정찰을 제공하지 않는다', () => {
    const availability = getScoutAvailability(makePlayer(), TOWN, true);
    assert.equal(availability.available, false);
    assert.equal(availability.reason, MSG.SCOUT_SAFE_ONLY);
});

test('③ 전투·이벤트 중에는 정찰을 제공하지 않는다', () => {
    const availability = getScoutAvailability(makePlayer(), DUNGEON, false);
    assert.equal(availability.available, false);
    assert.equal(availability.reason, MSG.SCOUT_BUSY);
});

test('③ 골드가 모자라면 비활성 + 필요한 금액을 그대로 알려 준다', () => {
    const cost = getScoutGoldCost(DUNGEON);
    const availability = getScoutAvailability(makePlayer({ gold: cost - 1 }), DUNGEON, true);
    assert.equal(availability.available, false);
    assert.equal(availability.reason, MSG.SCOUT_GOLD_INSUFFICIENT(cost));
    assert.equal(availability.cost, cost);
});

test('③ 골드가 충분하면 실행 가능하고 사유가 없다', () => {
    const availability = getScoutAvailability(makePlayer(), DUNGEON, true);
    assert.equal(availability.available, true);
    assert.equal(availability.reason, null);
    assert.equal(availability.isFree, false);
    assert.equal(availability.cost, getScoutGoldCost(DUNGEON));
});

// ── ④ 거울 scout_charges 무료 횟수 ────────────────────────────────────────
test('④ scout_charges 노드는 레벨당 무료 정찰 횟수를 준다', () => {
    const node = MIRROR_NODES.find((entry) => entry.id === 'scout_charges');
    assert.ok(node, 'scout_charges 노드가 거울 트리에 존재해야 한다');
    assert.equal(getMirrorEffects({}).freeScoutCharges, 0);
    assert.equal(
        getMirrorEffects({ mirror: { scout_charges: 1 } }).freeScoutCharges,
        BALANCE.MIRROR_FREE_SCOUT_PER_LEVEL,
    );
    assert.equal(
        getMirrorEffects({ mirror: { scout_charges: node.maxLevel + 5 } }).freeScoutCharges,
        node.maxLevel * BALANCE.MIRROR_FREE_SCOUT_PER_LEVEL,
    );
});

test('④ 무료 횟수가 남아 있으면 골드를 쓰지 않는다', () => {
    const player = makePlayer({ gold: 0, meta: { mirror: { scout_charges: 2 } } });
    const availability = getScoutAvailability(player, DUNGEON, true);
    assert.equal(availability.available, true);
    assert.equal(availability.isFree, true);
    assert.equal(availability.cost, 0);
    assert.equal(availability.remainingFree, 2 * BALANCE.MIRROR_FREE_SCOUT_PER_LEVEL);
});

test('④ 무료 정찰을 다 쓰면 다시 골드 비용으로 돌아간다', () => {
    const granted = getMirrorEffects({ mirror: { scout_charges: 1 } }).freeScoutCharges;
    let player = makePlayer({
        gold: 0,
        meta: { mirror: { scout_charges: 1 } },
        activeExpedition: { id: 'expedition-1' },
    });

    for (let i = 0; i < granted; i += 1) {
        assert.equal(getRemainingScoutCharges(player), granted - i);
        player = { ...player, stats: consumeScoutCharge(player) };
    }

    assert.equal(getRemainingScoutCharges(player), 0);
    const availability = getScoutAvailability(player, DUNGEON, true);
    assert.equal(availability.isFree, false);
    assert.equal(availability.available, false, '골드 0이면 더 이상 정찰할 수 없다');
});

test('④ 새 원정이 시작되면 무료 정찰이 다시 채워진다', () => {
    const meta = { mirror: { scout_charges: 1 } };
    const spent = makePlayer({ meta, activeExpedition: { id: 'expedition-1' } });
    const afterUse = { ...spent, stats: consumeScoutCharge(spent) };
    assert.equal(getRemainingScoutCharges(afterUse), 0);

    const nextExpedition = { ...afterUse, activeExpedition: { id: 'expedition-2' } };
    assert.equal(
        getRemainingScoutCharges(nextExpedition),
        getMirrorEffects({ mirror: { scout_charges: 1 } }).freeScoutCharges,
        '원정 id가 바뀌면 사용 기록이 자동으로 초기화된다',
    );
});

test('④ consumeScoutCharge는 기존 stats를 변이하지 않는다', () => {
    const player = makePlayer({ meta: { mirror: { scout_charges: 1 } }, stats: { kills: 3 } });
    const next = consumeScoutCharge(player);
    assert.equal(player.stats.scoutCharges, undefined);
    assert.equal(next.kills, 3);
    assert.equal(next.scoutCharges.used, 1);
});

// ── ⑤ 단일 전이 · 연타 멱등성 (2026-09 N1b) ──────────────────────────────
const DUNGEON_LOC = '고요한 숲';

/** 리듀서를 실제로 물린 미니 엔진 — 훅이 본 스냅샷(player/gameState)은 렌더 전이라 그대로 둔다. */
const makeScoutHarness = (playerOverrides = {}) => {
    let state = {
        ...structuredClone(INITIAL_STATE),
        gameState: GS.IDLE,
        logs: [],
        player: {
            ...structuredClone(INITIAL_STATE.player),
            loc: DUNGEON_LOC,
            gold: 5000,
            ...playerOverrides,
        },
    };
    const snapshotPlayer = state.player;
    const errorLogs = [];
    const actions = createExploreActions(
        {
            player: snapshotPlayer,
            gameState: GS.IDLE,
            dispatch: (action) => { state = gameReducer(state, action); },
            addLog: (type, text) => errorLogs.push({ type, text }),
            getFullStats: () => ({ maxHp: 100, maxMp: 50 }),
        },
        {
            commitExploreOutcome: () => {
                // Codex 79df84f: 카드 "선택" 해소만이 탐험 결과 정산 권한을 갖는다.
                assert.fail('정찰 카드 개방은 commitExploreOutcome을 호출하지 않는다');
            },
        },
    );
    return {
        actions,
        errorLogs,
        get state() { return state; },
        set state(next) { state = next; },
    };
};

test('⑤ 정찰을 연속 두 번 호출해도 골드는 1회만 차감되고 무료 횟수도 1회만 소모된다', () => {
    const cost = getScoutGoldCost(DB.MAPS[DUNGEON_LOC]);
    const harness = makeScoutHarness({ gold: 5000 });

    harness.actions.scout();
    const afterFirst = harness.state;
    harness.actions.scout();

    assert.equal(harness.state.player.gold, 5000 - cost, '골드는 1회분만 빠진다');
    assert.equal(harness.state.gameState, GS.EVENT);
    assert.equal(harness.state.currentEvent?.isScout, true, '정찰 카드가 열려 있다');
    assert.equal(harness.state, afterFirst, '두 번째 호출은 상태를 바꾸지 않는다');
    assert.deepEqual(harness.errorLogs, [], '훅 스냅샷 기준으로는 두 번 다 가용하므로 오류 로그가 없다');

    const costLogs = harness.state.logs.filter((log) => log.text === MSG.SCOUT_PAID_LOG(cost));
    assert.equal(costLogs.length, 1, '비용 로그도 1건뿐이다');
});

test('⑤ 무료 정찰도 연타에서 1회만 소모된다', () => {
    const granted = getMirrorEffects({ mirror: { scout_charges: 1 } }).freeScoutCharges;
    const harness = makeScoutHarness({
        gold: 0,
        meta: { ...structuredClone(INITIAL_STATE.player.meta), mirror: { scout_charges: 1 } },
        activeExpedition: null,
    });

    harness.actions.scout();
    harness.actions.scout();

    assert.equal(harness.state.player.gold, 0, '무료 정찰은 골드를 쓰지 않는다');
    assert.equal(harness.state.player.stats.scoutCharges.used, 1, '무료 횟수는 1회만 소모된다');
    assert.equal(getRemainingScoutCharges(harness.state.player), granted - 1);
});

test('⑤ 같은 RESOLVE_SCOUT를 두 번 dispatch하면 두 번째는 같은 state 객체를 돌려준다', () => {
    const harness = makeScoutHarness({ gold: 5000 });
    const action = { type: AT.RESOLVE_SCOUT, payload: { seed: 12345, now: 1700000000000 } };

    const first = gameReducer(harness.state, action);
    assert.notEqual(first, harness.state, '첫 전이는 상태를 바꾼다');
    const second = gameReducer(first, action);
    assert.equal(second, first, '두 번째 전이는 동일 객체(no-op)');
});

test('⑤ 안전지대에서는 RESOLVE_SCOUT가 상태를 바꾸지 않는다 (리듀서 자체 판정)', () => {
    const harness = makeScoutHarness({ loc: '시작의 마을' });
    const next = gameReducer(harness.state, {
        type: AT.RESOLVE_SCOUT,
        payload: { seed: 7, now: 1700000000000 },
    });
    assert.equal(next, harness.state);
});

test('⑤ 훅은 불가 사유만 알리고 dispatch하지 않는다', () => {
    const dispatched = [];
    const errorLogs = [];
    createExploreActions(
        {
            player: { ...structuredClone(INITIAL_STATE.player), loc: DUNGEON_LOC, gold: 0 },
            gameState: GS.IDLE,
            dispatch: (action) => dispatched.push(action),
            addLog: (type, text) => errorLogs.push({ type, text }),
            getFullStats: () => ({}),
        },
        { commitExploreOutcome: () => assert.fail('정산 호출 금지') },
    ).scout();

    assert.deepEqual(dispatched, []);
    assert.equal(errorLogs.length, 1);
    assert.equal(errorLogs[0].type, 'error');
});

// ── ⑥ 액션·UI 계약 (정적 가드) ────────────────────────────────────────────
test('⑥ exploreActions.scout은 판정만 하고 정산은 AT.RESOLVE_SCOUT 단일 전이가 소유한다', async () => {
    const source = await readFile(new URL('../src/hooks/gameActions/exploreActions.ts', import.meta.url), 'utf8');

    assert.match(source, /scout: \(\) => \{/);
    assert.match(source, /getScoutAvailability\(player, mapData, gameState === GS\.IDLE\)/);
    assert.match(source, /type: AT\.RESOLVE_SCOUT/, '정산은 단일 전이로 위임한다');
    assert.doesNotMatch(source, /advanceBossGauge\(/, '게이지 누적은 리듀서 소유');
    assert.doesNotMatch(source, /consumeScoutCharge/, '무료 횟수 차감은 리듀서 소유');
    assert.doesNotMatch(source, /buildScoutEvent\(player, mapData, rng\)/, '카드 생성도 리듀서 소유');
    // 병합(2026-09): Codex가 explore() 내부 RNG를 harness seed를 받을 수 있는 actionRng로
    //   바꿨다(exploreActionSeed). "랜덤 25% 발동이 유지된다"는 의도는 동일하다.
    assert.match(source, /shouldTriggerScout\(mapData, actionRng\)/, '랜덤 25% 발동은 유지된다');
});

test('⑥ 리듀서 핸들러가 게이지·무료 횟수·카드 개방을 한 전이에 담는다', async () => {
    const source = await readFile(new URL('../src/reducers/handlers/exploreHandlers.ts', import.meta.url), 'utf8');

    assert.match(source, /RESOLVE_SCOUT/);
    assert.match(source, /getScoutAvailability\(state\.player, mapData, state\.gameState === GS\.IDLE\)/,
        '훅 스냅샷이 아니라 리듀서 상태로 재판정한다');
    assert.match(source, /advanceBossGauge\(/, '정찰도 시간이 흐른 것으로 처리한다');
    assert.match(source, /consumeScoutCharge/);
    assert.match(source, /buildScoutEvent\(state\.player, mapData, createSeededRandom\(seed\)\)/,
        '같은 카드 빌더를 seed 스트림으로 재사용한다');
    // 주석은 이 규칙을 설명하므로 코드 본문만 본다.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /commitExploreOutcome/,
        '카드 개방은 탐험 결과 정산이 아니다 (선택 해소가 유일한 정산 권한)');
});

test('⑤ ControlPanel은 탐험 화면에 비용이 적힌 정찰 버튼을 렌더한다', async () => {
    const source = await readFile(new URL('../src/components/ControlPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /data-testid="control-scout"/);
    assert.match(source, /data-testid="control-scout-cost"/);
    assert.match(source, /getScoutAvailability\(player, mapData, gameState === GS\.IDLE\)/);
    assert.match(source, /disabled=\{!scoutAvailability\.available/);
    assert.match(source, /MSG\.SCOUT_ACTION_LABEL/);
    assert.match(source, /scoutAvailability\.reason/, '비활성 사유를 그대로 보여 준다');
    assert.match(source, /testId: 'control-explore'/, '탐험 버튼은 그대로 유지된다');
});
