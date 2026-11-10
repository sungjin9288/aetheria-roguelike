import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import SmartInventory from '../src/components/SmartInventory.tsx';
import { getPostCombatRecommendation } from '../src/utils/outcomeAnalysis.js';
import { getExpeditionReturnAction } from '../src/utils/expeditionReturnFlow.js';
import { DB } from '../src/data/db.js';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-11 화면 점검: 결과 카드 · 원정 정리의 '회복 아이템 확인'이 가방을 '전체'로 열어,
 * 가방이 찬 뒤에는 단추가 말한 물건을 다시 찾아야 했다. 추천이 분류를 싣고 가방이 그 분류로 열린다.
 */

const potion = DB.ITEMS.consumables.find((item) => item.type === 'hp');
const material = (DB.ITEMS.materials || []).find((item) => item.type === 'mat');

test('회복이 필요한 추천은 가방의 회복 분류를 싣는다 — 다른 추천은 분류를 정하지 않는다', () => {
    const hpLow = getPostCombatRecommendation({ playerHp: 10, playerMaxHp: 180, playerMp: 80, playerMaxMp: 80, items: [] });
    assert.equal(hpLow.label, '회복 아이템 확인');
    assert.equal(hpLow.inventoryFilter, 'hp');

    const mpLow = getPostCombatRecommendation({ playerHp: 180, playerMaxHp: 180, playerMp: 2, playerMaxMp: 80, items: [] });
    assert.equal(mpLow.inventoryFilter, 'hp');

    const invFull = getPostCombatRecommendation({ playerHp: 180, playerMaxHp: 180, playerMp: 80, playerMaxMp: 80, invFull: true, items: [] });
    assert.equal(invFull.label, '가방 정리');
    assert.equal(invFull.inventoryFilter, undefined);
});

test('원정 정리의 회복 아이템 확인도 회복 분류로 연다', () => {
    const player = makePlayerFixture({ hp: 10, maxHp: 200, gold: 0, inv: [potion] });
    const action = getExpeditionReturnAction(player, { kills: 0, items: [] });
    assert.equal(action.kind, 'open_inventory');
    assert.equal(action.inventoryFilter, 'hp');
});

test('가방은 요청된 분류로 열린다 — 요청이 없으면 전체다', () => {
    assert.ok(potion && material, '픽스처 아이템');
    const player = makePlayerFixture({ inv: [potion, material] });

    const requested = renderStatic(createElement(SmartInventory, { player, filterRequest: { filter: 'hp', nonce: 1 } }));
    assert.ok(requested.includes(potion.name), '회복 물약이 보인다');
    assert.ok(!requested.includes(material.name), '재료는 회복 분류에서 빠진다');

    const plain = renderStatic(createElement(SmartInventory, { player }));
    assert.ok(plain.includes(potion.name) && plain.includes(material.name), '요청이 없으면 전체');
});
