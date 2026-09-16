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

// ── ⑤ 액션·UI 계약 (정적 가드) ────────────────────────────────────────────
test('⑤ exploreActions.scout은 골드 차감과 보스 게이지 1칸을 같은 전이로 처리한다', async () => {
    const source = await readFile(new URL('../src/hooks/gameActions/exploreActions.ts', import.meta.url), 'utf8');

    assert.match(source, /scout: \(\) => \{/);
    assert.match(source, /getScoutAvailability\(player, mapData, gameState === GS\.IDLE\)/);
    assert.match(source, /advanceBossGauge\(/, '정찰도 시간이 흐른 것으로 처리한다');
    assert.match(source, /consumeScoutCharge/);
    assert.match(source, /buildScoutEvent\(player, mapData, rng\)/, '같은 카드 빌더를 재사용한다');
    assert.match(source, /shouldTriggerScout\(mapData, rng\)/, '랜덤 25% 발동은 유지된다');
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
