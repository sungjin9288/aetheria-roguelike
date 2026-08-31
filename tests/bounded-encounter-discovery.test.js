import assert from 'node:assert/strict';
import test from 'node:test';

import { projectBoundedEncounterDiscoveries } from '../src/utils/boundedEncounterDiscovery.js';

const forestRoots = {
    id: 'forest-roots',
    version: 1,
    region: '고요한 숲',
    family: '뿌리 아래 공명 결계',
    situation: '결계가 깨어난다.',
    eligibility: {},
    choices: [
        {
            id: 'continue-flow',
            label: '결계의 흐름을 이어 둔다',
            tradeoff: '기력 10',
            outcome: { result: '결계를 유지했다.' },
        },
        {
            id: 'break-seal',
            label: '결계를 끊어낸다',
            tradeoff: '생명 8',
            outcome: { result: '결계를 끊었다.' },
        },
    ],
};

const forestAlpha = {
    id: 'forest-alpha',
    version: 1,
    region: '고요한 숲',
    family: '앞선 흔적',
    situation: '먼저 정렬되어야 한다.',
    eligibility: {},
    choices: [{
        id: 'observe',
        label: '흔적을 살핀다',
        tradeoff: '시간',
        outcome: { result: '흔적을 확인했다.' },
    }],
};

const encounters = [forestRoots, forestAlpha];

test('projects canonical encounter copy from an exact expedition receipt', () => {
    const progress = {
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:2': {
                encounterId: 'forest-roots',
                choiceId: 'continue-flow',
                family: '위조된 이름',
                choiceLabel: '위조된 선택',
            },
        },
    };

    assert.deepEqual(projectBoundedEncounterDiscoveries(progress, 'expedition-7', encounters), [{
        encounterId: 'forest-roots',
        encounterVersion: 1,
        choiceId: 'continue-flow',
        family: '뿌리 아래 공명 결계',
        choiceLabel: '결계의 흐름을 이어 둔다',
    }]);
});

test('ignores malformed, foreign, unknown, and key-mismatched receipts independently', () => {
    const projected = projectBoundedEncounterDiscoveries({
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
            'expedition-8:forest-roots:2': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'expedition-7:unknown:3': { encounterId: 'unknown', choiceId: 'missing' },
            'expedition-7:forest-roots:4': { encounterId: 'forest-roots', choiceId: 'missing' },
            'expedition-7:forest-roots:5': { encounterId: 'forest-roots' },
            'expedition-7:forest-roots:not-a-number': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'forged-key': { encounterId: 'forest-roots', choiceId: 'break-seal' },
        },
    }, 'expedition-7', encounters);

    assert.deepEqual(projected.map(({ choiceId }) => choiceId), ['continue-flow']);
});

test('orders by occurrence then code-point identity and deduplicates only identical choices', () => {
    const projected = projectBoundedEncounterDiscoveries({
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:3': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
            'expedition-7:forest-roots:2': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
            'expedition-7:forest-roots:4': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'expedition-7:forest-alpha:4': { encounterId: 'forest-alpha', choiceId: 'observe' },
        },
    }, 'expedition-7', encounters);

    assert.deepEqual(projected.map(({ encounterId, choiceId }) => [encounterId, choiceId]), [
        ['forest-roots', 'continue-flow'],
        ['forest-roots', 'break-seal'],
        ['forest-alpha', 'observe'],
    ]);
});

test('returns an empty list for missing progress, non-plain ledgers, and invalid expedition ids', () => {
    assert.deepEqual(projectBoundedEncounterDiscoveries(null, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({}, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({ boundedEncounterReceipts: [] }, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({ boundedEncounterReceipts: new Map() }, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({ boundedEncounterReceipts: {} }, 'INVALID ID', encounters), []);
});

test('ignores malformed canonical entries without blocking valid discoveries', () => {
    const malformed = [
        { ...forestAlpha, version: 0 },
        { ...forestRoots, id: 'broken-family', family: '  ' },
        { ...forestRoots, id: 'broken-choice', choices: [{ ...forestRoots.choices[0], label: '' }] },
        forestRoots,
    ];
    const progress = {
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
        },
    };

    assert.deepEqual(projectBoundedEncounterDiscoveries(progress, 'expedition-7', malformed), [{
        encounterId: 'forest-roots',
        encounterVersion: 1,
        choiceId: 'continue-flow',
        family: '뿌리 아래 공명 결계',
        choiceLabel: '결계의 흐름을 이어 둔다',
    }]);
});

test('does not mutate receipt state or consume random values', () => {
    const progress = {
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
        },
    };
    const before = structuredClone(progress);
    const originalRandom = Math.random;
    Math.random = () => { throw new Error('projector consumed RNG'); };
    try {
        projectBoundedEncounterDiscoveries(progress, 'expedition-7', encounters);
    } finally {
        Math.random = originalRandom;
    }

    assert.deepEqual(progress, before);
});
