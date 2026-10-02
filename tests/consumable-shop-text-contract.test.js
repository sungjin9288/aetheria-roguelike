import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { PREMIUM_SHOP } from '../src/data/premiumShop.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { premiumActionMap } from '../src/reducers/handlers/premiumHandlers.ts';
import { resolveConsumableEffect } from '../src/systems/consumableEffect.ts';
import { isFullRestoreElixir, isInventoryUseAccepted } from '../src/systems/consumableRules.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { getItemStatText } from '../src/utils/equipmentUtils.ts';
import { applyItemPrefix } from '../src/utils/itemPrefixUtils.ts';
import {
    getConsumableCompactLabel,
    getConsumableDescription,
    getConsumableEffectSummary,
} from '../src/utils/consumablePresentation.ts';
import { buildCombatView } from '../src/utils/combatView.ts';
import { getAvailableCommands } from '../src/utils/commandSuggestions.ts';
import { getRestCost } from '../src/utils/expeditionReturnFlow.ts';
import { getCrystalExchangeOffers } from '../src/utils/crystalExchange.ts';
import ShopPanel from '../src/components/ShopPanel.tsx';
import SmartInventory from '../src/components/SmartInventory.tsx';
import QuickSlot from '../src/components/QuickSlot.tsx';
import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import PremiumShop from '../src/components/PremiumShop.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * Wave 61 (원장 §61.3 — 엔진은 맞고 플레이어가 보는 문구가 틀렸다):
 *   F2  엘릭서(접두어 사본 포함)는 엔진이 실효 최대 생명까지 회복한다 — 어느 표면도 9999 · 10006 같은 val을 그리지 않는다.
 *   F6  터미널 자동완성의 휴식 비용은 실제 휴식 비용(`getRestCost`)이다.
 *   F8  상점의 정화 아이템 줄에 원시 상태 id("poison 해제")가 없다.
 *   F9  인벤토리의 "사용"/"장착" 버튼은 리듀서(USE_INVENTORY_ITEM)가 받는 아이템에만 있다 — DB 전수.
 *   F12 영웅의 물약은 공격력 · 방어력만 올린다(라벨이 "ALL"이었다). 합성 보호 상품의 이름은 모든 표면에서 하나다.
 */

const ELIXIR = DB.ITEMS.consumables.find((item) => item.name === '엘릭서');
const textOf = (html) => html.replace(/<[^>]*>/g, ' ');
const attrsOf = (html) => [...html.matchAll(/(?:title|aria-label)="([^"]*)"/g)].map((match) => match[1]).join(' ');

/** 엘릭서에 붙을 수 있는 모든 접두어 사본 — 실제 `applyItemPrefix`(접두어 확률 통과 → 후보 선택)로 만든다. */
const makePrefixedElixirs = () => {
    const seen = new Map();
    for (let step = 0; step < 64; step += 1) {
        const draws = [0, (step + 0.5) / 64];
        const rolled = applyItemPrefix({ ...ELIXIR, id: `elixir-prefix-${step}` }, () => draws.shift() ?? 0);
        if (rolled.prefixed && !seen.has(rolled.prefixName)) seen.set(rolled.prefixName, rolled);
    }
    return [...seen.values()];
};

const PREFIXED_ELIXIRS = makePrefixedElixirs();
const ELIXIR_VARIANTS = [{ ...ELIXIR, id: 'elixir-plain' }, ...PREFIXED_ELIXIRS];

const assertNoElixirNumber = (text, elixir, surface) => {
    assert.ok(!text.includes(String(elixir.val)), `${surface}: ${elixir.name}의 val(${elixir.val})을 그리지 않는다 — ${text}`);
    assert.ok(!/9999|100\d\d/.test(text), `${surface}: ${elixir.name} — 엘릭서 수치가 보인다: ${text}`);
};

