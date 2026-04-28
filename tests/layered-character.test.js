import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveCharacterLayers,
    LAYERED_MANIFEST,
    getMissingLayers,
} from '../src/utils/layeredCharacter.js';

/**
 * Job-Based Avatar (cycle 56):
 *   - layered system 비활성 (LAYERED_RENDER_ENABLED=false in source)
 *   - 항상 null 반환 → cycle 46 sprite (직업별 풍부 default) 사용
 *   - manifest는 deploy 호환 위해 유지
 */

test('cycle 56: resolveCharacterLayers는 항상 null (cycle 46 sprite로 폴백)', () => {
    assert.equal(resolveCharacterLayers(null), null);
    assert.equal(resolveCharacterLayers({}), null);
    assert.equal(resolveCharacterLayers({ job: '모험가' }), null);
    assert.equal(resolveCharacterLayers({ job: '나이트', equip: { armor: { type: 'armor', name: '판금 갑옷' } } }), null);
});

test('LAYERED_MANIFEST.body는 14 직업 등록 유지 (재활성 시 즉시 사용 가능)', () => {
    assert.ok(LAYERED_MANIFEST.body.has('adventurer'));
    assert.ok(LAYERED_MANIFEST.body.has('shadow-lord'));
    assert.equal(LAYERED_MANIFEST.body.size, 14);
});

test('getMissingLayers는 layered 비활성 시점에도 manifest 직접 조회', () => {
    LAYERED_MANIFEST.body.delete('adventurer');
    try {
        const missing = getMissingLayers({ job: '모험가' });
        assert.deepEqual(missing, ['body:adventurer']);
    } finally {
        LAYERED_MANIFEST.body.add('adventurer');
    }

    const noneMissing = getMissingLayers({ job: '모험가' });
    assert.deepEqual(noneMissing, []);
});
