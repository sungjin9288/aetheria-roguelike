import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    NATURAL_EXPLORATION_OUTCOMES,
    NATURAL_EXPLORATION_REQUIRED_GATES,
    NATURAL_EXPLORATION_SEEDS,
    NATURAL_EXPLORATION_SOURCE_CONTRACT,
    buildNaturalExplorationReport,
    serializeNaturalExplorationReport,
} from './e2e/naturalExplorationReport.ts';

const validGates = () => Object.fromEntries(
    NATURAL_EXPLORATION_REQUIRED_GATES.map((gate) => [gate, true]),
);

const validSurfaceObservation = (overrides = {}) => ({
    device: {
        model: 'iPhone 12',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
    },
    freshContextCount: 2,
    seeds: [...NATURAL_EXPLORATION_SEEDS],
    outcomes: [...NATURAL_EXPLORATION_OUTCOMES],
    ordinaryActionsBetweenNarratives: 2,
    sequence: [
        {
            kind: 'mandatory_event',
            visibleTitle: '마법의 흔적',
            visibleText: '숲 한가운데에서 이상한 마법 연기가 피어오릅니다. 주변에는 불에 탄 흔적과 지팡이 파편이 있습니다.',
        },
        {
            kind: 'combat',
            seed: 112596,
            combatSurfaceVisible: true,
            wonThroughVisibleAttacks: true,
        },
        {
            kind: 'nothing',
            seed: 8,
            exploreControlVisible: true,
            eventSurfaceVisible: false,
            combatSurfaceVisible: false,
        },
        {
            kind: 'bounded_event',
            seed: 37,
            visibleSituation: '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.',
            visibleChoices: ['돌기둥의 문장을 읽는다', '무거운 돌을 들어 올린다'],
        },
    ],
    ...overrides,
});

const validInput = (overrides = {}) => ({
    sourceContract: NATURAL_EXPLORATION_SOURCE_CONTRACT,
    surfaceObservation: validSurfaceObservation(),
    gates: validGates(),
    errors: {
        page: [],
        console: [],
        response: [],
        request: [],
    },
    ...overrides,
});

test('canonical report separates exact source contract from automated surface observation', () => {
    const report = buildNaturalExplorationReport(validInput());

    assert.deepEqual(report, {
        schemaVersion: 2,
        classification: 'automated-real-surface-report-only',
        actualPlayClaim: false,
        humanObserved: false,
        sourceContract: NATURAL_EXPLORATION_SOURCE_CONTRACT,
        surfaceObservation: validSurfaceObservation(),
        gates: validGates(),
        errors: {
            page: [],
            console: [],
            response: [],
            request: [],
        },
    });
    assert.equal(Object.isFrozen(report), true);
    assert.equal(Object.isFrozen(report.sourceContract), true);
    assert.equal(Object.isFrozen(report.surfaceObservation.sequence), true);
});

test('volatile metadata and caller claims cannot alter canonical bytes', () => {
    const first = serializeNaturalExplorationReport(validInput({
        timestamp: '2026-08-28T00:00:00.000Z',
        absolutePath: '/tmp/one/report.json',
        contextId: 'first-context',
        elapsedMs: 11,
        subpixelCoordinates: { x: 12.25, y: 44.5 },
        classification: 'human-play-report',
        actualPlayClaim: true,
        humanObserved: true,
    }));
    const second = serializeNaturalExplorationReport(validInput({
        timestamp: '2026-08-28T00:01:00.000Z',
        absolutePath: '/tmp/two/report.json',
        contextId: 'second-context',
        elapsedMs: 999,
        subpixelCoordinates: { x: 12.75, y: 44.125 },
        classification: 'different-claim',
        actualPlayClaim: true,
        humanObserved: true,
    }));

    assert.equal(first, second);
    assert.doesNotMatch(first, /timestamp|absolutePath|contextId|elapsedMs|subpixel|human-play|different-claim/i);
});

