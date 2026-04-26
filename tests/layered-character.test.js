import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveCharacterLayers,
    LAYERED_MANIFEST,
    getMissingLayers,
} from '../src/utils/layeredCharacter.js';

/**
 * Layered Character System (cycle 47):
 *   - body가 manifest에 있으면 layered 합성
 *   - 없으면 null 반환 → 폴백 (cycle 46 직업 sprite)
 *   - 각 부분 layer는 manifest에 있으면만 PNG path 반환
 */

test('player가 null/job 없으면 null', () => {
    assert.equal(resolveCharacterLayers(null), null);
    assert.equal(resolveCharacterLayers({}), null);
});

test('body manifest에 자산 없으면 null (폴백 동작)', () => {
    // body 자산이 등록되지 않은 직업은 폴백
    const result = resolveCharacterLayers({ job: '버서커', equip: {} });
    assert.equal(result, null);
});

test('body manifest에 추가 시 layered 객체 반환', () => {
    LAYERED_MANIFEST.body.add('adventurer');
    try {
        const result = resolveCharacterLayers({ job: '모험가', equip: {} });
        assert.ok(result);
        assert.equal(result.body, '/assets/avatars/layers/body/adventurer.png');
        assert.deepEqual(result.layerOrder, ['body']);
    } finally {
        LAYERED_MANIFEST.body.delete('adventurer');
    }
});

test('armor가 manifest에 있으면 layer에 추가', () => {
    LAYERED_MANIFEST.body.add('adventurer');
    LAYERED_MANIFEST.armor.add('leather');
    try {
        const result = resolveCharacterLayers({
            job: '모험가',
            equip: { armor: { type: 'armor', name: '가죽 갑옷' } },
        });
        assert.ok(result.armor);
        assert.equal(result.armor, '/assets/avatars/layers/armor/leather.png');
        assert.ok(result.layerOrder.includes('armor'));
    } finally {
        LAYERED_MANIFEST.body.delete('adventurer');
        LAYERED_MANIFEST.armor.delete('leather');
    }
});

test('weapon이 manifest에 있으면 layer에 추가', () => {
    LAYERED_MANIFEST.body.add('adventurer');
    LAYERED_MANIFEST.weapon.add('dagger');
    try {
        const result = resolveCharacterLayers({
            job: '모험가',
            equip: { weapon: { type: 'weapon', name: '녹슨 단검' } },
        });
        assert.equal(result.weapon, '/assets/avatars/layers/weapon/dagger.png');
        assert.ok(result.layerOrder.includes('weapon'));
    } finally {
        LAYERED_MANIFEST.body.delete('adventurer');
        LAYERED_MANIFEST.weapon.delete('dagger');
    }
});

test('layerOrder는 back→front (cape→body→boots→armor→weapon→helmet)', () => {
    LAYERED_MANIFEST.body.add('adventurer');
    LAYERED_MANIFEST.armor.add('leather');
    LAYERED_MANIFEST.weapon.add('dagger');
    try {
        const result = resolveCharacterLayers({
            job: '모험가',
            equip: {
                weapon: { type: 'weapon', name: '녹슨 단검' },
                armor: { type: 'armor', name: '가죽 갑옷' },
            },
        });
        const idxBody = result.layerOrder.indexOf('body');
        const idxArmor = result.layerOrder.indexOf('armor');
        const idxWeapon = result.layerOrder.indexOf('weapon');
        assert.ok(idxBody < idxArmor, 'body before armor');
        assert.ok(idxArmor < idxWeapon, 'armor before weapon (weapon 손에 든 것이 가장 앞)');
    } finally {
        LAYERED_MANIFEST.body.delete('adventurer');
        LAYERED_MANIFEST.armor.delete('leather');
        LAYERED_MANIFEST.weapon.delete('dagger');
    }
});

test('직업 정규화 (그림자 주군 → shadow-lord)', () => {
    LAYERED_MANIFEST.body.add('shadow-lord');
    try {
        const result = resolveCharacterLayers({ job: '그림자 주군', equip: {} });
        assert.equal(result.body, '/assets/avatars/layers/body/shadow-lord.png');
    } finally {
        LAYERED_MANIFEST.body.delete('shadow-lord');
    }
});

test('getMissingLayers는 누락 자산 식별', () => {
    const missing = getMissingLayers({
        job: '모험가',
        equip: {
            weapon: { type: 'weapon', name: '녹슨 단검' },
            armor: { type: 'armor', name: '가죽 갑옷' },
        },
    });
    assert.ok(missing.includes('body:adventurer'));
    assert.ok(missing.includes('armor:leather'));
    assert.ok(missing.includes('weapon:dagger'));
});
