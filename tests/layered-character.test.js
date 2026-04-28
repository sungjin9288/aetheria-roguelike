import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveCharacterLayers,
    LAYERED_MANIFEST,
    getMissingLayers,
} from '../src/utils/layeredCharacter.js';

/**
 * Job-Based Skin System (cycle 55):
 *   - body PNG가 직업의 skin (cycle 47-53 layered 시도 후 단일화)
 *   - body manifest에 있으면 skin 반환, 없으면 null → 폴백 (cycle 46 sprite)
 *   - armor/weapon/cape/helmet/boots는 슬롯 UI에서만 표시 (avatar에 합성 X)
 */

test('player가 null/job 없으면 null', () => {
    assert.equal(resolveCharacterLayers(null), null);
    assert.equal(resolveCharacterLayers({}), null);
});

test('body manifest에 자산 없으면 null (폴백)', () => {
    LAYERED_MANIFEST.body.delete('adventurer');
    try {
        const result = resolveCharacterLayers({ job: '모험가', equip: {} });
        assert.equal(result, null);
    } finally {
        LAYERED_MANIFEST.body.add('adventurer');
    }
});

test('body manifest에 자산 있으면 skin 반환', () => {
    const result = resolveCharacterLayers({ job: '모험가', equip: {} });
    assert.ok(result);
    assert.equal(result.body, '/assets/avatars/layers/body/adventurer.png');
    assert.deepEqual(result.layerOrder, ['body']);
});

test('cycle 55: 장비를 입어도 avatar에는 body skin만 (armor 무시)', () => {
    const result = resolveCharacterLayers({
        job: '모험가',
        equip: { armor: { type: 'armor', name: '가죽 갑옷' } },
    });
    assert.equal(result.armor, undefined);
    assert.deepEqual(result.layerOrder, ['body']);
});

test('cycle 55: weapon도 avatar에 합성 X (장비 슬롯에서만 표시)', () => {
    const result = resolveCharacterLayers({
        job: '모험가',
        equip: { weapon: { type: 'weapon', name: '녹슨 단검' } },
    });
    assert.equal(result.weapon, undefined);
    assert.deepEqual(result.layerOrder, ['body']);
});

test('직업 정규화 (그림자 주군 → shadow-lord)', () => {
    const result = resolveCharacterLayers({ job: '그림자 주군', equip: {} });
    assert.equal(result.body, '/assets/avatars/layers/body/shadow-lord.png');
});

test('getMissingLayers는 body 누락만 검사 (cycle 55)', () => {
    LAYERED_MANIFEST.body.delete('adventurer');
    try {
        const missing = getMissingLayers({ job: '모험가', equip: {} });
        assert.deepEqual(missing, ['body:adventurer']);
    } finally {
        LAYERED_MANIFEST.body.add('adventurer');
    }

    // body 있으면 missing 비어있음 (장비는 무시)
    const noneMissing = getMissingLayers({
        job: '모험가',
        equip: { armor: { type: 'armor', name: '가죽 갑옷' } },
    });
    assert.deepEqual(noneMissing, []);
});
