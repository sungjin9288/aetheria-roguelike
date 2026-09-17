import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import StatusBar from '../src/components/StatusBar.tsx';
import EquipmentPanel from '../src/components/EquipmentPanel.tsx';
import { DB } from '../src/data/db.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 상시 status(HUD)는 signature/장비 조화 신호를 의도적으로 배제하고,
 * EquipmentPanel(장비 콘솔)에만 그 detail을 남긴다 — 정보 밀도 분리.
 *
 * 계약(렌더 검증):
 *   1. StatusBar는 signature를 장착해도 signature 관련 노드를 전혀 렌더링하지 않는다
 *   2. StatusBar는 장비 조화(outfit affinity) 노드도 렌더링하지 않는다
 *   3. EquipmentPanel(장비 콘솔)은 signature 칩 + 세트/조화 detail을 유지한다
 */

const sigWeapon = DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아');

test('상시 status는 시그니처 무기를 장착해도 signature 관련 노드를 렌더링하지 않는다', () => {
    const player = makePlayerFixture({ name: '리베아', equip: { weapon: sigWeapon, armor: null, offhand: null } });
    const html = renderStatic(createElement(StatusBar, {
        player,
        stats: { maxHp: player.maxHp, maxMp: player.maxMp },
    }));

    assert.ok(html.includes('data-testid="persistent-status-bar"'), 'StatusBar 자체는 정상 렌더링');
    assert.ok(
        !/isSignatureItem|equippedSignatureCount|status-signature-chip/.test(html),
        '상시 status에는 signature 신호가 전혀 없어야 함',
    );
});

test('상시 status는 장비 조화(outfit affinity) 신호도 렌더링하지 않는다', () => {
    const player = makePlayerFixture({ name: '리베아' });
    const html = renderStatic(createElement(StatusBar, {
        player,
        stats: { maxHp: player.maxHp, maxMp: player.maxMp, jobAffinity: { tier: 'full', matchCount: 3, label: '테스트 세트', bonus: {} } },
    }));

    assert.ok(
        !/OUTFIT_SLOT_COUNT|status-outfit-affinity-chip|장비 조화/.test(html),
        '상시 status에는 장비 조화 chip이 없어야 함',
    );
});

test('장비 콘솔(EquipmentPanel)은 signature 칩과 세트/조화 detail을 그대로 유지한다', () => {
    const player = makePlayerFixture({ level: 10, equip: { weapon: sigWeapon, armor: null, offhand: null } });
    const stats = { atk: 50, def: 20, maxHp: 120, maxMp: 40, jobAffinity: { tier: 'partial1', matchCount: 1, label: '테스트 세트', bonus: {} } };
    const html = renderStatic(createElement(EquipmentPanel, { player, stats, actions: {} }));

    assert.ok(html.includes('data-testid="equipment-signature-chip-weapon"'), '장비 콘솔은 signature 칩 유지');
    assert.ok(html.includes('data-testid="job-outfit-affinity"'), '장비 콘솔은 직업 세트 조화 detail 유지');
});
