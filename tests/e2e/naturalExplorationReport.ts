const REPORT_CLASSIFICATION = 'automated-real-surface-report-only' as const;

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): Readonly<T> => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
    seen.add(value as object);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
    return Object.freeze(value);
};

export const NATURAL_EXPLORATION_SOURCE_CONTRACT = deepFreeze({
    profile: {
        id: 'exploration-rhythm',
        version: 3,
        expMultiplier: 1,
        lootMultiplier: 1,
        eventMultiplier: 0.64,
    },
    minimumOrdinaryGap: 2,
    mandatoryEvent: {
        sourceId: 'lost_wizard',
        visibleTitle: '마법의 흔적',
    },
    boundedEncounter: {
        sourceId: 'forest-old-pillars',
        visibleSituation: '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.',
        visibleChoices: ['돌기둥의 문장을 읽는다', '무거운 돌을 들어 올린다'],
    },
});

export const NATURAL_EXPLORATION_SEEDS = deepFreeze([112596, 8, 37]);

export const NATURAL_EXPLORATION_OUTCOMES = deepFreeze([
    'mandatory_story',
    'combat',
    'nothing',
    'bounded_encounter',
]);

export const NATURAL_EXPLORATION_REQUIRED_GATES = deepFreeze([
    'freshContext',
    'runtime',
    'mandatoryEvent',
    'naturalCombat',
    'naturalNothing',
    'boundedEncounter',
    'cadence',
    'documentOverflow',
    'localOverflow',
    'choiceTouchTargets',
    'readableLeafFont',
    'panelReachable',
    'choicesReachable',
    'locationVisual',
    'pageErrorsEmpty',
    'consoleErrorsEmpty',
    'responseErrorsEmpty',
    'requestErrorsEmpty',
]);

