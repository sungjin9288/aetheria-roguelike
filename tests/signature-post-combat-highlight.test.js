import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * PostCombatCard — signature 각인이 loot에 포함됐을 때 "Legendary" 전용 row로 강조.
 *
 * 기존에는 lootSummary = "아이템1 · 아이템2 외 N" 한 줄에 signature가 묻혀 있었음.
 * 보스를 잡고 얻는 가장 큰 순간을 시각적으로 두드러지게 만들기 위해
 * Field Report 상단에 gold-bordered row를 추가한다.
 *
 * 계약(렌더 검증):
 *   1. droppedItems 중 signature 이름만 골라 별도 row(post-combat-legendary)로 렌더
 *   2. 일반 loot 요약에서는 signature 제외 (중복 방지)
 *   3. Sparkles 아이콘 + "Legendary" 레이블 + gold 팔레트(#f6e7a2)
 *   4. signatureLoot만 있고 다른 loot/signal이 없어도 패널이 렌더된다
 */

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');
const normalPotion = DB.ITEMS.consumables[0];

const renderCard = (result) => renderStatic(createElement(PostCombatCard, { result, onClose: () => {} }));

test('signature 각인이 loot에 있으면 post-combat-legendary row로 별도 강조된다', () => {
    const html = renderCard({ enemy: '마왕', items: [sigWeapon.name, normalPotion.name], leveledUp: false });

    assert.ok(html.includes('data-testid="post-combat-legendary"'), 'Legendary row가 렌더링됨');
    assert.ok(html.includes('Legendary'), '"Legendary" 레이블 노출');
    assert.ok(html.includes('f6e7a2'), 'gold 팔레트(#f6e7a2) 사용');
    assert.ok(html.includes(sigWeapon.name), 'signature 아이템 이름이 Legendary row에 노출');
});

test('signature 아이템은 일반 loot 요약에서 제외되어 중복 노출되지 않는다', () => {
    const html = renderCard({ enemy: '마왕', items: [sigWeapon.name, normalPotion.name], leveledUp: false });

    // signature 이름은 Legendary row 한 곳에만 등장해야 한다 (일반 요약에 중복 노출 금지)
    const occurrences = html.split(sigWeapon.name).length - 1;
    assert.equal(occurrences, 1, 'signature 이름은 정확히 한 번만 렌더됨 (Legendary row 전용)');
    assert.ok(html.includes(normalPotion.name), '일반 아이템은 그대로 일반 요약에 노출');
});

test('signature loot만 있고 다른 일반 loot/보상 신호가 없어도 패널이 렌더된다', () => {
    const html = renderCard({ enemy: '마왕', items: [sigWeapon.name], leveledUp: false });

    assert.ok(html.includes('data-testid="post-combat-legendary"'), 'signature만 있어도 Legendary row 렌더');
    assert.ok(html.includes('data-testid="post-combat-card"'), '패널 자체가 정상적으로 렌더됨');
});

test('signature 각인이 없으면 Legendary row가 렌더되지 않는다 (회귀 가드)', () => {
    const html = renderCard({ enemy: '슬라임', items: [normalPotion.name], leveledUp: false });

    assert.ok(!html.includes('post-combat-legendary'), 'signature가 없으면 Legendary row 미노출');
    assert.ok(html.includes(normalPotion.name), '일반 loot 요약은 정상 노출');
});
