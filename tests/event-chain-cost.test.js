/**
 * event-chain-cost.test.js — Wave 14 F2: 이벤트 체인의 **완주** 비용 축.
 *
 * Wave 12가 맵 축에서 잡은 오류("선언 레벨은 실제 게이트가 아니다")가 체인 축에
 * 그대로 남아 있었다 — `contentReachability`가 완주 게이트를 `steps.at(-1).loc`,
 * 즉 **종착 스텝의 게이트**로 매기고 있었다. 그런데 스텝은 순서대로만 처리되므로
 * (리듀서가 강제한다) 완주하려면 **모든** 스텝의 지역을 지나야 하고, 실제 완주
 * 게이트는 전 스텝의 **max**다.
 *
 * 이 파일은 그 세 가지를 각각 실행으로 고정한다:
 *   (1) 스텝 순서 강제 — max가 정답인 **이유** (리듀서를 실제로 돌린다)
 *   (2) 리포트의 체인 게이트가 완주 게이트다 (리포트를 실제로 만든다)
 *   (3) `cost.eventChainSpans` — 열림/완주의 간격이 리포트에 실린다
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { buildContentReachabilityReport } from '../src/systems/contentReachability.ts';
import {
    MAP_ROUTE_START_LOCATION,
    mapRouteGateLevels,
} from '../src/utils/mapRouteGate.ts';

const routeGates = () => mapRouteGateLevels(MAP_ROUTE_START_LOCATION, DB.MAPS);

/** 리포트를 안 보고 데이터에서 직접 계산한 완주 게이트 — 리포트의 독립 대조군. */
const completionGateFromData = (chain, gates) => Math.max(
    ...chain.steps.map((step) => Number(gates.get(step.loc))),
);

// ── (1) 왜 max인가: 리듀서가 스텝 순서를 강제한다 ───────────────────────────
// 완주 게이트가 종착 스텝의 게이트라면, 중간 스텝을 건너뛸 수 있어야 한다.
// 그럴 수 없다는 것을 리듀서를 실제로 돌려서 본다 — 이것이 max의 근거다.

test('체인 스텝은 순서대로만 진행된다 — 중간 스텝을 건너뛴 이벤트는 무시된다', () => {
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === 'forgotten_god');
    const lastStep = chain.steps.at(-1);

    // 진행도가 0(= 1스텝 미완료)인데 마지막 스텝의 이벤트를 정산하려 한다.
    const state = {
        ...structuredClone(INITIAL_STATE),
        gameState: GS.EVENT,
        player: {
            ...structuredClone(INITIAL_STATE.player),
            gold: 100_000,
            eventChainProgress: { [chain.id]: 0 },
        },
        currentEvent: {
            ...structuredClone(lastStep.event),
            _chainId: chain.id,
            _chainStep: lastStep.step,
        },
    };

    const skipped = gameReducer(state, {
        type: AT.RESOLVE_CHAIN_GOLD_CHOICE,
        payload: { chainId: chain.id, step: lastStep.step, choiceIndex: 0 },
    });

    // 상태 객체 그대로 반환 = 전이 없음. 건너뛰기가 불가능하므로 완주는 전 스텝을 요구한다.
    assert.strictEqual(skipped, state);
    assert.equal(skipped.player.eventChainProgress[chain.id], 0);
});

// ── (2) 리포트의 체인 게이트는 완주 게이트다 ────────────────────────────────

test('cost.gates.eventChainTerminals는 전 스텝 max(완주 게이트)로 버킷을 만든다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();

    for (const chain of EVENT_CHAINS) {
        const bucket = cost.gates.eventChainTerminals.find((entry) => entry.members.includes(chain.id));
        assert.ok(bucket, `${chain.id}가 버킷에 없다`);
        assert.equal(
            bucket.gateLevel,
            completionGateFromData(chain, gates),
            `${chain.id}의 게이트가 완주 게이트가 아니다`,
        );
    }

    assert.deepEqual(
        cost.gates.eventChainTerminals.map(({ gateLevel, count }) => [gateLevel, count]),
        [[23, 1], [32, 1], [35, 1], [40, 1], [48, 3], [68, 6]],
    );
});

test('완주 게이트는 종착 스텝의 게이트보다 낮을 수 없다', () => {
    const gates = routeGates();
    for (const chain of EVENT_CHAINS) {
        const terminalGate = Number(gates.get(chain.steps.at(-1).loc));
        assert.ok(
            completionGateFromData(chain, gates) >= terminalGate,
            `${chain.id}: 완주 게이트가 종착 게이트보다 낮다`,
        );
    }
});

// ── 역전 인구조사 — 이 측정 오류가 실제로 몇 개를 잘못 매겼는가 ─────────────
// 스텝 게이트가 단조 증가하지 않는 체인은 3개지만, 그중 **완주 게이트를 바꾸는**
// 것은 1개(`forgotten_god`)뿐이다 — 나머지 둘(`machine_uprising` 32→18→32,
// `rift_secret` 68→62→68)은 종착이 곧 max라 종착으로 매겨도 값이 같았다.
// 그래서 Wave 14는 `forgotten_god` 하나만 교정 대상으로 다룬다.

