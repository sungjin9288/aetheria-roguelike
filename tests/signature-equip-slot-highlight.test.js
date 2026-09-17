import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import EquipmentPanel from '../src/components/EquipmentPanel.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * Signature equip slot highlight — 상시 "celebrate" 계층.
 *
 * 세트 보너스 카드는 2개 이상 착용했을 때만 뜬다. 하나만 착용한 플레이어는
 * 자신이 전설 각인을 장비 중이라는 시각적 피드백이 없다.
 * EquipmentPanel의 각 slot에 다음이 있어야 한다:
 *   - data-is-signature="true|false" 속성 (테스트 + 디버깅 훅)
 *   - 시그니처 아이템일 때 gold tone으로 구분되는 스타일 + "전설 각인" 칩
 *
 * 계약(렌더 검증). isEarlyJourney(level<5 && job==='모험가') 상태에서는
 * showDetails가 꺼져 slot 상세 자체가 숨겨지므로, level을 올려 상세를 연다.
 */

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');

const renderEquipment = (player) => renderStatic(createElement(EquipmentPanel, { player, stats: null, actions: {} }));

test('시그니처 무기를 장착하면 해당 slot이 data-is-signature="true"와 전설 각인 칩을 렌더링한다', () => {
    const player = makePlayerFixture({ level: 10, equip: { weapon: sigWeapon, armor: null, offhand: null } });
    const html = renderEquipment(player);

    assert.ok(
        html.includes('data-testid="equipment-slot-weapon" data-is-signature="true"'),
        'weapon slot이 data-is-signature="true"를 노출',
    );
    assert.ok(html.includes('data-testid="equipment-signature-chip-weapon"'), '시그니처 칩이 전용 testid로 렌더링됨');
    assert.ok(html.includes('전설 각인'), '"전설 각인" 라벨 노출');
});

test('시그니처가 아닌 slot은 data-is-signature="false"이며 전설 각인 칩이 없다', () => {
    const player = makePlayerFixture({ level: 10, equip: { weapon: sigWeapon, armor: null, offhand: null } });
    const html = renderEquipment(player);

    assert.ok(
        html.includes('data-testid="equipment-slot-armor" data-is-signature="false"'),
        '비어있는 armor slot은 data-is-signature="false"',
    );
    assert.ok(!html.includes('equipment-signature-chip-armor'), 'armor slot에는 시그니처 칩이 없음');
});

test('시그니처 무기가 없으면 어떤 slot도 전설 각인 칩을 렌더링하지 않는다 (회귀 가드)', () => {
    const player = makePlayerFixture({ level: 10 }); // 기본 장비(DB.ITEMS 첫 무기/방어구)는 signature가 아님
    const html = renderEquipment(player);

    assert.ok(!html.includes('equipment-signature-chip'), '시그니처가 없으면 칩 자체가 렌더되지 않음');
    assert.ok(html.includes('data-testid="equipment-slot-weapon" data-is-signature="false"'), 'weapon slot은 false');
});
