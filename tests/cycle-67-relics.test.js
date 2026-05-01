import test from 'node:test';
import assert from 'node:assert/strict';

import { RELICS } from '../src/data/relics.js';

// cycle 67: 탐색/유틸 유물 3종 추가 — 기존 effect 핸들러(event_chance /
// gold_mult / drop_rate)를 재사용해 CombatEngine 변경 없이 빌드 다양성 확보.

const findById = (id) => RELICS.find((r) => r.id === id);

test('wanderer_charm 추가됨 (uncommon event_chance 0.3)', () => {
    const relic = findById('wanderer_charm');
    assert.ok(relic, 'wanderer_charm should exist');
    assert.equal(relic.rarity, 'uncommon');
    assert.equal(relic.effect, 'event_chance');
    assert.equal(relic.val, 0.3);
});

test('merchant_seal 추가됨 (rare gold_mult 0.6)', () => {
    const relic = findById('merchant_seal');
    assert.ok(relic, 'merchant_seal should exist');
    assert.equal(relic.rarity, 'rare');
    assert.equal(relic.effect, 'gold_mult');
    assert.equal(relic.val, 0.6);
});

test('fortune_relic 추가됨 (rare drop_rate 1.0)', () => {
    const relic = findById('fortune_relic');
    assert.ok(relic, 'fortune_relic should exist');
    assert.equal(relic.rarity, 'rare');
    assert.equal(relic.effect, 'drop_rate');
    assert.equal(relic.val, 1.0);
});

test('신규 유물의 effect는 모두 기존 핸들러 재사용 (CombatEngine 변경 없음)', () => {
    const newIds = ['wanderer_charm', 'merchant_seal', 'fortune_relic'];
    const reusedEffects = new Set(['event_chance', 'gold_mult', 'drop_rate']);
    for (const id of newIds) {
        const relic = findById(id);
        assert.ok(reusedEffects.has(relic.effect), `${id} should reuse existing effect`);
    }
});

test('id 충돌 없음 (전체 RELICS에서 unique)', () => {
    const ids = RELICS.map((r) => r.id);
    const set = new Set(ids);
    assert.equal(ids.length, set.size, 'all relic ids should be unique');
});
