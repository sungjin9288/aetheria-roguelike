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
    // cycle 53 시점: 14 직업 전부 manifest 등록됨. 임시 제거 후 폴백 검증.
    LAYERED_MANIFEST.body.delete('adventurer');
    try {
        const result = resolveCharacterLayers({ job: '모험가', equip: {} });
        assert.equal(result, null);
    } finally {
        LAYERED_MANIFEST.body.add('adventurer');
    }
});

test('body manifest에 자산 있으면 layered 객체 반환', () => {
    // adventurer는 cycle 47부터 manifest 상주. 별도 add/delete 불필요.
    const result = resolveCharacterLayers({ job: '모험가', equip: {} });
    assert.ok(result);
    assert.equal(result.body, '/assets/avatars/layers/body/adventurer.png');
    assert.deepEqual(result.layerOrder, ['body']);
});

test('armor가 manifest에 있으면 layer에 추가', () => {
    // cycle 53 시점: leather는 manifest 상주. 별도 add 불필요.
    const result = resolveCharacterLayers({
        job: '모험가',
        equip: { armor: { type: 'armor', name: '가죽 갑옷' } },
    });
    assert.ok(result.armor);
    assert.equal(result.armor, '/assets/avatars/layers/armor/leather.png');
    assert.ok(result.layerOrder.includes('armor'));
});

test('weapon은 cycle 54에서 임시 숨김 (hand-grip 무기 재생성 대기)', () => {
    // cycle 54: 현 weapon PNG는 손 없이 무기만 그려져 있어 body의 옆구리 손에
    // 자연스럽게 합성 안 됨. hand-grip 포함 weapon 재생성 후 재활성 예정.
    const result = resolveCharacterLayers({
        job: '모험가',
        equip: { weapon: { type: 'weapon', name: '녹슨 단검' } },
    });
    assert.equal(result.weapon, undefined);
    assert.ok(!result.layerOrder.includes('weapon'));
});

test('layerOrder는 back→front (cape→body→boots→armor→helmet); weapon 임시 제외', () => {
    const result = resolveCharacterLayers({
        job: '모험가',
        equip: {
            weapon: { type: 'weapon', name: '녹슨 단검' },
            armor: { type: 'armor', name: '가죽 갑옷' },
        },
    });
    const idxBody = result.layerOrder.indexOf('body');
    const idxArmor = result.layerOrder.indexOf('armor');
    assert.ok(idxBody < idxArmor, 'body before armor');
    assert.ok(!result.layerOrder.includes('weapon'), 'weapon 임시 비활성 (cycle 54)');
});

test('직업 정규화 (그림자 주군 → shadow-lord)', () => {
    // cycle 53 시점: shadow-lord는 manifest 상주.
    const result = resolveCharacterLayers({ job: '그림자 주군', equip: {} });
    assert.equal(result.body, '/assets/avatars/layers/body/shadow-lord.png');
});

test('getMissingLayers는 누락 자산 식별', () => {
    // cycle 53 시점: 위 자산들은 모두 manifest 등록되어 missing이 아님.
    // 임시로 삭제해서 missing 검출 검증.
    LAYERED_MANIFEST.body.delete('adventurer');
    LAYERED_MANIFEST.armor.delete('leather');
    LAYERED_MANIFEST.weapon.delete('dagger');
    try {
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
    } finally {
        LAYERED_MANIFEST.body.add('adventurer');
        LAYERED_MANIFEST.armor.add('leather');
        LAYERED_MANIFEST.weapon.add('dagger');
    }
});
