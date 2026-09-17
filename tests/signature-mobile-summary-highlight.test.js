import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import DashboardMobileSummary from '../src/components/DashboardMobileSummary.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * DashboardMobileSummary signature 하이라이트 — mobile viewport 파리티.
 *
 * EquipmentPanel / SmartInventory는 gold tone + 전설 각인 칩을 이미 렌더하는데,
 * 모바일 전용 DashboardMobileSummary의 loadout 타일은 일반 텍스트만 출력한다.
 * iOS/Android 플레이어(Capacitor 빌드)는 이 압축된 UI를 상시로 보게 되므로
 * 여기서 signature 신호가 빠지면 전체 피드백 체인이 모바일에서 끊긴다.
 *
 * 계약(렌더 검증):
 *   1. 각 loadout 타일에 data-is-signature 속성 (아이템별로 정확히 true/false)
 *   2. signature slot에만 안정적 testid: mobile-summary-signature-${slot}
 *   3. signature gold 팔레트(#f6e7a2) 참조
 */

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');

const renderSummary = (equip) => renderStatic(createElement(DashboardMobileSummary, {
    player: makePlayerFixture({ equip }),
}));

test('시그니처 무기를 장착한 loadout 타일은 mobile-summary-signature-weapon과 gold 팔레트를 렌더링한다', () => {
    const html = renderSummary({ weapon: sigWeapon, armor: null, offhand: null });

    assert.ok(html.includes('data-testid="mobile-summary-signature-weapon"'), '무기 슬롯 전용 testid 노출');
    assert.ok(html.includes('data-is-signature="true"'), 'data-is-signature="true" 속성 노출');
    assert.ok(html.includes('#f6e7a2'), 'signature gold 팔레트(#f6e7a2) 사용');
    assert.ok(html.includes(sigWeapon.name), '아이템 이름이 실제로 렌더됨');
});

test('시그니처가 아닌 loadout(기본 장비/빈 슬롯)은 signature 타일을 렌더링하지 않는다', () => {
    const html = renderSummary({ weapon: null, armor: null, offhand: null });

    assert.ok(!html.includes('mobile-summary-signature-'), '시그니처가 없으면 어떤 슬롯도 signature testid를 갖지 않음');
    assert.ok(html.includes('data-is-signature="false"'), '빈 슬롯은 data-is-signature="false"');
    assert.ok(html.includes('비어 있음'), '빈 슬롯 fallback 텍스트 유지');
});

test('시그니처 슬롯과 일반 슬롯이 함께 있을 때 각 슬롯이 독립적으로 표시된다', () => {
    const html = renderSummary({ weapon: sigWeapon, armor: null, offhand: null });

    assert.ok(html.includes('data-testid="mobile-summary-signature-weapon"'), 'weapon 슬롯은 signature 표시');
    assert.ok(!html.includes('mobile-summary-signature-armor'), 'armor 슬롯은 signature 아님 (빈 슬롯)');
    assert.ok(!html.includes('mobile-summary-signature-offhand'), 'offhand 슬롯도 signature 아님');
});
