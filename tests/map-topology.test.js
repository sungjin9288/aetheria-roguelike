import test from 'node:test';
import assert from 'node:assert/strict';

import { findMapPath, getDefaultMapSelection, getMapRequiredLevel, getNextMapTowardTarget } from '../src/utils/mapTopology.js';

const maps = {
    '시작의 마을': { level: 1, exits: ['고요한 숲', '서쪽 평원'] },
    '고요한 숲': { level: 1, exits: ['시작의 마을', '잊혀진 폐허'] },
    '서쪽 평원': { level: 2, exits: ['시작의 마을', '산길'] },
    '잊혀진 폐허': { level: 5, exits: ['고요한 숲', '산길'] },
    '산길': { level: 7, exits: ['서쪽 평원', '잊혀진 폐허'] },
};

test('findMapPath returns the shortest connected route without looping', () => {
    assert.deepEqual(
        findMapPath(maps, '시작의 마을', '잊혀진 폐허'),
        ['시작의 마을', '고요한 숲', '잊혀진 폐허'],
    );
});

test('getNextMapTowardTarget marks the first branch toward a distant mission', () => {
    assert.equal(
        getNextMapTowardTarget(maps, '시작의 마을', '잊혀진 폐허'),
        '고요한 숲',
    );
    assert.equal(getNextMapTowardTarget(maps, '산길', '없는 지역'), null);
});

test('getMapRequiredLevel keeps numeric, ranged, and abyss requirements explicit', () => {
    assert.equal(getMapRequiredLevel({ level: 5 }, 2), 5);
    assert.equal(getMapRequiredLevel({ level: [12, 18] }, 8), 12);
    assert.equal(getMapRequiredLevel({ level: 'infinite' }, 48), 56);
});

test('getDefaultMapSelection starts from the current location unless an unlocked mission route is direct', () => {
    const routes = [
        { name: '신성한 호수', isMissionRoute: true, isLocked: true },
        { name: '시작의 마을', isMissionRoute: false, isLocked: false },
    ];

    assert.equal(getDefaultMapSelection('고요한 숲', routes), '고요한 숲');
    assert.equal(
        getDefaultMapSelection('시작의 마을', [
            { name: '고요한 숲', isMissionRoute: true, isLocked: false },
            { name: '서쪽 평원', isMissionRoute: false, isLocked: false },
        ]),
        '고요한 숲',
    );
});
