import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { RELICS, pickWeightedRelics } from '../src/data/relics.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { pickFallbackEvent } from '../src/utils/aiEventUtils.js';
import { rollExplorationEvent } from '../src/utils/exploreUtils.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { buildScoutEvent } from '../src/utils/scoutEvents.ts';

/**
 * 관대함(generosity) 하향 (2026-07 밸런스 감사) — 로그라이크의 "적당한 불친절함" 복원.
 * "좋은 이벤트나 뛰어난 보너스의 확률을 줄이자" — 파워는 그라인드/행운이 아니라
 * 선택과 숙련에서 나와야 한다는 B+ 철학의 연장. 4개 하향 항목의 계약 테스트:
 *   ① 시작 부트 풀 rarityCap ② 캠프파이어 단련 하향 ③ structured 혼합률 하향
 *   ④ 이상 신호 anomaly 가중 ⑤ 이벤트 보상 상한 계약
 */

// ── ① 시작 부트 유물 등급 제한 (epic/legendary 제외) ────────────────────────

test('BALANCE.START_BOOT_RARITY_CAP는 rare로 고정', () => {
    assert.equal(BALANCE.START_BOOT_RARITY_CAP, 'rare');
});

test('pickWeightedRelics: rarityCap="rare" 전달 시 epic/legendary는 절대 후보에 포함되지 않음 (풀 전수 스윕)', () => {
    // Math.random 전 구간(0~1)을 촘촘히 스윕해 가중 추첨 경로 전체를 커버.
    const steps = 200;
    for (let i = 0; i < steps; i += 1) {
        const rand = i / steps;
        const orig = Math.random;
        Math.random = () => rand;
        try {
            const picked = pickWeightedRelics(RELICS, RELICS.length, { rarityCap: BALANCE.START_BOOT_RARITY_CAP });
            for (const relic of picked) {
                assert.notEqual(relic.rarity, 'epic', `rand=${rand}에서 epic 유물이 선택됨: ${relic.name}`);
                assert.notEqual(relic.rarity, 'legendary', `rand=${rand}에서 legendary 유물이 선택됨: ${relic.name}`);
            }
        } finally {
            Math.random = orig;
        }
    }
});

test('pickWeightedRelics: rarityCap 미전달(기존 호출부) 시 epic/legendary도 여전히 후보 가능 (하위호환)', () => {
    const epicOrLegendary = RELICS.filter((r) => r.rarity === 'epic' || r.rarity === 'legendary');
    assert.ok(epicOrLegendary.length > 0, '픽스처 전제: epic/legendary 유물이 존재해야 함');

    // 큰 count로 여러 번 뽑아 최소 1회는 epic/legendary가 섞여 나오는지 확인 (결정론적 시드 스윕).
    let sawHighRarity = false;
    for (let i = 0; i < 50 && !sawHighRarity; i += 1) {
        const rand = i / 50;
        const orig = Math.random;
        Math.random = () => rand;
        try {
            const picked = pickWeightedRelics(RELICS, 10);
            if (picked.some((r) => r.rarity === 'epic' || r.rarity === 'legendary')) sawHighRarity = true;
        } finally {
            Math.random = orig;
        }
    }
    assert.ok(sawHighRarity, 'rarityCap 미전달 시 기존처럼 epic/legendary도 뽑힐 수 있어야 함');
});

test('characterActions.start: 시작 부트 유물 후보에 epic/legendary가 없음 (통합 배선 검증)', () => {
    const dispatches = [];
    const deps = {
        player: { meta: {}, stats: {} },
        gameState: 'idle',
        dispatch: (a) => dispatches.push(a),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
    };
    const actions = createCharacterActions(deps, { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} });

    // 여러 시드로 반복 — pity/가중 추첨 경로가 실행되어도 캡이 항상 적용되는지 확인.
    for (let i = 0; i < 30; i += 1) {
        dispatches.length = 0;
        const rand = i / 30;
        const orig = Math.random;
        Math.random = () => rand;
        try {
            actions.start('테스터', 'male', '모험가', []);
        } finally {
            Math.random = orig;
        }
        const pending = dispatches.find((d) => d.type === 'SET_PENDING_RELICS');
        if (!pending) continue;
        for (const relic of pending.payload) {
            assert.notEqual(relic.rarity, 'epic', `시작 부트에서 epic 유물 노출: ${relic.name}`);
            assert.notEqual(relic.rarity, 'legendary', `시작 부트에서 legendary 유물 노출: ${relic.name}`);
        }
    }
});

