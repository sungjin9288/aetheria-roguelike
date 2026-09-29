import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { BAG_RECIPES, getBagSlotBonus, getNextBagRecipe } from '../src/data/bagRecipes.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { admitCombatLoot } from '../src/systems/combatLootCapacity.ts';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity.ts';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import { getAdventureGuidance } from '../src/utils/adventureGuide.ts';
import { ACTION_KIND_TO_BUTTON } from '../src/components/controlPanelConfig.ts';
import BagCraftingSection from '../src/components/tabs/BagCraftingSection.tsx';
import SmartInventory from '../src/components/SmartInventory.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 33 (소유자 결정 "가방을 제작요소로" · "런마다 다시 만드는 가방").
 *
 * 제작소에서 가방을 단계별로 만든다(5단계 × 3칸, 20 → 35). 단계는 이번 런에만 유효하고 사망·계승에서 0으로
 * 돌아간다. 크리스털 영구 확장(`maxInv`)과 더해진다. 상한을 읽는 곳은 전부 `getInventoryCapacity`를 거친다.
 */

const material = (name, index) => {
    const def = DB.ITEMS.materials.find((entry) => entry.name === name);
    assert.ok(def, `전제: 재료 ${name}가 데이터에 있다`);
    return { ...structuredClone(def), id: `mat_${name}_${index}` };
};
const materialsFor = (recipe, extra = 0) => recipe.inputs.flatMap((input) => (
    Array.from({ length: input.qty + extra }, (_, index) => material(input.name, index))
));
const inputIdsFor = (inventory, recipe) => {
    const available = [...inventory];
    const ids = [];
    for (const input of recipe.inputs) {
        for (let count = 0; count < input.qty; count += 1) {
            const index = available.findIndex((item) => item.name === input.name);
            if (index < 0) return ids;
            ids.push(available.splice(index, 1)[0].id);
        }
    }
    return ids;
};
const craftingState = (player = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    gameState: GS.CRAFTING,
    logs: [],
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '짐꾼',
        level: 12,
        gold: 50_000,
        inv: [],
        ...player,
    },
});
const craftBag = (state, tier, inputIds = inputIdsFor(state.player.inv, BAG_RECIPES[tier - 1])) => gameReducer(state, {
    type: AT.CRAFT_BAG,
    payload: { tier, inputIds, relicRoll: 0.99 },
});

// ── 데이터와 상한 ───────────────────────────────────────────────────────────

test('[데이터] 가방은 5단계 · 단계당 3칸이고 재료는 모두 실제 재료다', () => {
    assert.equal(BAG_RECIPES.length, 5);
    assert.deepEqual(BAG_RECIPES.map((recipe) => recipe.tier), [1, 2, 3, 4, 5]);
    assert.equal(getBagSlotBonus(5), 15);
    for (const recipe of BAG_RECIPES) for (const input of recipe.inputs) material(input.name, 0);
    assert.equal(getNextBagRecipe(0).tier, 1);
    assert.equal(getNextBagRecipe(5), null);
});

test('[상한] 지금 상한 = 영구 크기(크리스털 확장 포함) + 이번 런 가방 칸', () => {
    assert.equal(getInventoryCapacity({}), BALANCE.INV_MAX_SIZE);
    assert.equal(getInventoryCapacity({ bagTier: 2 }), BALANCE.INV_MAX_SIZE + 6);
    assert.equal(getInventoryCapacity({ maxInv: 25, bagTier: 5 }), 40);
    assert.equal(getInventoryCapacity({ bagTier: 99 }), BALANCE.INV_MAX_SIZE + 15, '최대 단계를 넘는 값은 최대 단계');
    assert.equal(getInventoryCapacity({ bagTier: -1 }), BALANCE.INV_MAX_SIZE);
});

test('[전리품] 전투 전리품 수용은 제작한 가방 칸을 쓴다', () => {
    const player = { ...structuredClone(INITIAL_STATE.player), bagTier: 1, inv: Array.from({ length: 20 }, (_, index) => material('슬라임 젤리', index)) };
    const candidates = Array.from({ length: 5 }, (_, index) => ({ item: material('철광석', 100 + index) }));
    const admission = admitCombatLoot(player, candidates);
    assert.equal(admission.capacity, 23);
    assert.equal(admission.admitted.length, 3);
});

test('[구매] 20/20 가방도 가방 1단계가 있으면 상점 구매가 된다', () => {
    const offer = DB.ITEMS.consumables[0];
    const state = {
        ...craftingState({ bagTier: 1, inv: Array.from({ length: 20 }, (_, index) => material('슬라임 젤리', index)) }),
        gameState: GS.SHOP,
        shopItems: [offer],
    };
    const next = gameReducer(state, {
        type: AT.BUY_SHOP_ITEM,
        payload: { source: 'stock', itemName: offer.name, expectedGold: state.player.gold, expectedInventorySize: 20, relicRoll: 0.99 },
    });
    assert.equal(next.player.inv.length, 21);
});

