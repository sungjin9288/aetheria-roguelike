import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import SmartInventory from '../src/components/SmartInventory.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * Signature 인벤토리 하이라이트 — "relate" 계층.
 *
 * EquipmentPanel과 일관성 있게, SmartInventory의 아이템 행도
 * 전설 각인이면 gold tone + 전설 칩 + data-is-signature 속성을 부여한다.
 *
 * 계약(렌더 검증):
 *   1. 렌더된 행에 data-is-signature 속성 (아이템별로 정확히 true/false)
 *   2. signature일 때 "전설 각인" 텍스트/칩 노출 (testid: inventory-signature-chip-{id})
 *   3. cycle 482가 compact prop cascade로 visibleFiltered IIFE(priority 계산 포함) 자체를
 *      제거했다 — 내부 구현 디테일이라 렌더로 표현 불가, 소스 부재 가드로 보존
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');
const normalPotion = DB.ITEMS.consumables[0];

const renderInventory = (inv) => renderStatic(createElement(SmartInventory, {
    player: makePlayerFixture({ inv }),
    actions: {},
}));

test('시그니처 아이템 행은 data-is-signature="true"와 전설 각인 칩을 렌더링한다', () => {
    const sigInInv = { ...sigWeapon, id: 'sig_1' };
    const html = renderInventory([sigInInv]);

    assert.ok(html.includes('data-is-signature="true"'), '시그니처 행이 data-is-signature="true"를 노출');
    assert.ok(html.includes(`data-testid="inventory-signature-chip-${sigInInv.id}"`), '전용 testid로 칩 노출');
    assert.ok(html.includes('전설 각인'), '"전설 각인" 라벨 노출');
});

test('일반 아이템 행은 data-is-signature="false"이고 전설 각인 칩이 없다', () => {
    const html = renderInventory([{ ...normalPotion, id: 'normal_1' }]);

    assert.ok(html.includes('data-is-signature="false"'), '일반 아이템 행은 data-is-signature="false"');
    assert.ok(!html.includes('inventory-signature-chip'), '전설 각인 칩이 렌더되지 않음');
});

test('시그니처 아이템과 일반 아이템이 섞여도 각 행이 독립적으로 정확히 표시된다', () => {
    const sigInInv = { ...sigWeapon, id: 'sig_2' };
    const normalInInv = { ...normalPotion, id: 'normal_2' };
    const html = renderInventory([sigInInv, normalInInv]);

    assert.ok(html.includes(`data-testid="inventory-signature-chip-${sigInInv.id}"`), '시그니처 행에만 칩 존재');
    assert.ok(!html.includes(`inventory-signature-chip-${normalInInv.id}`), '일반 행에는 칩 없음');
    // 두 행 모두 렌더됐는지 이름으로 교차 확인
    assert.ok(html.includes(sigInInv.name));
    assert.ok(html.includes(normalInInv.name));
});

test('(정적 가드) cycle 482 cascade로 제거된 visibleFiltered IIFE가 되살아나지 않는다', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(!/visibleFiltered/.test(source), 'cycle 482가 제거한 priority 계산용 visibleFiltered IIFE 재도입 금지');
});