// ── ② 캠프파이어 단련 버프 하향 (+40% → +30%) ────────────────────────────────

test('BALANCE.CAMPFIRE_FORGE_ATK는 0.3으로 하향 (기존 0.4)', () => {
    assert.equal(BALANCE.CAMPFIRE_FORGE_ATK, 0.3);
});

test('BALANCE.CAMPFIRE_HEAL_RATIO는 0.4로 유지 (회복은 하향 대상 아님)', () => {
    assert.equal(BALANCE.CAMPFIRE_HEAL_RATIO, 0.4);
});

test('buildCampfireEvent: 단련 outcome의 buff.atk가 하향된 CAMPFIRE_FORGE_ATK(0.3)를 반영', () => {
    const ev = buildCampfireEvent({ maxHp: 200, maxMp: 100 });
    const forge = ev.outcomes[1];
    assert.equal(forge.buff.atk, 0.3);
    assert.equal(forge.buff.atk, BALANCE.CAMPFIRE_FORGE_ATK);
});

// ── ③ 구조화 이벤트 혼합률 하향 (30% → 22%, 상수화) ──────────────────────────

test('BALANCE.STRUCTURED_EVENT_MIX는 0.22로 상수화 (기존 0.3 하드코딩)', () => {
    assert.equal(BALANCE.STRUCTURED_EVENT_MIX, 0.22);
});

test('pickFallbackEvent: STRUCTURED_EVENT_MIX 미만 롤에서만 구조화 이벤트(NPC/도박/퍼즐)가 섞임', () => {
    const orig = Math.random;
    const structuredDescs = /운명의 주사위|보물 상자|행상인|신참 전사|카드 트릭|마력 공명|크리스탈/;
    try {
        // 혼합률 경계 바로 아래(mix 통과) 고정 + 후보 선택 인덱스만 호출마다 회전시켜
        // structured 풀 쪽 인덱스도 실제로 샘플링되도록 한다 (mix 판정과 선택 롤은 서로
        // 다른 Math.random() 호출이므로 분리 필요).
        let sawStructured = false;
        for (let i = 0; i < 40 && !sawStructured; i += 1) {
            let call = 0;
            Math.random = () => {
                call += 1;
                return call === 1 ? BALANCE.STRUCTURED_EVENT_MIX - 0.001 : (i / 40);
            };
            const event = pickFallbackEvent('시험지', [], { playerSnapshot: { level: 5, maxHp: 150, maxMp: 60 } });
            if (event && structuredDescs.test(event.desc)) {
                sawStructured = true;
            }
        }
        assert.ok(sawStructured, '혼합률 미만 롤에서 structured 이벤트가 최소 1회는 나와야 함');
    } finally {
        Math.random = orig;
    }
});

// ── ④ 정찰 "이상 신호" anomaly 가중 배선 ─────────────────────────────────────

test('BALANCE.SCOUT_SIGNAL_ANOMALY_MULT는 1.5로 설정', () => {
    assert.equal(BALANCE.SCOUT_SIGNAL_ANOMALY_MULT, 1.5);
});

test('rollExplorationEvent: anomalyMult 전달 시 anomaly 발생 확률이 그만큼 가중됨 (경계값 비교)', () => {
    const mapData = { type: 'dungeon', level: 5 };
    const player = { loc: '고요한 숲', inv: [], stats: {}, meta: {} };
    const deps = { dispatch: () => {}, addLog: () => {}, getFullStats: () => ({ maxHp: 100, maxMp: 50 }) };

    // baseline anomalyChance는 player/mapData로 결정론적 — 그 값의 1.2배 지점(가중 없음 미발동,
    // 가중 있음 발동)에 Math.random을 고정해 배선을 검증.
    const orig = Math.random;
    try {
        // ANOMALY_BASE_CHANCE(0.12) 근방 값으로, base 미만이지만 base*1.5 이상은 아닌 지점을 사용.
        const probe = BALANCE.ANOMALY_BASE_CHANCE * 1.2;
        Math.random = () => probe;
        const withoutMult = rollExplorationEvent(player, mapData, [], deps);
        Math.random = () => probe;
        const withMult = rollExplorationEvent(player, mapData, [], { ...deps, anomalyMult: BALANCE.SCOUT_SIGNAL_ANOMALY_MULT });

        assert.notEqual(withoutMult, 'anomaly', '가중 없이는 probe 지점에서 anomaly 미발동');
        assert.equal(withMult, 'anomaly', '가중 있으면 동일 probe 지점에서 anomaly 발동');
    } finally {
        Math.random = orig;
    }
});