test('F2 fixture: 접두어 엘릭서가 실제로 만들어지고 엔진은 모두 완전 회복으로 판정한다', () => {
    assert.ok(ELIXIR, '데이터에 엘릭서가 있다');
    assert.ok(PREFIXED_ELIXIRS.length >= 5, `엘릭서에 붙는 접두어 사본: ${PREFIXED_ELIXIRS.map((item) => item.name).join(', ')}`);
    assert.ok(PREFIXED_ELIXIRS.some((item) => item.name === '신성한 엘릭서'), '감사가 짚은 "신성한 엘릭서"가 포함된다');
    for (const elixir of ELIXIR_VARIANTS) {
        assert.equal(isFullRestoreElixir(elixir), true, elixir.name);
        // 엔진 근거: val보다 큰 최대 생명에서도 실효 최대까지 회복한다.
        const player = makePlayerFixture({ maxHp: 40_000, hp: 1, inv: [elixir] });
        const result = resolveConsumableEffect({ player, item: elixir });
        assert.equal(result.ok, true, elixir.name);
        assert.equal(result.player.hp, calculateFullStats(player).maxHp, `${elixir.name}: 완전 회복`);
        assert.ok(result.player.hp > elixir.val, `${elixir.name}: 회복량이 val(${elixir.val})보다 크다`);
    }
    // 같은 판정이 일반 물약은 수치 회복으로 둔다.
    const potion = DB.ITEMS.consumables.find((item) => item.name === '상급 체력 물약');
    assert.equal(isFullRestoreElixir(potion), false);
    assert.equal(isFullRestoreElixir({ ...potion, name: `신성한 ${potion.name}`, prefixed: true, prefixName: '신성한' }), false);
});

test('F2: 모든 문구 생성기가 엘릭서 · 접두어 엘릭서를 완전 회복으로 그린다', () => {
    for (const elixir of ELIXIR_VARIANTS) {
        const statText = getItemStatText(elixir);
        assert.equal(statText, MSG.CONSUMABLE_HP_FULL_RESTORE, `인벤토리 수치 줄: ${elixir.name}`);

        assert.equal(getConsumableCompactLabel(elixir), 'HP∞', `빠른 슬롯: ${elixir.name}`);
        assertNoElixirNumber(getConsumableCompactLabel(elixir), elixir, '빠른 슬롯');

        for (const includeTurnCost of [false, true]) {
            const description = getConsumableDescription(elixir, { includeTurnCost });
            assert.ok(description.includes(MSG.CONSUMABLE_HP_FULL_RESTORE), `툴팁: ${description}`);
            assertNoElixirNumber(description, elixir, '툴팁');
        }

        const summary = getConsumableEffectSummary(elixir);
        assert.equal(summary, MSG.CONSUMABLE_HP_FULL_RESTORE, `상점 비교 줄: ${elixir.name}`);
    }
    // 접두어가 붙는 순간 만들어지는 desc_stat(전투 목록 · 도감이 그대로 그리는 값)도 수치가 아니다.
    for (const elixir of PREFIXED_ELIXIRS) {
        assert.ok(elixir.desc_stat.startsWith(MSG.CONSUMABLE_HP_FULL_RESTORE), elixir.desc_stat);
        assertNoElixirNumber(elixir.desc_stat, elixir, '접두어 desc_stat');
    }
    // 일반 물약은 여전히 수치를 그린다(판정이 엘릭서만 고른다).
    const potion = DB.ITEMS.consumables.find((item) => item.name === '중급 체력 물약');
    assert.ok(getItemStatText(potion).includes(String(potion.val)));
    assert.ok(getConsumableEffectSummary(potion).includes(String(potion.val)));
});

