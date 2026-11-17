import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.ts';
import {
    buildFieldMimic,
    getFieldChestReward,
    getFieldMimicHpMult,
    getFieldRegionMaterials,
    grantFieldChestReward,
    isFieldChestMimic,
    pickFieldMimicGear,
    settleFieldMimicVictory,
} from '../src/systems/fieldChest.ts';
import { createFieldActions } from '../src/hooks/gameActions/fieldActions.ts';
import { canEquip } from '../src/utils/equipmentValidation.ts';
import { MSG } from '../src/data/messages.ts';
import { getFieldAutoAvailability, getFieldAutoButtonText, getFieldAutoLockText } from '../src/utils/fieldAuto.ts';
import { getSellPrice } from '../src/utils/equipmentUtils.ts';
import { findItemByName, makeItem } from '../src/utils/gameUtils.ts';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity.ts';
import { generateFieldMap } from '../src/systems/fieldMapGen.ts';
import {
    createFieldMapState,
    getFieldMapLayout,
    getFieldNeighbor,
} from '../src/systems/fieldMapWalk.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';

// 2026-11 지역 지도 걷기 — 설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §9 계약 5 ~ 10(리듀서 전이 · 범위 · 미믹 · 자동 탐험).

const LOC = BALANCE.FIELD_MAP_REGIONS[0];
const MAP = DB.MAPS[LOC];
const NOW = Date.UTC(2026, 10, 13, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const clone = (value) => structuredClone(value);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const basePlayer = (overrides = {}) => {
    const player = {
        ...clone(INITIAL_STATE.player),
        name: '걷는 사람',
        job: '전사',
        level: 10,
        loc: LOC,
        hp: 500,
        maxHp: 500,
        mp: 100,
        maxMp: 100,
        inv: [],
        ...overrides,
    };
    return { ...player, fieldMap: overrides.fieldMap === undefined ? createFieldMapState(player, LOC, MAP) : overrides.fieldMap };
};

const stateOf = (player, extra = {}) => ({ ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player, ...extra });

/** 상자 칸 옆 빈 칸에 세우고, 상자로 걸어갈 방향을 돌려준다. */
const besideChest = (field, layout, chest) => {
    for (const direction of ['up', 'down', 'left', 'right']) {
        const next = getFieldNeighbor(layout, chest.index, direction);
        if (next === null || layout.chests.some((other) => other.index === next) || layout.exits.some((exit) => exit.index === next)) continue;
        return { field: { ...field, pos: next, visited: [...new Set([...field.visited, next])].sort((a, b) => a - b) }, direction: OPPOSITE[direction] };
    }
    throw new Error('상자 옆에 설 칸이 없다');
};

/** 미믹 상자가 있는 지도 시드를 찾는다(해시라 결정론). */
const findMimicSeed = () => {
    for (let seed = 1; seed < 20000; seed += 1) {
        const layout = generateFieldMap(LOC, seed, MAP.level, MAP.exits ?? []);
        const chest = layout.chests.find((entry) => isFieldChestMimic(LOC, seed, entry.id));
        if (chest) return { seed, chest };
    }
    throw new Error('미믹 상자가 있는 시드가 없다');
};

const withThrowingRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('지도 판정은 Math.random을 쓰지 않는다'); };
    try {
        return run();
    } finally {
        Math.random = original;
    }
};

test('계약 5: 지도 · 처리할 일은 player 안이라 세이브 봉투로 복원된다(조우 · 미믹 처리할 일 포함)', () => {
    const { seed, chest } = findMimicSeed();
    const fresh = basePlayer();
    const player = basePlayer({ fieldMap: { ...fresh.fieldMap, seed, openedChests: [chest.id], pending: { kind: 'mimic', chestId: chest.id } } });
    const loaded = gameReducer(clone(INITIAL_STATE), {
        type: AT.LOAD_DATA,
        payload: { player: clone(player), gameState: GS.IDLE, enemy: null, quickSlots: [] },
    });
    assert.deepEqual(loaded.player.fieldMap, player.fieldMap, '지도는 그대로 돌아온다');
    assert.equal(loaded.gameState, GS.IDLE);
});