test('handleScoutChoice: "이상 신호"(scoutEffect=anomaly) 선택 시 rollExplorationEvent에 SCOUT_SIGNAL_ANOMALY_MULT가 배선됨', () => {
    const ev = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    const dispatches = [];
    const deps = {
        player: {
            hp: 100, mp: 20, maxHp: 100, maxMp: 20,
            loc: '고요한 숲', level: 1, relics: [], quests: [], history: [], stats: {}, meta: {},
        },
        currentEvent: ev,
        dispatch: (a) => dispatches.push(a),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 100, maxMp: 20 }),
    };
    const shared = {
        emitUnlockedTitles: () => {},
        commitExploreOutcome: (outcome, transform) => {
            dispatches.push({ type: 'COMMIT_EXPLORE_OUTCOME', payload: outcome });
            if (typeof transform === 'function') transform(deps.player);
        },
    };
    const actions = createEventActions(deps, shared);

    // ANOMALY_BASE_CHANCE(0.12)*1.2 = 0.144 는 base 미만에서 미발동하지만 ×1.5 가중(0.18) 시 발동하는 지점.
    const probe = BALANCE.ANOMALY_BASE_CHANCE * 1.2;
    const orig = Math.random;
    Math.random = () => probe;
    try {
        actions.handleEventChoice(1); // 이상 신호 카드 (choiceIndex 1)
    } finally {
        Math.random = orig;
    }

    const commit = [...dispatches].reverse().find((d) => d.type === 'COMMIT_EXPLORE_OUTCOME');
    assert.ok(commit, 'COMMIT_EXPLORE_OUTCOME dispatch 존재');
    assert.equal(commit.payload, 'anomaly', '가중된 anomalyMult 덕에 probe 지점에서 anomaly가 발동해야 함');
});

// ── ⑤ 이벤트 보상 상한 계약 (재발 방지 가드) ─────────────────────────────────

test('구조화 이벤트 보상 상한 계약: gold ≤ STRUCTURED_EVENT_GOLD_CAP, exp ≤ 100', () => {
    const orig = Math.random;
    const seenGold = [];
    const seenExp = [];
    try {
        for (let i = 0; i < 60; i += 1) {
            let call = 0;
            Math.random = () => {
                call += 1;
                return call === 1 ? BALANCE.STRUCTURED_EVENT_MIX - 0.001 : (i / 60);
            };
            const event = pickFallbackEvent('시험지', [], { playerSnapshot: { level: 5, maxHp: 150, maxMp: 60 } });
            if (!event) continue;
            for (const outcome of event.outcomes) {
                if (outcome.gold) seenGold.push(outcome.gold);
                if (outcome.exp) seenExp.push(outcome.exp);
            }
        }
    } finally {
        Math.random = orig;
    }

    assert.ok(seenGold.length > 0, '픽스처 전제: 최소 1건의 gold 보상이 관측되어야 함');
    for (const gold of seenGold) {
        assert.ok(gold <= BALANCE.STRUCTURED_EVENT_GOLD_CAP, `gold(${gold})가 상한(${BALANCE.STRUCTURED_EVENT_GOLD_CAP})을 초과함`);
    }
    for (const exp of seenExp) {
        assert.ok(exp <= 100, `exp(${exp})가 상한(100)을 초과함`);
    }
});

test('BALANCE.STRUCTURED_EVENT_GOLD_CAP(720)은 하향 전 최댓값(1000)보다 작음 (회귀 가드)', () => {
    assert.ok(BALANCE.STRUCTURED_EVENT_GOLD_CAP < 1000);
    assert.ok(BALANCE.STRUCTURED_EVENT_GOLD_CAP >= 600, '과도한 하향 방지 — 여전히 유의미한 보상이어야 함');
});