test('source and surface provenance are exact and fail closed', () => {
    const invalidCases = [
        ['source profile version', {
            sourceContract: {
                ...NATURAL_EXPLORATION_SOURCE_CONTRACT,
                profile: { ...NATURAL_EXPLORATION_SOURCE_CONTRACT.profile, version: 2 },
            },
        }],
        ['source profile multiplier', {
            sourceContract: {
                ...NATURAL_EXPLORATION_SOURCE_CONTRACT,
                profile: { ...NATURAL_EXPLORATION_SOURCE_CONTRACT.profile, eventMultiplier: 0.8 },
            },
        }],
        ['source minimum gap', {
            sourceContract: { ...NATURAL_EXPLORATION_SOURCE_CONTRACT, minimumOrdinaryGap: 1 },
        }],
        ['mandatory source mapping', {
            sourceContract: {
                ...NATURAL_EXPLORATION_SOURCE_CONTRACT,
                mandatoryEvent: { sourceId: 'other', visibleTitle: '마법의 흔적' },
            },
        }],
        ['bounded situation mapping', {
            sourceContract: {
                ...NATURAL_EXPLORATION_SOURCE_CONTRACT,
                boundedEncounter: {
                    ...NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter,
                    visibleSituation: '다른 상황',
                },
            },
        }],
        ['bounded choice mapping', {
            sourceContract: {
                ...NATURAL_EXPLORATION_SOURCE_CONTRACT,
                boundedEncounter: {
                    ...NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter,
                    visibleChoices: ['다른 선택', '무거운 돌을 들어 올린다'],
                },
            },
        }],
        ['wrong device model', {
            surfaceObservation: {
                ...validSurfaceObservation(),
                device: { ...validSurfaceObservation().device, model: 'iPhone 11' },
            },
        }],
        ['wrong viewport', {
            surfaceObservation: {
                ...validSurfaceObservation(),
                device: {
                    ...validSurfaceObservation().device,
                    viewport: { width: 375, height: 812 },
                },
            },
        }],
        ['wrong context count', {
            surfaceObservation: { ...validSurfaceObservation(), freshContextCount: 1 },
        }],
        ['wrong seed order', {
            surfaceObservation: { ...validSurfaceObservation(), seeds: [8, 112596, 37] },
        }],
        ['wrong outcome order', {
            surfaceObservation: {
                ...validSurfaceObservation(),
                outcomes: ['combat', 'mandatory_story', 'nothing', 'bounded_encounter'],
            },
        }],
        ['wrong gap', {
            surfaceObservation: { ...validSurfaceObservation(), ordinaryActionsBetweenNarratives: 1 },
        }],
        ['wrong sequence seed', {
            surfaceObservation: {
                ...validSurfaceObservation(),
                sequence: validSurfaceObservation().sequence.map((step) => (
                    step.kind === 'combat' ? { ...step, seed: 8 } : step
                )),
            },
        }],
        ['false gate', { gates: { ...validGates(), cadence: false } }],
        ['missing gate', {
            gates: (() => {
                const gates = validGates();
                delete gates.cadence;
                return gates;
            })(),
        }],
        ['extra gate', { gates: { ...validGates(), extra: true } }],
        ['non-empty page errors', { errors: { page: ['page error'], console: [], response: [], request: [] } }],
        ['missing error array', { errors: { page: [], console: [], response: [] } }],
        ['extra error key', { errors: { page: [], console: [], response: [], request: [], extra: [] } }],
        ['unknown top-level input', { unknown: true }],
    ];

    for (const [label, overrides] of invalidCases) {
        assert.throws(
            () => serializeNaturalExplorationReport(validInput(overrides)),
            /NATURAL_EXPLORATION_REPORT_INVALID/,
            label,
        );
    }
});

test('report output has no live state internals and observation uses only the seed seam', () => {
    const sourcePaths = [
        new URL('./e2e/natural-exploration-rhythm.spec.ts', import.meta.url),
        new URL('./e2e/naturalExplorationReport.ts', import.meta.url),
    ];
    const source = sourcePaths
        .map((sourcePath) => readFileSync(fileURLToPath(sourcePath), 'utf8'))
        .join('\n');
    const forbidden = [
        'render' + '_game_to_text',
        'activeExpedition' + 'Profile',
        'expeditionStart' + 'Explores',
        'total' + 'Explores',
        'sinceNarrative' + 'Event',
        'last' + 'Outcome',
        'chain' + 'Id',
        'authority' + 'Kind',
        'inject' + 'Event',
        'seedBounded' + 'EncounterScenario',
        'send' + 'Command',
        'dis' + 'patch',
    ];
    for (const identifier of forbidden) {
        assert.doesNotMatch(source, new RegExp(identifier), identifier);
    }
    assert.match(source, /armNextExploreSeed/);
});

test('real-surface collector never masks AI proxy traffic', () => {
    const source = readFileSync(
        fileURLToPath(new URL('./e2e/natural-exploration-rhythm.spec.ts', import.meta.url)),
        'utf8',
    );

    assert.match(source, /const OPTIONAL_LOCAL_RESOURCE_PATHS = new Set\(\['\/favicon\.ico'\]\)/);
    assert.doesNotMatch(
        source,
        /OPTIONAL_LOCAL_RESOURCE_PATHS\s*=\s*new Set\([^)]*api\/ai-proxy/,
    );
    assert.match(source, /aiProxyRequests\.push\(`/);
    assert.match(source, /expect\(first\.aiProxyRequests\)\.toEqual\(\[\]\)/);
    assert.match(source, /expect\(second\.aiProxyRequests\)\.toEqual\(\[\]\)/);
});