// ── 제작 전이 ───────────────────────────────────────────────────────────────

test('[제작] 제작소에서 1단계를 만들면 재료·골드를 쓰고 상한이 3칸 늘어난다', () => {
    const recipe = BAG_RECIPES[0];
    const state = craftingState({ inv: [...materialsFor(recipe, 1), material('슬라임 젤리', 0)] });
    const next = craftBag(state, 1);
    assert.equal(next.player.bagTier, 1);
    assert.equal(getInventoryCapacity(next.player), BALANCE.INV_MAX_SIZE + 3);
    assert.equal(next.player.gold, state.player.gold - recipe.gold);
    assert.equal(next.player.inv.length, state.player.inv.length - recipe.inputs.reduce((sum, input) => sum + input.qty, 0));
    assert.ok(next.logs.some((log) => log.text === MSG.BAG_CRAFTED(recipe.name, BALANCE.INV_MAX_SIZE + 3)));
});

test('[순서] 이전 단계 없이 다음 단계를 만들 수 없다(동일 참조)', () => {
    const state = craftingState({ inv: materialsFor(BAG_RECIPES[1]) });
    assert.strictEqual(craftBag(state, 2), state);
    const done = craftingState({ bagTier: 5, inv: [] });
    assert.strictEqual(craftBag(done, 5, []), done, '이미 만든 단계는 다시 만들지 않는다');
});

test('[재료] 재료가 모자라면 거부 로그만 남고 가방은 그대로다', () => {
    const recipe = BAG_RECIPES[0];
    const state = craftingState({ inv: materialsFor(recipe).slice(1) });
    const next = craftBag(state, 1);
    assert.equal(next.player.bagTier ?? 0, 0);
    assert.equal(next.player.inv.length, state.player.inv.length);
    assert.equal(next.logs.at(-1).type, 'error');
    assert.equal(next.logs.at(-1).text, MSG.CRAFT_MAT_INSUFFICIENT(recipe.inputs[0].name));
});

test('[골드] 골드가 모자라면 거부한다', () => {
    const recipe = BAG_RECIPES[0];
    const state = craftingState({ gold: recipe.gold - 1, inv: materialsFor(recipe) });
    const next = craftBag(state, 1);
    assert.equal(next.player.bagTier ?? 0, 0);
    assert.equal(next.logs.at(-1).text, MSG.GOLD_INSUFFICIENT);
});

test('[상태] 제작소 밖에서는 가방을 만들 수 없다(동일 참조)', () => {
    const state = { ...craftingState({ inv: materialsFor(BAG_RECIPES[0]) }), gameState: GS.IDLE };
    assert.strictEqual(craftBag(state, 1), state);
});

// ── 런 범위 ─────────────────────────────────────────────────────────────────

test('[런 범위] 사망 재시작은 가방 단계를 0으로 돌리고 크리스털 확장은 남긴다', () => {
    const player = { ...structuredClone(INITIAL_STATE.player), name: '짐꾼', level: 20, maxInv: 25, bagTier: 4, stats: { ...structuredClone(INITIAL_STATE.player.stats), deaths: 1 } };
    const restarted = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0).updatedPlayer;
    assert.equal(restarted.bagTier ?? 0, 0);
    assert.equal(getInventoryCapacity(restarted), 25);
});

test('[런 범위] 계승은 가방 단계를 0으로 돌린다', () => {
    const state = {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        gameState: GS.ASCENSION,
        player: { ...structuredClone(INITIAL_STATE.player), name: '짐꾼', level: 49, quests: [], maxInv: 25, bagTier: 5 },
    };
    const next = gameReducer(state, { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: null } });
    assert.equal(next.player.meta.prestigeRank, getAscensionOutcome(state.player.meta).nextRank, '비공허: 계승이 적용됐다');
    assert.equal(next.player.bagTier ?? 0, 0);
    assert.equal(getInventoryCapacity(next.player), 25);
});

// ── 표시 ────────────────────────────────────────────────────────────────────

test('[표시] 가방 탭은 지금 상한, 다음 단계 재료, 이번 런 한정 안내를 그린다', () => {
    const recipe = BAG_RECIPES[0];
    const player = { ...structuredClone(INITIAL_STATE.player), gold: 1_000, inv: materialsFor(recipe) };
    const html = renderStatic(createElement(BagCraftingSection, { player, onCraftBag: () => {} }));
    assert.ok(html.includes('data-testid="bag-capacity"'));
    assert.ok(html.includes(MSG.BAG_CAPACITY(BALANCE.INV_MAX_SIZE, BALANCE.INV_MAX_SIZE, 0)));
    assert.ok(html.includes('data-testid="bag-recipe-1"') && html.includes('data-bag-state="ready"'));
    assert.ok(html.includes('data-testid="bag-recipe-2"') && html.includes('data-bag-state="locked"'));
    assert.ok(html.includes(MSG.BAG_RUN_SCOPE_NOTE));
    for (const input of recipe.inputs) assert.ok(html.includes(`${input.name} ${input.qty}/${input.qty}`));
});

