import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAbyssFloorAdvance } from '../src/hooks/combatActions/combatBossHandlers.js';
import { DB } from '../src/data/db.js';
import { CONSTANTS, BALANCE } from '../src/data/constants.js';

/**
 * cycle 179: applyAbyssFloorAdvance의 'legendary_item' milestone 분기 버그 fix.
 *
 * 발견:
 * - combatBossHandlers.ts:92에서 `(DB.ITEMS || []).flat().filter(...)` 사용.
 * - DB.ITEMS는 OBJECT (`{ weapons: [...], armors: [...], ... }`) — 배열 아님.
 * - 결과: object에 .flat() 호출 시 TypeError 발생 (flat is not a function).
 * - 영향: abyss 50층/100층/300층 도달 시 milestone 보상 처리 중 예외 발생.
 *   abyss 진행이 50층에서 중단되거나 보상 silent skip.
 *
 * 수정:
 * - DB.ITEMS의 모든 array 버킷을 명시적으로 펼친 후 tier 5 필터링.
 *   `[...weapons, ...armors, ...shields, ...consumables, ...materials]`
 *   같은 패턴 또는 `Object.values(DB.ITEMS).flat()` 으로 안전 접근.
 */

const fakeDispatch = () => {};
const fakeAddLog = () => {};

test('cycle 179 RED→GREEN: abyss 50층 milestone (legendary_item)이 예외 없이 처리됨', () => {
    const player = {
        loc: CONSTANTS.ABYSS_MAP_NAME,
        stats: { abyssFloor: 49, abyssRecord: 49 },
        inv: [],
        relics: [],
        prestigePoints: 0,
    };

    // 50층 진입 (49 → 50). milestone 50 = legendary_item.
    let result;
    let threw = null;
    try {
        result = applyAbyssFloorAdvance(player, fakeDispatch, fakeAddLog);
    } catch (e) {
        threw = e;
    }

    assert.equal(threw, null, `applyAbyssFloorAdvance가 예외 던지면 안 됨: ${threw?.message}`);
    assert.ok(result, 'result 반환');
    assert.equal(result.stats.abyssFloor, 50);
    // legendary_item milestone 처리 → tier 5 아이템이 inv에 추가됐어야 함.
    assert.ok((result.inv || []).length >= 1,
        'legendary_item milestone이 tier 5 아이템 1개 추가해야 함');
});

test('cycle 179: legendary_item milestone에서 tier 5 아이템 풀이 비어있지 않음 (sanity)', () => {
    const tier5Pool = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []),
        ...(DB.ITEMS.shields || []),
        ...(DB.ITEMS.consumables || []),
        ...(DB.ITEMS.materials || []),
    ].filter((i) => i?.tier === 5);
    assert.ok(tier5Pool.length > 0,
        'DB.ITEMS에 tier 5 아이템이 1개 이상 있어야 milestone 보상 가능');
});

test('회귀 가드: abyss 49층 → 50층 외 milestone 미해당 floor는 inv 변경 없음', () => {
    const player = {
        loc: CONSTANTS.ABYSS_MAP_NAME,
        stats: { abyssFloor: 30, abyssRecord: 30 },
        inv: [{ name: 'preexisting' }],
        relics: [],
    };
    // 31층은 milestone 없음.
    const result = applyAbyssFloorAdvance(player, fakeDispatch, fakeAddLog);
    assert.equal(result.stats.abyssFloor, 31);
    assert.equal(result.inv.length, 1, 'milestone 없는 floor는 inv 그대로');
});