test('계약 6: 지도 · 클리어 기록은 여정 범위, 그날 쓴 자동 탐험 횟수는 계정 범위다', () => {
    const autoRuns = { day: getProtocolDayKey(new Date(NOW)), used: 2 };
    const player = basePlayer({
        fieldClearedRegions: [LOC],
        stats: { ...clone(INITIAL_STATE.player.stats), fieldAutoRuns: autoRuns },
        meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'k' } },
    });
    const died = CombatEngine.handleDefeat(clone(player), clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    const reset = gameReducer(stateOf(clone(player)), { type: AT.RESET_GAME }).player;
    const ascended = gameReducer(
        stateOf(clone(player), { gameState: GS.ASCENSION }),
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'k', seed: 1, challengeModifiers: [] } },
    ).player;
    for (const [label, next] of [['사망', died], ['다시 시작', reset], ['계승', ascended]]) {
        assert.ok(!next.fieldMap, `${label}: 지도가 남지 않는다`);
        assert.deepEqual(next.fieldClearedRegions ?? [], [], `${label}: 클리어 기록이 남지 않는다`);
        assert.deepEqual(next.stats.fieldAutoRuns, autoRuns, `${label}: 그날 쓴 자동 탐험 횟수는 되돌아오지 않는다`);
    }
});

test('계약 7: 걷기 · 상자 · 미믹 판정은 게임 난수를 쓰지 않고 탐험 수 · 기세를 바꾸지 않는다', () => {
    const player = basePlayer();
    const layout = getFieldMapLayout(player.fieldMap, MAP);
    const state = stateOf(player);
    let current = state;
    withThrowingRandom(() => {
        for (const direction of ['up', 'up', 'left', 'right', 'down', 'up', 'up', 'up']) {
            current = gameReducer(current, { type: AT.FIELD_STEP, payload: { direction, auto: false, now: NOW } });
        }
        const chest = layout.chests[0];
        const placed = besideChest(current.player.fieldMap, layout, chest);
        current = gameReducer(
            { ...current, player: { ...current.player, fieldMap: { ...placed.field, pending: null } } },
            { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: false, now: NOW } },
        );
    });
    assert.equal(current.player.stats.explores, state.player.stats.explores, '걷기는 탐험 수를 세지 않는다(조우 = explore()가 센다)');
    assert.deepEqual(current.player.stats.difficultyNotice, state.player.stats.difficultyNotice);
    // 같은 지도 · 상자는 언제나 같은 미믹 여부 · 보상이다(다시 불러와 바꿀 수 없다).
    for (const chest of layout.chests) {
        assert.equal(isFieldChestMimic(LOC, player.fieldMap.seed, chest.id), isFieldChestMimic(LOC, player.fieldMap.seed, chest.id));
        assert.deepEqual(
            getFieldChestReward(LOC, MAP, player.fieldMap.seed, chest.id),
            getFieldChestReward(LOC, MAP, player.fieldMap.seed, chest.id),
        );
    }
});

test('계약 7: 미믹 비율은 상자의 약 2%다(해시 분포 — 고위험 고보상이라 드물다)', () => {
    let mimics = 0;
    const samples = 20000;
    for (let index = 0; index < samples; index += 1) {
        if (isFieldChestMimic(LOC, index * 7919 + 3, index % 7)) mimics += 1;
    }
    const rate = mimics / samples;
    assert.ok(Math.abs(rate - BALANCE.FIELD_MIMIC_CHANCE) < 0.005, `미믹 비율 ${rate}`);
});

