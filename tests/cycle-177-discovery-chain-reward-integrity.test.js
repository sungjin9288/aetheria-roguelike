import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MAPS } from '../src/data/maps.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 177: BALANCE.DISCOVERY_CHAINS 정합성 가드 + reward.item 3건 fix.
 *
 * 발견:
 * - 5종 발견 체인 중 3종(fire_convergence / frozen_truth / demon_trail)이
 *   items.ts 미등록 reward.item 참조 — '용의 숨결' / '영원의 빙결정' /
 *   '마왕의 인장'.
 * - exploreUtils.checkDiscoveryChains의 'DB.ITEMS.allItems.find'가 못 찾으면
 *   item 추가 분기 skip → 골드/EXP만 부여, 핵심 보상 silent 누락.
 * - 4 발견 체인 위업이 완료해도 1.5/2배 가격의 무기 보상이 사라지던 회귀.
 *
 * 수정 (src/data/constants.ts):
 *
 * | 기존 missing item | → 교체 (items.ts 등록 tier 5)         |
 * |-------------------|---------------------------------------|
 * | 용의 숨결         | 용의 화염 (화염 무기 ATK+155)         |
 * | 영원의 빙결정     | 빙결의 왕관검 (냉기 무기 ATK+185)     |
 * | 마왕의 인장       | 마왕의 대낫 (어둠 무기 ATK+220)       |
 *
 * 가드:
 * 1. DISCOVERY_CHAINS의 모든 reward.item이 items.ts에 등록.
 * 2. 모든 chain.locations가 MAPS에 존재.
 * 3. id 유일성 + 필수 필드 (id / label / locations / reward).
 */

test('DISCOVERY_CHAINS reward.item이 모두 items.ts 등록됨', () => {
    const allItemNames = new Set();
    for (const arr of Object.values(DB.ITEMS)) {
        if (Array.isArray(arr)) for (const i of arr) if (i.name) allItemNames.add(i.name);
    }
    const chains = BALANCE.DISCOVERY_CHAINS || [];
    const missing = [];
    for (const chain of chains) {
        if (chain.reward?.item && !allItemNames.has(chain.reward.item)) {
            missing.push(`${chain.id}: '${chain.reward.item}'`);
        }
    }
    assert.deepEqual(missing, [],
        `DISCOVERY_CHAINS에 items.ts 미등록 reward.item:\n  ${missing.join('\n  ')}`);
});

test('DISCOVERY_CHAINS의 모든 chain.locations가 MAPS에 존재', () => {
    const mapKeys = new Set(Object.keys(MAPS));
    const chains = BALANCE.DISCOVERY_CHAINS || [];
    const missing = [];
    for (const chain of chains) {
        for (const loc of chain.locations || []) {
            if (!mapKeys.has(loc)) missing.push(`${chain.id}: '${loc}' not in MAPS`);
        }
    }
    assert.deepEqual(missing, []);
});

test('DISCOVERY_CHAINS 필수 필드 + id 유일성', () => {
    const chains = BALANCE.DISCOVERY_CHAINS || [];
    const ids = new Map();
    const missingFields = [];
    for (const chain of chains) {
        if (!chain.id) missingFields.push('chain without id');
        if (!chain.label) missingFields.push(`chain ${chain.id}: no label`);
        if (!Array.isArray(chain.locations) || chain.locations.length === 0) missingFields.push(`chain ${chain.id}: no locations`);
        if (!chain.reward) missingFields.push(`chain ${chain.id}: no reward`);
        if (chain.id) ids.set(chain.id, (ids.get(chain.id) || 0) + 1);
    }
    const dupes = [...ids.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(missingFields, []);
    assert.deepEqual(dupes, []);
});

test('cycle 177: 3 reward.item 매핑 명시 가드', () => {
    const chains = BALANCE.DISCOVERY_CHAINS || [];
    const fireC = chains.find((c) => c.id === 'fire_convergence');
    const frozenT = chains.find((c) => c.id === 'frozen_truth');
    const demonT = chains.find((c) => c.id === 'demon_trail');
    assert.equal(fireC.reward.item, '용의 화염');
    assert.equal(frozenT.reward.item, '빙결의 왕관검');
    assert.equal(demonT.reward.item, '마왕의 대낫');
});