test('F2: 전투 목록 · 인벤토리 · 빠른 슬롯 · 상점이 실제로 그린 엘릭서 줄에 수치가 없다', () => {
    // 저장된 사본은 예전 desc_stat("HP+10006 | 신성한")을 들고 있다 — 표면은 저장값이 아니라 판정으로 그려야 한다.
    const legacy = PREFIXED_ELIXIRS.map((elixir) => ({ ...elixir, desc_stat: `HP+${elixir.val} | ${elixir.prefixName}` }));
    const variants = [ELIXIR_VARIANTS[0], ...legacy];
    const player = makePlayerFixture({
        level: 30,
        hp: 10,
        inv: variants,
        settings: { ...(INITIAL_STATE.player.settings || {}), equipmentDetailMode: 'full' },
    });

    const combatView = buildCombatView({ player, enemy: null, stats: null, mobile: false });
    for (const entry of combatView.combatConsumables) {
        assert.equal(entry.label, MSG.CONSUMABLE_HP_FULL_RESTORE, `전투 목록 문구: ${entry.name}`);
    }

    const enemy = { name: '숲의 정령', hp: 100, maxHp: 100, isBoss: false };
    const combatHtml = renderStatic(createElement(CombatPanel, {
        player, enemy, actions: { getSelectedSkill: () => null, combat: () => {} },
        stats: { atk: 10, def: 5, maxHp: 100, maxMp: 50 }, isAiThinking: false, mobile: false,
    }));
    const inventoryHtml = renderStatic(createElement(SmartInventory, { player, actions: {} }));
    const quickSlotHtml = renderStatic(createElement(QuickSlot, { slots: variants.slice(0, 3), gameState: GS.IDLE }));

    // 전투 목록은 데스크톱에서 6종까지 그린다 — 그려진 항목이 모두 엘릭서 사본이다.
    assert.ok(combatView.combatConsumables.length >= 6);
    for (const entry of combatView.combatConsumables) {
        assert.ok(combatHtml.includes(`data-testid="combat-consumable-${entry.id}"`), `전투 목록에 ${entry.name}이 보인다`);
    }
    for (const elixir of variants) {
        assert.ok(inventoryHtml.includes(`data-testid="inventory-use-${elixir.id}"`), `인벤토리에 ${elixir.name}이 보인다`);
    }
    for (const [surface, html] of [['전투 목록', combatHtml], ['인벤토리', inventoryHtml], ['빠른 슬롯', quickSlotHtml]]) {
        const visible = `${textOf(html)} ${attrsOf(html)}`;
        assert.ok(visible.includes(MSG.CONSUMABLE_HP_FULL_RESTORE) || visible.includes('HP∞'), `${surface}: 완전 회복 표시`);
        for (const elixir of variants) assertNoElixirNumber(visible, elixir, surface);
    }

    const shopHtml = renderStatic(createElement(ShopPanel, {
        player: { ...player, gold: 99_999, loc: CONSTANTS.START_LOCATION },
        shopItems: [ELIXIR],
        actions: { market: () => {}, clearEconomyReceipt: () => {}, economyReceipt: null },
        stats: null,
    }));
    const shopText = textOf(shopHtml);
    assert.ok(shopText.includes(MSG.CONSUMABLE_HP_FULL_RESTORE), '상점 줄: 완전 회복');
    assert.ok(!shopText.includes('9999'), `상점 줄에 9999가 없다: ${shopText}`);
});

test('F6: 휴식 자동완성은 실제 휴식 비용(getRestCost)을 그린다 — Lv40', () => {
    const safeLoc = Object.entries(DB.MAPS).find(([, map]) => map.type === 'safe')?.[0];
    assert.ok(safeLoc, '안전지대 지역이 있다');
    const player = makePlayerFixture({ level: 40, loc: safeLoc });
    const cost = getRestCost(player);
    assert.notEqual(cost, 100, '레벨 40 휴식 비용은 예전 고정 문구(100)와 다르다');

    const rest = getAvailableCommands(GS.IDLE, player).find((entry) => entry.cmd === 'rest');
    assert.ok(rest, '안전지대 idle에서 휴식 제안');
    assert.equal(rest.desc, MSG.CMD_SUGGEST_REST(cost));
    assert.ok(rest.desc.includes(String(cost)));
    assert.ok(!rest.desc.includes('100G'));

    // 거울 할인이 붙어도 같은 함수가 정한다.
    const mirrored = makePlayerFixture({ level: 40, loc: safeLoc, meta: { ...(player.meta || {}), mirror: { rest_discount: 3 } } });
    const mirroredRest = getAvailableCommands(GS.IDLE, mirrored).find((entry) => entry.cmd === 'rest');
    assert.equal(mirroredRest.desc, MSG.CMD_SUGGEST_REST(getRestCost(mirrored)));
});