test('계약 8: 손으로 연 미믹 상자는 미믹 처리할 일, 자동 탐험이 연 같은 상자는 보통 상자다', () => {
    const { seed, chest } = findMimicSeed();
    const fresh = basePlayer();
    const field = { ...fresh.fieldMap, seed };
    const layout = getFieldMapLayout(field, MAP);
    const placed = besideChest(field, layout, chest);
    const player = basePlayer({ fieldMap: placed.field });

    const manual = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: false, now: NOW } });
    assert.deepEqual(manual.player.fieldMap.pending, { kind: 'mimic', chestId: chest.id });
    assert.equal(manual.player.gold, player.gold, '미믹 상자는 열 때 보상을 주지 않는다');

    const auto = gameReducer(stateOf(player), { type: AT.FIELD_STEP, payload: { direction: placed.direction, auto: true, now: NOW } });
    assert.equal(auto.player.fieldMap.pending, null, '자동 탐험에는 미믹이 없다');
    assert.ok(auto.player.fieldMap.openedChests.includes(chest.id));
    assert.ok(auto.player.gold > player.gold, '보통 상자 보상을 받는다');

    const cleared = gameReducer(manual, { type: AT.FIELD_CLEAR_PENDING, payload: { kind: 'mimic' } });
    assert.equal(cleared.player.fieldMap.pending, null);
    const wrongKind = gameReducer(manual, { type: AT.FIELD_CLEAR_PENDING, payload: { kind: 'encounter' } });
    assert.equal(wrongKind, manual, '다른 종류는 지우지 않는다(동일 참조)');
});

test('처리할 일이 남아 있거나 대기 상태가 아니면 걷지 않는다(동일 참조)', () => {
    const player = basePlayer();
    const pending = stateOf(basePlayer({ fieldMap: { ...player.fieldMap, pending: { kind: 'encounter' } } }));
    for (const direction of ['up', 'down', 'left', 'right']) {
        assert.equal(gameReducer(pending, { type: AT.FIELD_STEP, payload: { direction, now: NOW } }), pending);
    }
    const combat = stateOf(player, { gameState: GS.COMBAT });
    assert.equal(gameReducer(combat, { type: AT.FIELD_STEP, payload: { direction: 'up', now: NOW } }), combat);
    const elsewhere = stateOf({ ...player, loc: CONSTANTS.START_LOCATION });
    assert.equal(gameReducer(elsewhere, { type: AT.FIELD_STEP, payload: { direction: 'up', now: NOW } }), elsewhere);
});