test('[안내] 마을에서 가방이 거의 찼고 다음 가방을 만들 수 있으면 가이드가 제작소를 가리킨다', () => {
    const recipe = BAG_RECIPES[0];
    const mats = materialsFor(recipe);
    const base = {
        ...structuredClone(INITIAL_STATE.player),
        name: '짐꾼',
        level: 3,
        loc: '시작의 마을',
        gold: 1_000,
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: ['시작의 마을', '고요한 숲', '서쪽 평원'] },
    };
    const ready = getAdventureGuidance({ ...base, inv: [...mats, ...Array.from({ length: 19 - mats.length }, (_, i) => material('슬라임 젤리', 100 + i))] }, null, DB.MAPS['시작의 마을'], 'idle');
    assert.equal(ready.title, MSG.GUIDE_BAG_UPGRADE_TITLE);
    assert.equal(ready.detail, MSG.GUIDE_BAG_UPGRADE_DETAIL(recipe.name, 19, 20, 23));
    assert.equal(ACTION_KIND_TO_BUTTON[ready.primaryAction.kind], 'craft', '조작판의 제작소 버튼이 강조된다');
    const short = getAdventureGuidance({ ...base, inv: Array.from({ length: 19 }, (_, i) => material('슬라임 젤리', i)) }, null, DB.MAPS['시작의 마을'], 'idle');
    assert.notEqual(short.title, MSG.GUIDE_BAG_UPGRADE_TITLE, '재료가 없으면 기존 정리 안내');
});

// ── 일괄 판매 · 과밀 배너 ──────────────────────────────────────────────────

const junkBag = () => [
    ...Array.from({ length: 5 }, (_, i) => material('멧돼지 가죽', i)),
    ...Array.from({ length: 3 }, (_, i) => material('벌레 껍질', i)),
    ...Array.from({ length: 2 }, (_, i) => material('슬라임 젤리', i)),
];

test('[일괄 판매] 값싼 재료를 팔아도 다음 가방에 필요한 수량은 남는다', () => {
    const recipe = BAG_RECIPES[0];
    const cheapInputs = recipe.inputs.filter((input) => material(input.name, 0).price <= BALANCE.INVENTORY_JUNK_MATERIAL_PRICE_MAX);
    assert.ok(cheapInputs.some((input) => input.name === '멧돼지 가죽'), '전제: 1단계 재료에 판매 임계 이하 재료가 있다');
    const state = { ...craftingState({ inv: junkBag() }), gameState: GS.IDLE };
    const next = gameReducer(state, { type: AT.AUTO_SELL_MATERIALS });
    const count = (name) => next.player.inv.filter((item) => item.name === name).length;
    for (const input of cheapInputs) assert.equal(count(input.name), input.qty, `${input.name} ${input.qty}개 보존`);
    assert.equal(count('슬라임 젤리'), 0);
    assert.equal(count('벌레 껍질'), 0, '가방 재료가 아닌 값싼 재료는 판다');
    assert.equal(next.player.inv.length, cheapInputs.reduce((sum, input) => sum + input.qty, 0));
});

test('[일괄 판매] 가방을 모두 만들었으면 예전처럼 전부 판다', () => {
    const state = { ...craftingState({ bagTier: 5, inv: junkBag() }), gameState: GS.IDLE };
    const next = gameReducer(state, { type: AT.AUTO_SELL_MATERIALS });
    assert.equal(next.player.inv.length, 0);
});

test('[과밀 배너] 과밀 판정과 표시는 지금 상한을 따른다', () => {
    const fill = (count) => [...junkBag(), ...Array.from({ length: count - 10 }, (_, i) => material('철광석', 200 + i))];
    const render = (player) => renderStatic(createElement(SmartInventory, { player: { ...structuredClone(INITIAL_STATE.player), ...player }, quickSlots: [null, null, null], onAssignQuickSlot: () => {} }));
    const base = render({ inv: fill(18) });
    assert.ok(base.includes('data-testid="inventory-bulk-sell-banner"'), '기본 20칸: 18개에서 배너');
    assert.ok(base.includes('18/20'));
    const crafted = render({ inv: fill(18), bagTier: 2 });
    assert.equal(crafted.includes('data-testid="inventory-bulk-sell-banner"'), false, '26칸: 18개는 과밀이 아니다');
    const craftedFull = render({ inv: fill(24), bagTier: 2 });
    assert.ok(craftedFull.includes('24/26'));
});

// ── 상한 단일 원천(부재 불변식) ─────────────────────────────────────────────

test('[단일 원천] src에서 `maxInv || BALANCE.INV_MAX_SIZE`로 상한을 직접 읽지 않는다', () => {
    const offenders = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.(ts|tsx)$/.test(name) && readFileSync(path, 'utf8').includes('maxInv || BALANCE.INV_MAX_SIZE')) offenders.push(path);
        }
    };
    walk(new URL('../src', import.meta.url).pathname);
    assert.deepEqual(offenders, []);
});
