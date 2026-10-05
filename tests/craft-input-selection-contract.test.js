import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.ts';
import { getNextBagRecipe } from '../src/data/bagRecipes.ts';
import { MSG } from '../src/data/messages.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { economyActionMap } from '../src/reducers/handlers/economyHandlers.ts';
import { createEconomyActions } from '../src/hooks/useInventoryActions.economy.ts';
import { getRecipeInputIds, selectRecipeInputs } from '../src/utils/recipeInputSelection.ts';
import { getSynthesisGroups } from '../src/utils/synthesisUtils.ts';
import CraftingPanel, { SynthesisInputGroups } from '../src/components/tabs/CraftingPanel.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 제작 재료 사본 선택 계약 (2026-10 Wave 62, 원장 §61.4 C8 — 소유자 결정 "강화 안 된 사본 먼저").
 *
 * 같은 이름의 사본이 여럿이면 제작은 낮은 강화(+N) → 접두어 없음 → 가방 앞쪽 순서로 쓴다. 이름이 같은 첫 사본을
 * 쓰던 동안 제작법 r3(화염의 지팡이)가 +5 나무지팡이를 먹고 +0을 남겼다(감사 4회차 리듀서 실행).
 *  - 훅(요청 id)과 리듀서(기대 id)가 같은 선택기를 읽는다 — 옛 순서(첫 사본)로 보낸 요청은 리듀서가 동일 참조로 버린다.
 *  - 제작 화면은 강화된 사본이 있을 때 쓰일 사본의 +N을, 합성 재료 목록은 사본마다 +N을 그린다.
 */

const STAFF = DB.ITEMS.weapons.find((item) => item.name === '나무지팡이');
const FIRE_CRYSTAL = DB.ITEMS.materials.find((item) => item.name === '화염의 결정');
const RECIPE_R3 = DB.ITEMS.recipes.find((recipe) => recipe.id === 'r3');

const staff = (id, enhance, extra = {}) => ({ ...STAFF, id, enhance, ...extra });
const crystals = (count) => Array.from({ length: count }, (_, index) => ({ ...FIRE_CRYSTAL, id: `fire_${index}` }));

const craftingState = (inv) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.CRAFTING,
    player: {
        ...structuredClone(INITIAL_STATE.player),
        gold: 10_000,
        inv,
    },
});

const dispatchedCraft = (player, recipeId) => {
    const dispatched = [];
    const actions = createEconomyActions({ player, gameState: GS.CRAFTING, dispatch: (action) => dispatched.push(action) });
    actions.craft(recipeId);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.CRAFT_RECIPE);
    return dispatched[0];
};

test('fixtures — r3은 나무지팡이 1 + 화염의 결정 3이고 나무지팡이는 강화 가능한 무기다', () => {
    assert.ok(STAFF && FIRE_CRYSTAL && RECIPE_R3);
    assert.deepEqual(RECIPE_R3.inputs, [{ name: '나무지팡이', qty: 1 }, { name: '화염의 결정', qty: 3 }]);
    assert.equal(STAFF.type, 'weapon');
});

test('훅 → 리듀서: r3은 +0 나무지팡이를 쓰고 +5 사본을 남긴다 (가방에서 +5가 앞에 있어도)', () => {
    const state = craftingState([staff('staff_plus5', 5), staff('staff_plus0', 0), ...crystals(3)]);
    const action = dispatchedCraft(state.player, 'r3');
    assert.deepEqual(action.payload.inputIds, ['staff_plus0', 'fire_0', 'fire_1', 'fire_2']);

    const next = economyActionMap.CRAFT_RECIPE(state, action);
    const ids = next.player.inv.map((item) => item.id);
    assert.ok(ids.includes('staff_plus5'), '+5 나무지팡이가 남는다');
    assert.ok(!ids.includes('staff_plus0'), '+0 나무지팡이가 쓰인다');
    assert.equal(next.player.inv.find((item) => item.id === 'staff_plus5').enhance, 5);
    assert.ok(next.player.inv.some((item) => item.name === '화염의 지팡이'), '제작 결과가 들어온다');
    assert.equal(next.player.gold, state.player.gold - RECIPE_R3.gold);
});

test('리듀서가 권한이다: 옛 순서(이름이 같은 첫 사본 = +5)로 보낸 요청은 동일 참조로 버린다', () => {
    const state = craftingState([staff('staff_plus5', 5), staff('staff_plus0', 0), ...crystals(3)]);
    const stale = {
        type: AT.CRAFT_RECIPE,
        payload: { recipeId: 'r3', inputIds: ['staff_plus5', 'fire_0', 'fire_1', 'fire_2'], relicRoll: 0.5 },
    };
    assert.equal(economyActionMap.CRAFT_RECIPE(state, stale), state);
});

test('강화된 사본밖에 없으면 그것을 쓴다 — 거부하지 않는다', () => {
    const state = craftingState([staff('staff_plus5', 5), ...crystals(3)]);
    const action = dispatchedCraft(state.player, 'r3');
    assert.deepEqual(action.payload.inputIds, ['staff_plus5', 'fire_0', 'fire_1', 'fire_2']);
    const next = economyActionMap.CRAFT_RECIPE(state, action);
    assert.ok(!next.player.inv.some((item) => item.id === 'staff_plus5'));
    assert.ok(next.player.inv.some((item) => item.name === '화염의 지팡이'));
});