const PROFILE_KEYS = ['eventMultiplier', 'expMultiplier', 'id', 'lootMultiplier', 'version'];
const SOURCE_KEYS = ['boundedEncounter', 'mandatoryEvent', 'minimumOrdinaryGap', 'profile'];
const MANDATORY_KEYS = ['sourceId', 'visibleTitle'];
const BOUNDED_KEYS = ['sourceId', 'visibleChoices', 'visibleSituation'];
const DEVICE_KEYS = ['deviceScaleFactor', 'hasTouch', 'isMobile', 'model', 'viewport'];
const VIEWPORT_KEYS = ['height', 'width'];
const SURFACE_KEYS = [
    'device',
    'freshContextCount',
    'ordinaryActionsBetweenNarratives',
    'outcomes',
    'seeds',
    'sequence',
];
const MANDATORY_SURFACE_KEYS = ['kind', 'visibleText', 'visibleTitle'];
const COMBAT_SURFACE_KEYS = ['combatSurfaceVisible', 'kind', 'seed', 'wonThroughVisibleAttacks'];
const NOTHING_SURFACE_KEYS = [
    'combatSurfaceVisible',
    'eventSurfaceVisible',
    'exploreControlVisible',
    'kind',
    'seed',
];
const BOUNDED_SURFACE_KEYS = ['kind', 'seed', 'visibleChoices', 'visibleSituation'];
const ERROR_KEYS = ['console', 'page', 'request', 'response'];
const VOLATILE_INPUT_KEYS = new Set([
    'absolutePath',
    'actualPlayClaim',
    'classification',
    'contextId',
    'elapsedMs',
    'expeditionId',
    'humanObserved',
    'subpixelCoordinates',
    'timestamp',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const invalid = (reason: string): never => {
    throw new Error(`NATURAL_EXPLORATION_REPORT_INVALID:${reason}`);
};

const requireObject = (value: unknown, label: string): Record<string, unknown> => (
    isPlainObject(value) ? value : invalid(`${label}:object`)
);

const requireExactArray = <T>(value: unknown, expected: readonly T[], label: string): T[] => {
    const actual = Array.isArray(value) ? value : invalid(`${label}:array`);
    if (actual.length !== expected.length
        || actual.some((entry, index) => entry !== expected[index])) {
        invalid(`${label}:exact`);
    }
    return [...actual] as T[];
};

const validateProfile = (value: unknown) => {
    const profile = requireObject(value, 'sourceContract.profile');
    if (!hasExactKeys(profile, PROFILE_KEYS)
        || profile.id !== NATURAL_EXPLORATION_SOURCE_CONTRACT.profile.id
        || profile.version !== NATURAL_EXPLORATION_SOURCE_CONTRACT.profile.version
        || profile.expMultiplier !== NATURAL_EXPLORATION_SOURCE_CONTRACT.profile.expMultiplier
        || profile.lootMultiplier !== NATURAL_EXPLORATION_SOURCE_CONTRACT.profile.lootMultiplier
        || profile.eventMultiplier !== NATURAL_EXPLORATION_SOURCE_CONTRACT.profile.eventMultiplier) {
        invalid('sourceContract.profile:exact');
    }
    return { ...NATURAL_EXPLORATION_SOURCE_CONTRACT.profile };
};

const validateSourceContract = (value: unknown) => {
    const sourceContract = requireObject(value, 'sourceContract');
    if (!hasExactKeys(sourceContract, SOURCE_KEYS)
        || sourceContract.minimumOrdinaryGap !== NATURAL_EXPLORATION_SOURCE_CONTRACT.minimumOrdinaryGap) {
        invalid('sourceContract:keys-or-gap');
    }

    const mandatoryEvent = requireObject(sourceContract.mandatoryEvent, 'sourceContract.mandatoryEvent');
    if (!hasExactKeys(mandatoryEvent, MANDATORY_KEYS)
        || mandatoryEvent.sourceId !== NATURAL_EXPLORATION_SOURCE_CONTRACT.mandatoryEvent.sourceId
        || mandatoryEvent.visibleTitle !== NATURAL_EXPLORATION_SOURCE_CONTRACT.mandatoryEvent.visibleTitle) {
        invalid('sourceContract.mandatoryEvent:exact');
    }

    const boundedEncounter = requireObject(sourceContract.boundedEncounter, 'sourceContract.boundedEncounter');
    if (!hasExactKeys(boundedEncounter, BOUNDED_KEYS)
        || boundedEncounter.sourceId !== NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.sourceId
        || boundedEncounter.visibleSituation !== NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.visibleSituation) {
        invalid('sourceContract.boundedEncounter:exact');
    }
    const visibleChoices = requireExactArray(
        boundedEncounter.visibleChoices,
        NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.visibleChoices,
        'sourceContract.boundedEncounter.visibleChoices',
    );

    return {
        profile: validateProfile(sourceContract.profile),
        minimumOrdinaryGap: 2,
        mandatoryEvent: {
            sourceId: 'lost_wizard',
            visibleTitle: '마법의 흔적',
        },
        boundedEncounter: {
            sourceId: 'forest-old-pillars',
            visibleSituation: '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.',
            visibleChoices,
        },
    };
};

const validateDevice = (value: unknown) => {
    const device = requireObject(value, 'surfaceObservation.device');
    const viewport = requireObject(device.viewport, 'surfaceObservation.device.viewport');
    if (!hasExactKeys(device, DEVICE_KEYS)
        || !hasExactKeys(viewport, VIEWPORT_KEYS)
        || device.model !== 'iPhone 12'
        || device.deviceScaleFactor !== 3
        || device.isMobile !== true
        || device.hasTouch !== true
        || viewport.width !== 390
        || viewport.height !== 844) {
        invalid('surfaceObservation.device:exact');
    }
    return {
        model: 'iPhone 12',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
    };
};

const validateMandatoryStep = (value: unknown) => {
    const step = requireObject(value, 'surfaceObservation.sequence[0]');
    if (!hasExactKeys(step, MANDATORY_SURFACE_KEYS)
        || step.kind !== 'mandatory_event'
        || step.visibleTitle !== '마법의 흔적'
        || step.visibleText !== '숲 한가운데에서 이상한 마법 연기가 피어오릅니다. 주변에는 불에 탄 흔적과 지팡이 파편이 있습니다.') {
        invalid('surfaceObservation.sequence[0]:exact');
    }
    return {
        kind: 'mandatory_event',
        visibleTitle: '마법의 흔적',
        visibleText: '숲 한가운데에서 이상한 마법 연기가 피어오릅니다. 주변에는 불에 탄 흔적과 지팡이 파편이 있습니다.',
    };
};

const validateCombatStep = (value: unknown) => {
    const step = requireObject(value, 'surfaceObservation.sequence[1]');
    if (!hasExactKeys(step, COMBAT_SURFACE_KEYS)
        || step.kind !== 'combat'
        || step.seed !== 112596
        || step.combatSurfaceVisible !== true
        || step.wonThroughVisibleAttacks !== true) {
        invalid('surfaceObservation.sequence[1]:exact');
    }
    return {
        kind: 'combat',
        seed: 112596,
        combatSurfaceVisible: true,
        wonThroughVisibleAttacks: true,
    };
};

const validateNothingStep = (value: unknown) => {
    const step = requireObject(value, 'surfaceObservation.sequence[2]');
    if (!hasExactKeys(step, NOTHING_SURFACE_KEYS)
        || step.kind !== 'nothing'
        || step.seed !== 8
        || step.exploreControlVisible !== true
        || step.eventSurfaceVisible !== false
        || step.combatSurfaceVisible !== false) {
        invalid('surfaceObservation.sequence[2]:exact');
    }
    return {
        kind: 'nothing',
        seed: 8,
        exploreControlVisible: true,
        eventSurfaceVisible: false,
        combatSurfaceVisible: false,
    };
};

const validateBoundedStep = (value: unknown) => {
    const step = requireObject(value, 'surfaceObservation.sequence[3]');
    if (!hasExactKeys(step, BOUNDED_SURFACE_KEYS)
        || step.kind !== 'bounded_event'
        || step.seed !== 37
        || step.visibleSituation !== '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.') {
        invalid('surfaceObservation.sequence[3]:exact');
    }
    const visibleChoices = requireExactArray(
        step.visibleChoices,
        NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.visibleChoices,
        'surfaceObservation.sequence[3].visibleChoices',
    );
    return {
        kind: 'bounded_event',
        seed: 37,
        visibleSituation: '고요한 숲의 오래된 돌기둥 사이로 먼저 지나간 모험가의 흔적과 희미한 문장이 드러납니다.',
        visibleChoices,
    };
};

const validateSequence = (value: unknown) => {
    const sequence = Array.isArray(value) ? value : invalid('surfaceObservation.sequence:array');
    if (sequence.length !== 4) invalid('surfaceObservation.sequence:length');
    return [
        validateMandatoryStep(sequence[0]),
        validateCombatStep(sequence[1]),
        validateNothingStep(sequence[2]),
        validateBoundedStep(sequence[3]),
    ];
};

const validateSurfaceObservation = (value: unknown) => {
    const surface = requireObject(value, 'surfaceObservation');
    if (!hasExactKeys(surface, SURFACE_KEYS)
        || surface.freshContextCount !== 2
        || surface.ordinaryActionsBetweenNarratives !== 2) {
        invalid('surfaceObservation:keys-or-count');
    }
    const seeds = requireExactArray(surface.seeds, NATURAL_EXPLORATION_SEEDS, 'surfaceObservation.seeds');
    const outcomes = requireExactArray(surface.outcomes, NATURAL_EXPLORATION_OUTCOMES, 'surfaceObservation.outcomes');
    return {
        device: validateDevice(surface.device),
        freshContextCount: 2,
        seeds,
        outcomes,
        ordinaryActionsBetweenNarratives: 2,
        sequence: validateSequence(surface.sequence),
    };
};

const validateGates = (value: unknown) => {
    const gates = requireObject(value, 'gates');
    if (!hasExactKeys(gates, NATURAL_EXPLORATION_REQUIRED_GATES)
        || NATURAL_EXPLORATION_REQUIRED_GATES.some((gate) => gates[gate] !== true)) {
        invalid('gates:not-all-true');
    }
    return Object.fromEntries(NATURAL_EXPLORATION_REQUIRED_GATES.map((gate) => [gate, true]));
};

const validateErrors = (value: unknown) => {
    const errors = requireObject(value, 'errors');
    if (!hasExactKeys(errors, ERROR_KEYS)) invalid('errors:keys');
    for (const key of ERROR_KEYS) {
        if (!Array.isArray(errors[key]) || errors[key].length !== 0) invalid(`errors:${key}`);
    }
    return {
        page: [],
        console: [],
        response: [],
        request: [],
    };
};

const stripVolatileInput = (value: Record<string, unknown>) => {
    const canonicalEntries = Object.entries(value).filter(([key]) => !VOLATILE_INPUT_KEYS.has(key));
    const canonical = Object.fromEntries(canonicalEntries);
    if (!hasExactKeys(canonical, ['errors', 'gates', 'sourceContract', 'surfaceObservation'])) {
        invalid('input:keys');
    }
    return canonical;
};

export const buildNaturalExplorationReport = (value: unknown) => {
    const input = stripVolatileInput(requireObject(value, 'input'));
    return deepFreeze({
        schemaVersion: 2,
        classification: REPORT_CLASSIFICATION,
        actualPlayClaim: false,
        humanObserved: false,
        sourceContract: validateSourceContract(input.sourceContract),
        surfaceObservation: validateSurfaceObservation(input.surfaceObservation),
        gates: validateGates(input.gates),
        errors: validateErrors(input.errors),
    });
};

export const serializeNaturalExplorationReport = (value: unknown) => (
    `${JSON.stringify(buildNaturalExplorationReport(value), null, 2)}\n`
);
