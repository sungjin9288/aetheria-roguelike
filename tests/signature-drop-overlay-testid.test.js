import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import LegendaryDropOverlay from '../src/components/LegendaryDropOverlay.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * LegendaryDropOverlay — signature surface 일관성 wrap-up.
 *
 * cycle 11~29에 걸쳐 모든 signature surface는 stable testid를 가졌다:
 * legendary-codex-empty-hint, ascension-signature-preserve,
 * run-summary-signatures, status-signature-chip, combat-signature-drop-hint,
 * mobile-summary-signature-${slot}, move-recommendation-signature-${name},
 * inventory-signature-chip-${id}, equipment-signature-chip-${slot},
 * grave-signature-bounty-${uid}, bestiary-signature-drops,
 * legendary-codex-pity-status, post-combat-legendary.
 *
 * 단 한 곳, drop 모먼트의 풀스크린 overlay만 testid 없이 동적
 * data-legendary-drop={item.name} 속성에만 의존했다. 이 사이클로 일관성을 닫는다.
 *
 * 계약(렌더 검증):
 *   1. data-testid="legendary-drop-overlay" 노출
 *   2. 기존 data-legendary-drop={item.name} 회귀 보존
 *   3. 기존 role="alertdialog" 회귀 보존 (스크린리더 지원)
 *   4. item이 없으면 아무것도 렌더링하지 않는다 (AnimatePresence 게이트)
 */

const sigItem = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');

test('전제: DB.ITEMS.weapons에 시그니처 아이템 성검 에테르니아가 존재한다', () => {
    assert.ok(sigItem, '테스트가 실제 게임 데이터를 기반으로 동작함을 보장');
});

test('LegendaryDropOverlay는 item이 주어지면 legendary-drop-overlay를 실제로 렌더링한다', () => {
    const html = renderStatic(createElement(LegendaryDropOverlay, { item: sigItem, onDismiss: () => {} }));

    assert.ok(html.includes('data-testid="legendary-drop-overlay"'), 'data-testid="legendary-drop-overlay" 노출');
    assert.ok(html.includes(`data-legendary-drop="${sigItem.name}"`), 'data-legendary-drop={item.name} 동적 속성 보존 (per-item 선택용)');
    assert.ok(html.includes('role="alertdialog"'), 'role="alertdialog" 보존 (스크린리더 안내)');
    assert.ok(html.includes(sigItem.name), '아이템 이름이 실제로 화면에 노출됨');
});

test('LegendaryDropOverlay는 item이 없으면 아무것도 렌더링하지 않는다', () => {
    const html = renderStatic(createElement(LegendaryDropOverlay, { item: null, onDismiss: () => {} }));
    assert.equal(html, '', 'item이 null이면 AnimatePresence가 빈 출력을 반환');
});
