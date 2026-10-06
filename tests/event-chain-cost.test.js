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

test('cost.gates.eventChainCompletions는 전 스텝 max(완주 게이트)로 버킷을 만든다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();

    for (const chain of EVENT_CHAINS) {
        const bucket = cost.gates.eventChainCompletions.find((entry) => entry.members.includes(chain.id));
        // 2026-10 Wave 62 C17: 층 조건(`minAbyssFloor`) 스텝을 가진 체인은 지역 게이트로 값을 매길 수 없다 — 버킷이 아니라 층 조건 목록이다.
        if (chain.steps.some((step) => 'minAbyssFloor' in step)) {
            assert.equal(bucket, undefined, `${chain.id}: 층 조건 체인이 지역 게이트 버킷에 들어간다`);
            assert.ok(cost.floorGatedEventChains.some((entry) => entry.chain === chain.id), `${chain.id}: 층 조건 목록에 없다`);
            continue;
        }
        assert.ok(bucket, `${chain.id}가 버킷에 없다`);
        assert.equal(
            bucket.gateLevel,
            completionGateFromData(chain, gates),
            `${chain.id}의 게이트가 완주 게이트가 아니다`,
        );
    }

    // 2026-09 Wave 15 G1: 승천을 걸치던 스텝 4개를 루프 안으로 옮겼다
    //   (ancient_prophecy:2 → 마왕성 48 · dragon_legacy:2 → 천공 정원 40 ·
    //    world_tree_corruption:1 → 천공 정원 40 · :2 → 세계수 숲 40).
    //   버킷 수는 6 그대로이고 23·32·35도 그대로다 — 움직인 것은 40·48·68뿐이다.
    // 2026-09 Wave 27 N3: 경로 게이트가 실제 이동 규칙(시즌 없음)이 되자 북부 권역이 전부 Lv35다 —
    //   water_apostle(호수의 신전 5 → 사막 오아시스 · 피라미드 23 → 35)과 machine_uprising(기계 폐도 ·
    //   북부 요새 32 → 35)이 35 버킷으로 합류해 23·32 버킷이 사라지고 35가 1 → 3이 된다(6 → 4버킷).
    //   40·48·68은 그대로다 — 셋 다 승천 지점(48) 이하라 걸치는 체인은 여전히 0개다.
    assert.deepEqual(
        cost.gates.eventChainCompletions.map(({ gateLevel, count }) => [gateLevel, count]),
        // 2026-10 Wave 62 C17: 48의 다섯 중 심연의 신호가 층 조건 목록으로 빠진다 — 48:5 → 48:4.
        [[35, 3], [40, 3], [48, 4], [68, 2]],
    );
    assert.deepEqual(
        cost.gates.eventChainCompletions.find((bucket) => bucket.gateLevel === 35).members,
        ['last_hero', 'machine_uprising', 'water_apostle'],
    );
    // 68에 남는 둘은 애초에 승천 **뒤에** 열리는 체인이다(열림 65.90h / 170.23h) —
    // 걸치지 않으므로 옮기지 않는다. 이 둘이 68의 정상 상태다.
    assert.deepEqual(
        cost.gates.eventChainCompletions.find((bucket) => bucket.gateLevel === 68).members,
        ['divine_apostle_trial', 'rift_secret'],
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
// 것은 1개(`forgotten_god`)뿐이다 — 나머지 둘(`machine_uprising` 32→18→32 — Wave 27 N3 이후 35→18→35,
// `rift_secret` 68→62→68)은 종착이 곧 max라 종착으로 매겨도 값이 같았다.
// 그래서 Wave 14는 `forgotten_god` 하나만 교정 대상으로 다룬다.

// 2026-09 Wave 14 F2 stage(ii): forgotten_god의 스텝 역전을 교정해(에테르 관문 68 → 지하 미궁 44)
//   역전은 3개 → 2개가 됐고, 그 둘은 종착 스텝이 이미 max라 완주 게이트가 종착 게이트와 같다.
//   즉 "역전이 남아 있어도 전 스텝 max로 재면 정확하다"가 지금 고정하는 내용이다 — 역전 자체가
//   결함이 아니라 '완주 게이트 ≠ 종착 게이트'가 결함이었다.
test('역전 스텝을 가진 체인은 2개이고, 그중 완주 게이트가 달라지는 것은 0개다', () => {
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

    assert.deepEqual(reversed.toSorted(), ['machine_uprising', 'rift_secret']);
    assert.deepEqual(gateChanging, []);
});

// 2026-09 Wave 14 F2 stage(ii): 이 칸은 원래 "과소 계상 폭 116.95h"를 고정했다 — 리포트가
//   forgotten_god을 종착 게이트(48)로 적고 있었기 때문이다. 스텝 역전을 교정해 완주 게이트가
//   48이 된 지금 그 폭은 0이고, 고정할 값이 바뀌었다: **체인이 루프 안에서 닫힌다**.
//   측정만 고쳤을 때(stage i)의 68은 참이었지만 설계 의도가 아니었다 — 중간 스텝이 게임에서
//   가장 깊은 맵에 있고 종착이 더 얕은 것은 데이터 입력 오류였다.
// Wave 28(D7): 초반 완전 정예가 빠져 성장 모델 앵커가 +2~5 액션 움직였다 — 아래 시간값은 그 뒤의 값이다
//   (게이트 레벨과 체인 구조는 그대로다). Wave 29: 보스 필드 14곳의 일반 스폰이 보스가 아니게 되어 기준 시드의
//   앵커가 한 번 더 움직였다(64시드 평균 ±0.1% — 기준 시드의 잡음, 원장 §29).
// Wave 61: 보스 6종이 지역 조우에 들어가 Lv25 이후 앵커가 −1 ~ −3% 움직였다(64시드 평균 — 실제 이동, 원장 §62).
// Wave 71: 종 이름과 겹치는 접두어를 빼서 기준 시드의 Lv10 이후 앵커가 1액션씩 움직였다(64시드 평균 +0.00 ~ 0.39%, 원장 §74).
test('forgotten_god은 승천 지점 안에서 닫힌다 — 열림 5.25h, 완주 53.18h', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === 'forgotten_god');

    // 스텝 게이트가 단조 비감소다 — 중간 스텝이 종착보다 깊지 않다.
    const levels = chain.steps.map((step) => Number(gates.get(step.loc)));
    assert.deepEqual(levels, [25, 44, 48]);

    const span = cost.eventChainSpans.find((entry) => entry.chain === 'forgotten_god');
    assert.equal(span.completionGateLevel, Number(gates.get(chain.steps.at(-1).loc)));
    assert.equal(span.completionGateLevel, 48);
    assert.equal(span.openCost.modeledHours, 5.25);
    assert.equal(span.completionCost.modeledHours, 53.18);

    // 마왕성 경로 게이트(승천 지점)와 같은 칸이다 — 리셋이 완주를 가로막지 않는다.
    const demonCastle = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성'));
    assert.equal(span.completionGateLevel, demonCastle.gateLevel);
});