test('계약 9: 자동 탐험은 클리어한 지역에서만, 하루 무료 5 + 골드 1 + 크리스탈 3, 같은 지도의 이어 가기는 횟수 · 값을 쓰지 않는다', () => {
    const start = (state, now = NOW) => gameReducer(state, { type: AT.FIELD_AUTO_START, payload: { now } });
    const finish = (s) => ({ ...s, player: { ...s.player, fieldMap: { ...s.player.fieldMap, openedChests: getFieldMapLayout(s.player.fieldMap, MAP).chests.map((c) => c.id) } } });
    const uncleared = stateOf(basePlayer());
    assert.equal(start(uncleared), uncleared, '클리어하지 않은 지역은 거부한다');

    const level = 10;
    const goldCost = level * BALANCE.FIELD_AUTO_EXTRA_GOLD_PER_LEVEL;
    const crystalCosts = BALANCE.FIELD_AUTO_EXTRA_CRYSTAL_COSTS;
    const crystalTotal = crystalCosts.reduce((sum, cost) => sum + cost, 0);
    let state = stateOf(basePlayer({ level, fieldClearedRegions: [LOC], gold: goldCost + 7, premiumCurrency: crystalTotal + 3 }));
    const firstSeq = state.player.fieldMap.seq;
    state = start(state);
    assert.equal(state.player.fieldMap.autoRun, true);
    assert.equal(state.player.fieldMap.seq, firstSeq + 1, '새 지도에서 시작한다');
    assert.equal(state.player.stats.fieldAutoRuns.used, 1);

    const resumed = start(state);
    assert.equal(resumed, state, '상자가 남은 자동 탐험 지도에서는 다시 켜도 횟수를 쓰지 않는다');

    for (let used = 2; used <= BALANCE.FIELD_AUTO_RUNS_PER_DAY; used += 1) {
        state = start(finish(state));
        assert.equal(state.player.stats.fieldAutoRuns.used, used);
    }
    assert.equal(state.player.gold, goldCost + 7, '무료 횟수는 값을 내지 않는다');
    assert.equal(state.player.premiumCurrency, crystalTotal + 3);

    // 무료를 다 쓰면 골드 한 번 — 낼 수 없으면 거부한다.
    const broke = finish({ ...state, player: { ...state.player, gold: goldCost - 1 } });
    assert.equal(start(broke), broke, '골드가 모자라면 거부한다(동일 참조)');
    state = start(finish(state));
    assert.equal(state.player.gold, 7, '골드 한 번은 레벨 × 200');
    assert.equal(state.player.premiumCurrency, crystalTotal + 3);
    assert.equal(state.player.stats.fieldAutoRuns.used, BALANCE.FIELD_AUTO_RUNS_PER_DAY + 1);
    assert.equal(start(state), state, '값을 내고 시작한 지도의 이어 가기도 다시 내지 않는다');

    // 그 뒤 크리스탈이 점점 비싸진다.
    let crystals = crystalTotal + 3;
    for (const cost of crystalCosts) {
        const short = finish({ ...state, player: { ...state.player, premiumCurrency: cost - 1 } });
        assert.equal(start(short), short, `크리스탈 ${cost}이 모자라면 거부한다`);
        state = start(finish(state));
        crystals -= cost;
        assert.equal(state.player.premiumCurrency, crystals, `크리스탈 ${cost}`);
        assert.equal(state.player.gold, 7, '크리스탈 차례에는 골드를 쓰지 않는다');
    }
    const exhausted = finish({ ...state, player: { ...state.player, gold: 999999, premiumCurrency: 9999 } });
    assert.equal(start(exhausted), exhausted, '무료 + 골드 + 크리스탈을 다 쓰면 그날은 거부한다');
    assert.equal(exhausted.player.stats.fieldAutoRuns.used, BALANCE.FIELD_AUTO_RUNS_PER_DAY + BALANCE.FIELD_AUTO_EXTRA_GOLD_RUNS + crystalCosts.length);

    const nextDay = start(exhausted, NOW + DAY);
    assert.equal(nextDay.player.stats.fieldAutoRuns.used, 1, '다음 날 다시 무료부터');
    assert.equal(nextDay.player.gold, 999999, '다음 날 첫 번은 무료');
    assert.equal(nextDay.player.stats.fieldAutoRuns.day, getProtocolDayKey(new Date(NOW + DAY)));
});

test('계약 9: 자동 탐험 단추 · 잠금 문구는 리듀서와 같은 값을 읽는다', () => {
    const level = 12;
    const make = (used, extra = {}) => basePlayer({
        level,
        fieldClearedRegions: [LOC],
        stats: { ...clone(INITIAL_STATE.player.stats), fieldAutoRuns: { day: getProtocolDayKey(new Date(NOW)), used } },
        ...extra,
    });
    const free = BALANCE.FIELD_AUTO_RUNS_PER_DAY;
    const view = (player) => getFieldAutoAvailability(player, LOC, null, null, NOW);
    assert.equal(getFieldAutoButtonText(view(make(0))), MSG.FIELD_AUTO_BUTTON(free, free));
    const goldView = view(make(free, { gold: 0 }));
    assert.deepEqual(goldView.cost, { currency: 'gold', amount: level * BALANCE.FIELD_AUTO_EXTRA_GOLD_PER_LEVEL });
    assert.equal(goldView.lock, 'no_gold');
    assert.equal(getFieldAutoButtonText(goldView), MSG.FIELD_AUTO_BUTTON_GOLD(level * BALANCE.FIELD_AUTO_EXTRA_GOLD_PER_LEVEL));
    assert.equal(getFieldAutoLockText(goldView.lock, goldView.cost), MSG.FIELD_AUTO_LOCKED_NO_GOLD(level * BALANCE.FIELD_AUTO_EXTRA_GOLD_PER_LEVEL));
    const crystalView = view(make(free + 1, { premiumCurrency: 100 }));
    assert.deepEqual(crystalView.cost, { currency: 'crystal', amount: BALANCE.FIELD_AUTO_EXTRA_CRYSTAL_COSTS[0] });
    assert.equal(crystalView.lock, null);
    const done = view(make(free + 1 + BALANCE.FIELD_AUTO_EXTRA_CRYSTAL_COSTS.length, { gold: 1e9, premiumCurrency: 1e9 }));
    assert.equal(done.lock, 'no_runs');
    assert.equal(done.cost, null);
});