test('F8: 정화 아이템 문구에 원시 상태 id가 없다 — 데이터의 모든 정화 아이템 × 모든 문구 생성기 · 상점 렌더', () => {
    const cures = DB.ITEMS.consumables.filter((item) => item.type === 'cure');
    assert.ok(cures.length >= 4);
    const rawIds = Object.keys(MSG.STATUS_LABELS);
    const visibleTexts = (item) => [
        getConsumableEffectSummary(item),
        getConsumableDescription(item),
        getConsumableDescription(item, { includeTurnCost: true }),
        getConsumableCompactLabel(item),
        getItemStatText(item),
    ];
    for (const cure of cures) {
        for (const text of visibleTexts(cure)) {
            for (const id of rawIds) assert.ok(!text.includes(id), `${cure.name}: "${text}"에 원시 id ${id}`);
        }
        assert.equal(getConsumableEffectSummary(cure), MSG.CONSUMABLE_CURE_STATUS(MSG.STATUS_LABELS[cure.effect]));
    }

    const player = makePlayerFixture({
        level: 30, gold: 99_999, loc: CONSTANTS.START_LOCATION,
        settings: { ...(INITIAL_STATE.player.settings || {}), equipmentDetailMode: 'full' },
    });
    const html = renderStatic(createElement(ShopPanel, {
        player, shopItems: cures,
        actions: { market: () => {}, clearEconomyReceipt: () => {}, economyReceipt: null },
        stats: null,
    }));
    const shopText = textOf(html);
    for (const cure of cures) {
        assert.ok(shopText.includes(MSG.CONSUMABLE_CURE_STATUS(MSG.STATUS_LABELS[cure.effect])), `${cure.name} 해제 문구`);
    }
    for (const id of rawIds) assert.ok(!new RegExp(`\\b${id}\\b`).test(shopText), `상점 줄에 원시 id ${id}: ${shopText}`);
});

const allDbItems = () => [
    ...DB.ITEMS.weapons,
    ...DB.ITEMS.armors,
    ...DB.ITEMS.consumables,
    ...DB.ITEMS.materials,
].map((item, index) => ({ ...item, id: `db-${index}` }));

/** 리듀서가 받을 수 있게 상태를 맞춘 플레이어 — 생명 · 기력은 비우고, 정화 대상 상태를 걸고, 직업 · 레벨을 맞춘다. */
const primedState = (item) => {
    const base = structuredClone(INITIAL_STATE);
    return {
        ...base,
        gameState: GS.IDLE,
        player: {
            ...base.player,
            level: 99,
            job: Array.isArray(item.jobs) && item.jobs.length ? item.jobs[0] : base.player.job,
            hp: 1,
            mp: 0,
            status: item.type === 'cure' ? [item.effect] : [],
            tempBuff: { atk: 0, def: 0, turn: 0, name: null },
            inv: [item],
        },
    };
};