test('우선순위: 낮은 강화 → 접두어 없음 → 가방 앞쪽', () => {
    const inventory = [
        staff('plus3', 3),
        staff('plus0_prefixed', 0, { prefixed: true, prefixName: '날카로운' }),
        staff('plus0_first', 0),
        staff('plus0_second', 0),
        staff('plus1', 1),
    ];
    const recipe = { inputs: [{ name: '나무지팡이', qty: 5 }] };
    assert.deepEqual(getRecipeInputIds(inventory, recipe), ['plus0_first', 'plus0_second', 'plus0_prefixed', 'plus1', 'plus3']);
    assert.deepEqual(getRecipeInputIds(inventory, { inputs: [{ name: '나무지팡이', qty: 1 }] }), ['plus0_first']);
});

test('한 사본은 한 재료 줄에만 쓰이고, 모자란 줄에서 멈춘다(이전 선택기와 같은 모양)', () => {
    const inventory = [staff('a', 2), staff('b', 0), ...crystals(1)];
    const recipe = { inputs: [{ name: '나무지팡이', qty: 1 }, { name: '나무지팡이', qty: 1 }, { name: '화염의 결정', qty: 3 }, { name: '나무지팡이', qty: 1 }] };
    const selections = selectRecipeInputs(inventory, recipe);
    assert.deepEqual(selections.map((entry) => entry.items.map((item) => item.id)), [['b'], ['a'], ['fire_0']]);
    assert.deepEqual(selections.map((entry) => entry.enough), [true, true, false]);
    assert.deepEqual(getRecipeInputIds(inventory, recipe), ['b', 'a', 'fire_0']);
});

test('가방 제작(CRAFT_BAG)도 같은 선택기로 훅 요청과 리듀서 기대가 일치한다', () => {
    const bagRecipe = getNextBagRecipe(0);
    const inv = bagRecipe.inputs.flatMap((input) => Array.from(
        { length: input.qty },
        (_, index) => ({ name: input.name, type: 'mat', id: `${input.name}_${index}` }),
    ));
    const state = craftingState(inv);
    const dispatched = [];
    createEconomyActions({ player: state.player, gameState: GS.CRAFTING, dispatch: (action) => dispatched.push(action) }).craftBag();
    assert.equal(dispatched[0].type, AT.CRAFT_BAG);
    const next = economyActionMap.CRAFT_BAG(state, dispatched[0]);
    assert.equal(next.player.bagTier, 1);
    assert.equal(next.player.inv.length, 0);
});

const renderCrafting = (inv) => renderStatic(createElement(CraftingPanel, {
    player: makePlayerFixture({ gold: 10_000, inv }),
    actions: { craft: () => {}, craftBag: () => {}, synthesize: () => {} },
    setGameState: () => {},
    onOpenArchiveConsole: () => {},
}));

const enhanceChip = (html, recipeId, inputName) => {
    const match = html.match(new RegExp(`data-testid="crafting-input-enhance-${recipeId}-${inputName}"[^>]*>([^<]*)<`));
    return match ? match[1].trim() : null;
};

test('제작 화면: 강화된 사본이 있으면 쓰일 사본의 +N을 보인다', () => {
    const mixed = renderCrafting([staff('staff_plus5', 5), staff('staff_plus0', 0), ...crystals(3)]);
    assert.equal(enhanceChip(mixed, 'r3', '나무지팡이'), `· ${MSG.CRAFT_INPUT_ENHANCE_USED([0])}`);
    assert.equal(MSG.CRAFT_INPUT_ENHANCE_USED([0]), '+0 사용');

    const onlyEnhanced = renderCrafting([staff('staff_plus5', 5), ...crystals(3)]);
    assert.equal(enhanceChip(onlyEnhanced, 'r3', '나무지팡이'), `· ${MSG.CRAFT_INPUT_ENHANCE_USED([5])}`);

    // 모두 +0이면 어느 사본이 쓰여도 같다 — 표시하지 않는다. 재료(결정)에는 강화가 없다.
    const plain = renderCrafting([staff('staff_a', 0), staff('staff_b', 0), ...crystals(3)]);
    assert.equal(enhanceChip(plain, 'r3', '나무지팡이'), null);
    assert.equal(enhanceChip(mixed, 'r3', '화염의 결정'), null);
});

test('합성 재료 목록: 사본마다 +N을 보인다 (+0 사본은 표시 없음)', () => {
    const inv = [staff('w_plus4', 4), staff('w_plus0_a', 0), staff('w_plus0_b', 0)];
    const groups = getSynthesisGroups(inv);
    assert.equal(groups.length, 1, '같은 타입 · 단계 3개 = 합성 묶음 하나');
    const html = renderStatic(createElement(SynthesisInputGroups, { groups, selectedIds: [], onToggle: () => {} }));
    const tag = html.match(/data-testid="synthesis-input-enhance-w_plus4"[^>]*>([^<]*)</);
    assert.ok(tag, '+4 사본에 강화 표시');
    assert.equal(tag[1].trim(), MSG.SYNTHESIS_INPUT_ENHANCE(4));
    assert.equal(MSG.SYNTHESIS_INPUT_ENHANCE(4), '+4');
    assert.ok(!html.includes('synthesis-input-enhance-w_plus0_a'));
    assert.ok(!html.includes('synthesis-input-enhance-w_plus0_b'));
    for (const item of inv) assert.ok(html.includes(`data-testid="synthesis-input-${item.id}"`));
});