test('상자 소모품은 같은 이름이 이미 가방에 있으면 판매가 골드로 바뀌고, 없으면 그대로 들어온다(원장 §175)', () => {
    const reward = { gold: 40, items: ['하급 체력 물약', '하급 마나 물약'] };
    const potion = findItemByName('하급 체력 물약');
    const rng = createDomainRandom(1, LOC, 1, 'chest-item');
    const owned = basePlayer({ gold: 0, inv: [makeItem(potion, rng, () => NOW)] });
    const grant = grantFieldChestReward(owned, reward, createDomainRandom(1, LOC, 1, 'chest-item'), NOW);
    assert.deepEqual(grant.converted, ['하급 체력 물약']);
    assert.deepEqual(grant.admitted, ['하급 마나 물약']);
    assert.equal(grant.gold, 40 + getSellPrice(potion));
    assert.equal(grant.player.gold, 40 + getSellPrice(potion));
    assert.equal(grant.player.inv.length, 2, '가진 물약은 하나 그대로, 마나 물약 하나만 더해진다');
    assert.ok(MSG.FIELD_CHEST_OPENED(grant.gold, grant.admitted, grant.converted).includes('하급 체력 물약(골드로 바꿈)'));

    const empty = basePlayer({ gold: 0, inv: [] });
    const fresh = grantFieldChestReward(empty, reward, createDomainRandom(1, LOC, 1, 'chest-item'), NOW);
    assert.deepEqual(fresh.converted, []);
    assert.deepEqual(fresh.admitted, reward.items);
    assert.equal(fresh.gold, 40);

    // 가방이 가득 차도 이미 가진 소모품은 두고 오지 않고 골드가 된다. 재료는 바꾸지 않는다.
    const material = getFieldRegionMaterials(MAP)[0];
    const capacity = getInventoryCapacity(owned);
    const full = basePlayer({ gold: 0, inv: Array.from({ length: capacity }, () => makeItem(potion, rng, () => NOW)) });
    const fullGrant = grantFieldChestReward(full, { gold: 0, items: ['하급 체력 물약', material] }, createDomainRandom(1, LOC, 1, 'chest-item'), NOW);
    assert.deepEqual(fullGrant.converted, ['하급 체력 물약']);
    assert.deepEqual(fullGrant.dropped, [material]);
    assert.equal(fullGrant.player.inv.length, capacity);
});