test('F9: "사용"/"장착" 버튼 판정 = 리듀서(USE_INVENTORY_ITEM) 수락 — DB 아이템 전수', () => {
    const items = allDbItems();
    const kinds = new Set(items.map((item) => item.type));
    assert.ok(kinds.has('mat') && kinds.has('key'), '재료 · 열쇠가 표본에 있다');
    const rejected = items.filter((item) => !isInventoryUseAccepted(item));
    assert.ok(rejected.length >= 50 && rejected.every((item) => item.type === 'mat' || item.type === 'key'), `받지 않는 아이템 ${rejected.length}개는 재료 · 열쇠뿐`);

    for (const item of items) {
        const state = primedState(item);
        const next = gameReducer(state, { type: AT.USE_INVENTORY_ITEM, payload: { itemId: item.id } });
        const reducerAccepts = next !== state;
        assert.equal(isInventoryUseAccepted(item), reducerAccepts, `${item.name}(${item.type}): 버튼 판정 ≠ 리듀서`);
        if (reducerAccepts && ['hp', 'mp', 'cure', 'buff'].includes(item.type)) {
            assert.equal(next.player.inv.length, 0, `${item.name}: 소모품이 실제로 쓰였다`);
        }
    }

    // 실제 인벤토리 렌더: 버튼은 판정이 참인 아이템에만 있다.
    const player = makePlayerFixture({ level: 99, inv: items });
    const html = renderStatic(createElement(SmartInventory, { player, actions: {} }));
    for (const item of items) {
        const rendered = html.includes(`data-testid="inventory-use-${item.id}"`);
        assert.equal(rendered, isInventoryUseAccepted(item), `${item.name}(${item.type}): 버튼 렌더 ≠ 판정`);
    }
    for (const name of ['강화 재료', '잊혀진 열쇠', '원시의 심장']) {
        const item = items.find((entry) => entry.name === name);
        assert.ok(item, name);
        assert.ok(!html.includes(`data-testid="inventory-use-${item.id}"`), `${name}: 눌러도 아무 일 없는 "사용" 버튼이 없다`);
    }
});

test('F12: 강화 물약 라벨은 엔진이 실제로 올리는 능력치만 말한다(영웅의 물약 = 공격력 · 방어력)', () => {
    const buffs = DB.ITEMS.consumables.filter((item) => item.type === 'buff');
    for (const buff of buffs) {
        const item = { ...buff, id: `buff-${buff.name}` };
        const result = resolveConsumableEffect({ player: makePlayerFixture({ inv: [item] }), item });
        assert.equal(result.ok, true, buff.name);
        const raised = { ATK: result.player.tempBuff.atk > 0, DEF: result.player.tempBuff.def > 0 };
        for (const label of [getConsumableCompactLabel(item), getConsumableDescription(item)]) {
            assert.ok(!label.includes('ALL'), `${buff.name}: "${label}"`);
            for (const [stat, isRaised] of Object.entries(raised)) {
                assert.equal(label.includes(stat), isRaised, `${buff.name}: "${label}"의 ${stat}`);
            }
        }
    }
    const hero = buffs.find((item) => item.name === '영웅의 물약');
    assert.match(getConsumableDescription(hero), /ATK.*DEF.*\+50%/);
});

test('F12: 합성 보호 상품의 이름은 모든 표면에서 하나다', () => {
    const name = MSG.SYNTHESIS_PROTECT_ITEM_NAME;
    assert.equal(PREMIUM_SHOP.synthProtect.name, name, '상품 정의');

    const player = makePlayerFixture({ premiumCurrency: 999, stats: { ...(INITIAL_STATE.player.stats || {}), synthProtects: 1 } });
    const offer = getCrystalExchangeOffers(player).find((entry) => entry.id === PREMIUM_SHOP.synthProtect.id);
    assert.equal(offer.name, name, '크리스털 교환 목록');

    const state = { ...structuredClone(INITIAL_STATE), player, logs: [] };
    const purchased = premiumActionMap.PURCHASE_PREMIUM_OFFER(state, {
        type: AT.PURCHASE_PREMIUM_OFFER,
        payload: { offerId: PREMIUM_SHOP.synthProtect.id, expectedCurrency: 999 },
    });
    assert.notEqual(purchased, state, '교환이 실제로 일어났다');
    assert.ok(purchased.logs.at(-1).text.includes(name), `구매 로그: ${purchased.logs.at(-1).text}`);

    // 합성 화면의 보호 비용 줄(CraftingPanel이 보호권 보유 시 그리는 문구).
    assert.ok(MSG.SYNTHESIS_PROTECT_TOKEN_COST(1).startsWith(name), MSG.SYNTHESIS_PROTECT_TOKEN_COST(1));

    const premiumHtml = textOf(renderStatic(createElement(PremiumShop, { player })));
    assert.ok(premiumHtml.includes(name), '크리스털 교환 화면');
    for (const html of [premiumHtml, purchased.logs.at(-1).text, offer.name]) {
        assert.ok(!html.includes('보호석'), `옛 이름 "보호석": ${html}`);
    }
});