// ── (3) cost.eventChainSpans — 열림과 완주 사이의 거리 ──────────────────────
// 종착 게이트 하나로는 "이 이야기가 언제 시작되어 언제 끝나는가"가 안 보인다.
// 그 간격 안에 리셋(승천 Lv48 ≈ 53.28h)이 들어 있는지를 이 행들이 보여 준다.

test('cost.eventChainSpans는 값을 매기는 체인 12개의 열림/완주를 비용과 함께 싣는다 (심연의 신호 = 층 조건)', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = routeGates();

    // Wave 62 C17: 13개 중 심연의 신호는 층 조건 때문에 값을 매기지 않는다 — 구간 행은 값을 매기는 12개다.
    assert.equal(cost.eventChainSpans.length, 12);
    assert.equal(
        cost.eventChainSpans.length,
        cost.gates.eventChainCompletions.reduce((sum, bucket) => sum + bucket.count, 0),
    );
    assert.deepEqual(
        [...cost.eventChainSpans.map((span) => span.chain), ...cost.floorGatedEventChains.map((entry) => entry.chain)].toSorted(),
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

// 2026-09 Wave 15 G1: 걸쳐 있던 셋(`ancient_prophecy` 2.05h→170.23h · `dragon_legacy`
//   2.73h→170.23h · `world_tree_corruption` 21.08h→170.23h)의 스텝 4개를 루프 안으로
//   옮겨 **걸치는 체인이 0개**가 됐다. Wave 14 F2의 진행도 이월은 여전히 유효하지만
//   (승천은 레벨 게이트가 아니라 플레이어가 고르는 시점이라 체인을 열어 둔 채 승천하는
//   런은 여전히 가능하다 — `tests/permanent-progress-copy.test.js`가 고정한다),
//   "자기 런 안에서 닫히는 이야기"가 0개에서 11개가 됐다.
test('승천 지점을 걸치는 체인이 0개다 — 값을 매기는 12개 전부 루프 안에서 닫히거나 승천 뒤에 열린다', () => {
    const { cost } = buildContentReachabilityReport();
    const ascensionGate = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성'));
    assert.equal(ascensionGate.gateLevel, 48);

    const straddling = cost.eventChainSpans
        .filter((span) => span.openGateLevel < ascensionGate.gateLevel
            && span.completionGateLevel > ascensionGate.gateLevel)
        .map((span) => span.chain);
    assert.deepEqual(straddling, []);

    // 옮긴 셋은 승천 지점 **이하**에서 닫힌다 — 셋 다 열림 비용은 한 자리도 안 움직였다.
    const spanOf = (chain) => cost.eventChainSpans.find((span) => span.chain === chain);
    assert.deepEqual(
        ['ancient_prophecy', 'dragon_legacy', 'world_tree_corruption'].map((chain) => {
            const span = spanOf(chain);
            return [chain, span.openCost.modeledHours, span.completionGateLevel, span.completionCost.modeledHours];
        }),
        [
            ['ancient_prophecy', 2.18, 48, 53.18],
            ['dragon_legacy', 2.83, 40, 21.05],
            ['world_tree_corruption', 21.05, 40, 21.05],
        ],
    );

    // 값을 매기는 12개 전부가 같은 이분법에 들어간다: 승천 이하에서 닫히거나(10개),
    // 애초에 승천 뒤에 열린다(2개 — divine_apostle_trial · rift_secret).
    // 2026-10 Wave 62 C17: 심연의 신호는 이 이분법 밖이다 — 1 · 2단계가 혼돈의 심연 50층(돌파 49층)을 요구하고 이 모델에는
    //   심연 층 진행이 없다(`floorGatedEventChains`). 돌파 층은 사망 · 계승을 넘어 유지되므로 계승을 걸쳐도 진행이 사라지지 않는다.
    const closesInLoop = cost.eventChainSpans
        .filter((span) => span.completionGateLevel <= ascensionGate.gateLevel)
        .map((span) => span.chain);
    const opensAfterAscension = cost.eventChainSpans
        .filter((span) => span.openGateLevel > ascensionGate.gateLevel)
        .map((span) => span.chain)
        .toSorted();
    assert.equal(closesInLoop.length, 10);
    assert.deepEqual(opensAfterAscension, ['divine_apostle_trial', 'rift_secret']);
    assert.equal(closesInLoop.length + opensAfterAscension.length, cost.eventChainSpans.length);
    assert.deepEqual(cost.floorGatedEventChains.map((entry) => entry.chain), ['abyss_signal']);
    assert.deepEqual(cost.unresolvedEventChainCompletions, []);
    assert.equal(cost.eventChainSpans.length + cost.floorGatedEventChains.length, EVENT_CHAINS.length);
});

// 2026-09 Wave 27 N3: 북부 권역을 지나는 두 체인의 구간 — 경로 게이트가 실제 이동 규칙(시즌 없음)이 되자
//   machine_uprising은 8.9h → 12h에 열리고 닫히며, water_apostle은 열림(호수의 신전 5 · 1.3h)은 그대로이고
//   완주가 4.68h(23) → 12h(35)로 늦어진다. 둘 다 승천 지점(48 · 53.28h) 안에서 닫힌다.
test('북부 권역 체인 둘은 Lv35(12h)에 완주되고 여전히 승천 전에 닫힌다', () => {
    const { cost } = buildContentReachabilityReport();
    const spanOf = (chain) => cost.eventChainSpans.find((span) => span.chain === chain);
    assert.deepEqual(
        ['machine_uprising', 'water_apostle'].map((chain) => {
            const span = spanOf(chain);
            return [chain, span.openGateLevel, span.openCost.modeledHours, span.completionGateLevel, span.completionCost.modeledHours];
        }),
        [
            ['machine_uprising', 35, 12, 35, 12],
            ['water_apostle', 5, 1.4, 35, 12],
        ],
    );
    // 기준 ②(종착이 곧 완주 게이트)는 그대로다 — machine_uprising 35 → 18 → 35의 종착이 max다.
    const gates = routeGates();
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === 'machine_uprising');
    assert.deepEqual(chain.steps.map((step) => gates.get(step.loc)), [35, 18, 35]);
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

    // 2026-09 Wave 14 F2 stage(ii): forgotten_god이 더 이상 에테르 관문을 쓰지 않으므로
    //   같은 맵을 종착으로 쓰는 체인들로 이 불변식을 고정한다 — 어떤 체인이든 스텝 하나를
    //   못 읽으면 남은 스텝의 max가 아니라 '미상'이어야 한다는 것이 요점이다.
    const unreachable = cost.unresolvedEventChainCompletions;
    assert.ok(unreachable.length > 0, '스텝 지역이 사라진 체인이 미상으로 잡혀야 한다');
    assert.ok(unreachable.includes('rift_secret'), '에테르 관문을 쓰는 체인이 미상이어야 한다');
    for (const chain of unreachable) {
        assert.equal(cost.eventChainSpans.some((span) => span.chain === chain), false);
        assert.equal(
            cost.gates.eventChainCompletions.some((bucket) => bucket.members.includes(chain)),
            false,
        );
    }
});