test('계약 10: 미믹 생명은 지역 레벨에 비례하고(6 + 1.2 × 레벨, 최대 ×36) 공격력 · 경험 · 골드는 정예 배율이며 정예 목격 칭호를 남기지 않는다', () => {
    const player = basePlayer();
    const ref = { loc: LOC, seed: 42, chestId: 1 };
    const levelOf = (map) => (Array.isArray(map.level) ? map.level[0] : map.level);
    const late = Object.keys(DB.MAPS).find((name) => {
        const map = DB.MAPS[name];
        return map.type !== 'safe' && typeof levelOf(map) === 'number' && levelOf(map) > BALANCE.EARLY_ELITE_LEVEL_CAP + 25;
    });
    const cases = [[LOC, BALANCE.FIELD_MIMIC_EARLY_ATK_MULT], [late, BALANCE.FIELD_MIMIC_ATK_MULT]];
    // 비례 · 상한: 레벨이 오르면 두꺼워지고 상한에서 멈춘다. 초반 구간도 정예보다 훨씬 두껍다(한 방에 끝나지 않는다).
    assert.equal(getFieldMimicHpMult(1), BALANCE.FIELD_MIMIC_HP_MULT_BASE + BALANCE.FIELD_MIMIC_HP_MULT_PER_LEVEL);
    assert.ok(getFieldMimicHpMult(20) > getFieldMimicHpMult(5));
    assert.equal(getFieldMimicHpMult(60), BALANCE.FIELD_MIMIC_HP_MULT_MAX);
    assert.ok(getFieldMimicHpMult(1) > BALANCE.FIELD_MIMIC_ATK_MULT * 2);
    for (const [loc, atkMult] of cases) {
        const mapData = DB.MAPS[loc];
        const mimic = buildFieldMimic(player, mapData, { ...ref, loc });
        assert.ok(mimic, loc);
        // 바탕 개체 — buildFieldMimic과 같은 상자 도메인 난수로 만든 그 지역 '미믹'
        const base = spawnEnemy(mapData, player, [], { addLog: () => undefined }, {
            storyMonster: '미믹',
            rng: createDomainRandom(ref.seed, loc, ref.chestId, 'mimic-spawn'),
        }).mStats;
        assert.ok(base, loc);
        const hpMult = getFieldMimicHpMult(levelOf(mapData));
        assert.equal(mimic.maxHp, Math.floor(base.maxHp * hpMult), `${loc}: 생명 ×${hpMult}`);
        assert.equal(mimic.atk, Math.floor(base.atk * atkMult), `${loc}: 공격력 ×${atkMult}`);
        assert.equal(mimic.exp, Math.floor(base.exp * atkMult), `${loc}: 경험은 정예 배율`);
        assert.equal(mimic.gold, Math.floor(base.gold * atkMult), `${loc}: 골드는 정예 배율`);
        assert.ok(!mimic.isElite, `${loc}: 정예 목격 칭호를 남기지 않는다`);
        assert.ok(mimic.phase2, `${loc}: 정예처럼 격노한다`);
        assert.deepEqual(mimic.fieldMimic, { ...ref, loc });
        assert.deepEqual(buildFieldMimic(player, mapData, { ...ref, loc }), mimic, '같은 상자는 같은 미믹이다');
    }
});

test('계약 10: 미믹 승리 보상은 골드 5배 · 지역 재료 · 강화 재료 2개 · 착용할 수 있는 이 직업 장비이고 전투 난수와 무관하다', () => {
    const player = basePlayer({ gold: 0 });
    const ref = { loc: LOC, seed: 4242, chestId: 2 };
    const plain = getFieldChestReward(LOC, MAP, ref.seed, ref.chestId);
    const mimicReward = getFieldChestReward(LOC, MAP, ref.seed, ref.chestId, true);
    assert.equal(mimicReward.gold, plain.gold * BALANCE.FIELD_MIMIC_GOLD_MULT);
    assert.equal(plain.guaranteed, undefined, '보통 상자에는 확정 보상이 없다');
    assert.deepEqual(mimicReward.guaranteed, Array(BALANCE.FIELD_MIMIC_ENHANCE_MATERIALS).fill(CONSTANTS.ENHANCE_MATERIAL_NAME));
    assert.ok(mimicReward.items.some((name) => getFieldRegionMaterials(MAP).includes(name)), '지역 재료 확정');

    const gear = pickFieldMimicGear(player, MAP, ref);
    assert.ok(gear, '장비 하나를 고른다');
    const gearItem = findItemByName(gear);
    assert.ok(['weapon', 'armor', 'shield'].includes(gearItem.type) || gearItem.tier, gear);
    assert.equal(canEquip(gearItem, player, {}).ok, true, `${gear}: 지금 착용할 수 있다`);

    const settled = settleFieldMimicVictory(player, { fieldMimic: ref }, NOW);
    assert.equal(settled.player.gold, mimicReward.gold);
    const names = settled.player.inv.map((item) => item.name);
    assert.equal(names.filter((name) => name === CONSTANTS.ENHANCE_MATERIAL_NAME).length, BALANCE.FIELD_MIMIC_ENHANCE_MATERIALS);
    assert.ok(names.includes(gear), '장비가 가방에 들어온다');
    assert.equal(names.length, mimicReward.items.length + BALANCE.FIELD_MIMIC_ENHANCE_MATERIALS + 1);
    assert.deepEqual(
        settleFieldMimicVictory(player, { fieldMimic: ref }, NOW).player.inv.map((item) => item.name),
        names,
        '같은 상자 · 같은 직업은 같은 보상이다',
    );
    assert.equal(settleFieldMimicVictory(player, null, NOW).player, player, '미믹이 아니면 그대로다');
});