test('역전 스텝을 가진 체인은 3개이고, 그중 완주 게이트가 달라지는 것은 1개다', () => {
    const gates = routeGates();
    const reversed = [];
    const gateChanging = [];

    for (const chain of EVENT_CHAINS) {
        const levels = chain.steps.map((step) => Number(gates.get(step.loc)));
        if (levels.some((level, index) => index > 0 && levels[index - 1] > level)) {
            reversed.push(chain.id);
        }
        if (Math.max(...levels) !== levels.at(-1)) gateChanging.push(chain.id);
    }

    assert.deepEqual(reversed.toSorted(), ['forgotten_god', 'machine_uprising', 'rift_secret']);
    assert.deepEqual(gateChanging, ['forgotten_god']);
});

test('forgotten_god의 과소 계상 폭은 종착 게이트와 완주 게이트의 비용 차다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === 'forgotten_god');

    const terminalGate = Number(gates.get(chain.steps.at(-1).loc));
    const span = cost.eventChainSpans.find((entry) => entry.chain === 'forgotten_god');
    assert.equal(terminalGate, 48);
    assert.equal(span.completionGateLevel, 68);

    const terminalCost = cost.gates.eventChainTerminals.find((entry) => entry.gateLevel === terminalGate);
    const understatedHours = Math.round(
        (span.completionCost.modeledHours - terminalCost.cost.modeledHours) * 100,
    ) / 100;
    assert.equal(terminalCost.cost.modeledHours, 53.28);
    assert.equal(span.completionCost.modeledHours, 170.23);
    assert.equal(understatedHours, 116.95);
});

// ── (3) cost.eventChainSpans — 열림과 완주 사이의 거리 ──────────────────────
// 종착 게이트 하나로는 "이 이야기가 언제 시작되어 언제 끝나는가"가 안 보인다.
// 그 간격 안에 리셋(승천 Lv48 ≈ 53.28h)이 들어 있는지를 이 행들이 보여 준다.

test('cost.eventChainSpans는 체인 13개의 열림/완주를 비용과 함께 싣는다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();

    assert.equal(cost.eventChainSpans.length, 13);
    assert.equal(
        cost.eventChainSpans.length,
        cost.gates.eventChainTerminals.reduce((sum, bucket) => sum + bucket.count, 0),
    );
    assert.deepEqual(
        cost.eventChainSpans.map((span) => span.chain).toSorted(),
        EVENT_CHAINS.map((chain) => chain.id).toSorted(),
    );

    for (const span of cost.eventChainSpans) {
        const chain = EVENT_CHAINS.find((candidate) => candidate.id === span.chain);
        assert.equal(span.steps, chain.steps.length);
        assert.equal(span.openGateLevel, Number(gates.get(chain.steps[0].loc)));
        assert.equal(span.completionGateLevel, completionGateFromData(chain, gates));
        // max의 정의상 열림은 완주를 넘을 수 없다.
        assert.ok(span.openGateLevel <= span.completionGateLevel);
        // 비용 행은 자기 레벨을 들고 있어 리포트 밖을 안 보고 읽을 수 있다.
        assert.equal(span.openCost.level, span.openGateLevel);
        assert.equal(span.completionCost.level, span.completionGateLevel);
    }
});

test('승천 이전에 열리고 그 뒤에 완주되는 체인 4개가 리포트에 드러난다', () => {
    const { cost } = buildContentReachabilityReport();
    const ascensionGate = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성'));
    assert.equal(ascensionGate.gateLevel, 48);

    const straddling = cost.eventChainSpans
        .filter((span) => span.openGateLevel < ascensionGate.gateLevel
            && span.completionGateLevel > ascensionGate.gateLevel)
        .map((span) => [span.chain, span.openCost.modeledHours, span.completionCost.modeledHours])
        .toSorted((left, right) => left[1] - right[1]);

    // 이 넷은 리셋 지점의 양쪽에 걸쳐 있다 — 진행도를 이월하지 않으면
    // 플레이어는 시작한 이야기를 끝내기 전에 매번 0으로 돌아간다
    // (그 이월은 tests/permanent-progress-copy.test.js가 고정한다).
    assert.deepEqual(straddling, [
        ['ancient_prophecy', 2.05, 170.23],
        ['dragon_legacy', 2.73, 170.23],
        ['forgotten_god', 5.23, 170.23],
        ['world_tree_corruption', 21.08, 170.23],
    ]);
    // 전부 승천(53.28h)보다 일찍 열리고 전부 그보다 늦게 끝난다.
    for (const [, openHours, completionHours] of straddling) {
        assert.ok(openHours < ascensionGate.cost.modeledHours);
        assert.ok(completionHours > ascensionGate.cost.modeledHours);
    }
});

test('스텝 지역을 하나라도 못 읽으면 완주 게이트는 max가 아니라 미상이다', () => {
    // 남은 스텝만으로 max를 취하면 비용을 조용히 과소 계상한다 — 그래서 fail-closed다.
    const maps = Object.fromEntries(
        Object.entries(structuredClone(DB.MAPS)).filter(([name]) => name !== '에테르 관문'),
    );
    for (const map of Object.values(maps)) {
        map.exits = (map.exits || []).filter((exit) => exit !== '에테르 관문');
    }
    const { cost } = buildContentReachabilityReport({ ...DB, MAPS: maps });

    const unreachable = cost.unresolvedEventChainTerminals;
    assert.ok(unreachable.includes('forgotten_god'), '중간 스텝이 사라진 체인이 미상으로 잡혀야 한다');
    for (const chain of unreachable) {
        assert.equal(cost.eventChainSpans.some((span) => span.chain === chain), false);
        assert.equal(
            cost.gates.eventChainTerminals.some((bucket) => bucket.members.includes(chain)),
            false,
        );
    }
});