test('계약 10: 미믹의 확정 보상(강화 재료 · 장비)은 가방이 가득 차도 들어오고, 보통 상자 내용은 미믹 규칙과 무관하다', () => {
    const material = getFieldRegionMaterials(MAP)[0];
    const filler = findItemByName(material);
    const capacity = getInventoryCapacity(basePlayer());
    const inv = Array.from({ length: capacity }, (_, index) => makeItem(filler, createDomainRandom(9, LOC, index, 'fill'), () => NOW));
    const full = basePlayer({ gold: 0, inv });
    const ref = { loc: LOC, seed: 4242, chestId: 2 };
    const settled = settleFieldMimicVictory(full, { fieldMimic: ref }, NOW);
    const added = settled.player.inv.slice(capacity).map((item) => item.name);
    assert.equal(added.filter((name) => name === CONSTANTS.ENHANCE_MATERIAL_NAME).length, BALANCE.FIELD_MIMIC_ENHANCE_MATERIALS);
    assert.ok(added.includes(pickFieldMimicGear(full, MAP, ref)), '장비는 가방 상한을 넘어 들어온다');

    // 보통 상자의 추첨 순서는 그대로다 — 같은 시드의 보통 상자와 미믹 상자의 지역 재료 · 소모품 고르기가 같다.
    for (let chestId = 0; chestId < 6; chestId += 1) {
        const plain = getFieldChestReward(LOC, MAP, 777, chestId);
        const mimic = getFieldChestReward(LOC, MAP, 777, chestId, true);
        assert.equal(mimic.items[0], plain.items[0], '같은 소모품');
    }
});

test('계약 10: 미믹이 나타날 때의 위협 줄은 미믹 자신의 이름이고 정예라 부르지 않는다', async () => {
    const player = basePlayer();
    const sample = MSG.FIELD_MIMIC_THREAT(120, 500, 24, 5);
    assert.match(sample, /미믹/);
    assert.doesNotMatch(sample, /정예/);
    const logs = [];
    const dispatched = [];
    const deps = {
        player: { ...player, fieldMap: { ...player.fieldMap, pending: { kind: 'mimic', chestId: findMimicSeed().chest.id }, seed: findMimicSeed().seed } },
        gameState: GS.IDLE,
        dispatch: (action) => dispatched.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => ({}),
        rng: () => 0.5,
    };
    const actions = createFieldActions(deps, { explore: () => undefined, move: () => undefined });
    await actions.processFieldPending();
    const texts = logs.map((log) => log.text);
    assert.ok(texts.some((text) => text.startsWith('🩸 미믹의 가장 센 한 방')), texts.join(' / '));
    assert.equal(texts.some((text) => text.includes('정예의 가장 센 한 방')), false);
});

test('계약 11: 미믹에게서 달아나면 상자가 비었다는 줄을 남긴다 — 다른 적의 도주에는 없다(설계 §6, 통합 수용 8차)', () => {
    const player = basePlayer();
    const mimic = buildFieldMimic(player, MAP, { loc: LOC, seed: 42, chestId: 1 });
    assert.ok(mimic);
    const plain = { ...mimic };
    delete plain.fieldMimic;
    const fled = (enemy) => {
        for (let seed = 1; seed < 400; seed += 1) {
            const result = resolveCombatActionTurn({ player, enemy, kind: 'escape', seed, now: NOW });
            if (result.kind === 'escape') return result;
        }
        throw new Error('400개 씨앗 안에서 도주가 한 번도 성공하지 않았다');
    };
    const mimicTexts = fled(mimic).logs.map((log) => log.text);
    assert.ok(mimicTexts.includes(MSG.FIELD_MIMIC_FLED), mimicTexts.join(' / '));
    assert.equal(fled(plain).logs.some((log) => log.text === MSG.FIELD_MIMIC_FLED), false);
});
