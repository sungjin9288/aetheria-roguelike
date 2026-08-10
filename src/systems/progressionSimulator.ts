import { BALANCE, CONSTANTS } from '../data/constants.js';
import { DB } from '../data/db.js';
import {
    BASELINE_PROGRESSION_PROFILE,
    normalizeProgressionProfile,
    scaleProgressionExpReward,
    validateProgressionProfileTransition,
} from '../data/progressionProfiles.js';
import { buildClassVitals } from '../hooks/gameActions/_shared.js';
import { INITIAL_STATE, type GameState } from '../reducers/gameReducer.js';
import { makeCombatActionMap } from '../reducers/handlers/combatHandlers.js';
import type { Item, Player, ProgressionAxis, ProgressionProfile } from '../types/index.js';
import { canEquip } from '../utils/equipmentValidation.js';
import { startExpedition } from '../utils/expeditionLedger.js';
import { spawnEnemy } from '../utils/exploreUtils.js';
import { advanceExploreState, getNarrativeEventChance } from '../utils/explorationPacing.js';
import { grantGold } from '../utils/gameUtils.js';
import { getPacedCombatExp } from '../utils/progressionPacing.js';
import { createDomainRandom, deriveSeed } from '../utils/seededRandom.js';
import { calculateFullStats } from '../utils/statsCalculator.js';
import { CombatEngine } from './CombatEngine.js';
import { processLoot } from './CombatEngine.loot.js';

export const PROGRESSION_CHECKPOINT_LEVELS = Object.freeze([2, 5, 10, 20, 45, 60, 75]);

const EXPECTED_JOB_COUNT = 18;
const DEFAULT_SEED = 20_260_810;
const DEFAULT_MAX_STEPS = 100_000;
const MAX_ALLOWED_STEPS = 1_000_000;
const FIXED_EPOCH_MS = 1_700_000_000_000;
const ROOT_JOB = '모험가';
const COMBAT_PROXY_MAX_TURNS = 200;
const COMBAT_ACTION_MAP = makeCombatActionMap(INITIAL_STATE.player);

const MODEL_POLICY = Object.freeze({
    id: 'baseline-progression-reward-model',
    version: 1,
    classification: 'report-only',
    actualPlayClaim: false,
    actionUnit: 'one modeled encounter reward settlement',
    secondsPerAction: 90,
    eventProbeOpportunities: 4_096,
});

type SimulationErrorCode =
    | 'INVALID_SEED'
    | 'INVALID_MAX_STEPS'
    | 'INVALID_COMPARISON_SEEDS'
    | 'INVALID_PROFILE'
    | 'INVALID_PROFILE_TRANSITION'
    | 'UNSUPPORTED_PREDECESSOR_PROFILE'
    | 'CLASS_GRAPH_MISMATCH'
    | 'INVALID_EQUIPMENT_GATE'
    | 'PREMATURE_EQUIP'
    | 'INVALID_JOB_SNAPSHOT'
    | 'EVENT_AXIS_DIRECTION_MISMATCH'
    | 'INVALID_REWARD_NUMBER'
    | 'NON_PROGRESSING_REWARD'
    | 'MAX_STEPS_EXCEEDED';

export class ProgressionSimulationError extends Error {
    readonly code: SimulationErrorCode;

    constructor(code: SimulationErrorCode, message: string) {
        super(message);
        this.name = 'ProgressionSimulationError';
        this.code = code;
    }
}

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): Readonly<T> => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
    seen.add(value as object);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
    return Object.freeze(value);
};

export const PROGRESSION_SIMULATOR_BASELINE = deepFreeze({
    schemaVersion: 1,
    player: structuredClone(INITIAL_STATE.player),
    progressionProfile: structuredClone(BASELINE_PROGRESSION_PROFILE),
});

const codePointCompare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const MODELED_MAPS = Object.entries(DB.MAPS)
    .flatMap(([name, map]) => (
        typeof map.level === 'number'
        && map.type !== 'safe'
        && Array.isArray(map.monsters)
        && map.monsters.length > 0
            ? [{ name, level: map.level, map: { ...map, name } }]
            : []
    ))
    .sort((left, right) => left.level - right.level || codePointCompare(left.name, right.name));

const validateClassRequirementLevels = (definedJobs: string[]) => {
    for (const job of definedJobs) {
        const definition = DB.CLASSES[job];
        const reqLevel = definition.reqLv;
        const tier = definition.tier;
        if (!Number.isSafeInteger(tier)
            || Number(tier) < 0
            || Number(tier) > 3
            || (job === ROOT_JOB ? tier !== 0 : tier === 0)) {
            throw new ProgressionSimulationError(
                'CLASS_GRAPH_MISMATCH',
                `${job}.tier must be a canonical safe integer between 0 and 3`,
            );
        }
        if (job === ROOT_JOB) {
            if (reqLevel !== null && reqLevel !== undefined) {
                throw new ProgressionSimulationError(
                    'CLASS_GRAPH_MISMATCH',
                    `${ROOT_JOB} must be the only class without a requirement level`,
                );
            }
            continue;
        }
        if (!Number.isSafeInteger(reqLevel)
            || Number(reqLevel) < 1
            || Number(reqLevel) > CONSTANTS.MAX_LEVEL) {
            throw new ProgressionSimulationError(
                'CLASS_GRAPH_MISMATCH',
                `${job}.reqLv must be a safe integer between 1 and ${CONSTANTS.MAX_LEVEL}`,
            );
        }
    }
};

const getJobReachability = () => {
    const definedJobs = Object.keys(DB.CLASSES);
    validateClassRequirementLevels(definedJobs);
    const reachable = new Set<string>();
    const queue = [ROOT_JOB];

    while (queue.length > 0) {
        const job = queue.shift() as string;
        if (reachable.has(job)) continue;
        if (!Object.hasOwn(DB.CLASSES, job)) {
            throw new ProgressionSimulationError('CLASS_GRAPH_MISMATCH', `Unknown class edge: ${job}`);
        }
        reachable.add(job);
        queue.push(...(DB.CLASSES[job].next || []));
    }

    const reachableJobs = definedJobs.filter((job) => reachable.has(job));
    const unreachableJobs = definedJobs.filter((job) => !reachable.has(job));
    if (definedJobs.length !== EXPECTED_JOB_COUNT
        || reachableJobs.length !== EXPECTED_JOB_COUNT
        || unreachableJobs.length > 0) {
        throw new ProgressionSimulationError(
            'CLASS_GRAPH_MISMATCH',
            `Expected ${EXPECTED_JOB_COUNT} reachable jobs; defined=${definedJobs.length}, reachable=${reachableJobs.length}`,
        );
    }

    return {
        rootJob: ROOT_JOB,
        expectedJobCount: EXPECTED_JOB_COUNT,
        definedJobCount: definedJobs.length,
        reachableJobCount: reachableJobs.length,
        reachableJobs,
        unreachableJobs,
    };
};

const reachableJobsAtLevel = (level: number) => {
    const available = new Set([ROOT_JOB]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const [job, definition] of Object.entries(DB.CLASSES)) {
            if (!available.has(job)) continue;
            for (const nextJob of definition.next || []) {
                const nextDefinition = DB.CLASSES[nextJob];
                if (!nextDefinition) {
                    throw new ProgressionSimulationError('CLASS_GRAPH_MISMATCH', `Unknown class edge: ${nextJob}`);
                }
                if (!available.has(nextJob) && level >= Number(nextDefinition.reqLv)) {
                    available.add(nextJob);
                    changed = true;
                }
            }
        }
    }
    return Object.keys(DB.CLASSES).filter((job) => available.has(job));
};

const selectModeledMap = (level: number, seed: number, action: number) => {
    const eligible = MODELED_MAPS.filter((entry) => entry.level <= level);
    const highestLevel = eligible.at(-1)?.level;
    if (highestLevel === undefined) {
        throw new ProgressionSimulationError('INVALID_REWARD_NUMBER', `No modeled map for level ${level}`);
    }
    const candidates = eligible.filter((entry) => entry.level === highestLevel);
    const rng = createDomainRandom(seed, MODEL_POLICY.id, MODEL_POLICY.version, 'route', action);
    return candidates[Math.floor(rng() * candidates.length)];
};

const finiteNumber = (value: unknown, label: string, minimum = 0) => {
    if (!Number.isFinite(value) || Number(value) < minimum) {
        throw new ProgressionSimulationError('INVALID_REWARD_NUMBER', `${label} must be finite and >= ${minimum}`);
    }
    return Number(value);
};

const assertFiniteProgression = (player: Player) => {
    finiteNumber(player.level, 'player.level', 1);
    finiteNumber(player.exp, 'player.exp');
    finiteNumber(player.nextExp, 'player.nextExp', 1);
    finiteNumber(player.gold, 'player.gold');
};

const equipmentItems = () => [...DB.ITEMS.weapons, ...DB.ITEMS.armors];

const getCanonicalEquipmentReqLevel = (item: Item) => {
    const tier = item.tier;
    if (!Number.isSafeInteger(tier) || Number(tier) < 1) {
        throw new ProgressionSimulationError(
            'INVALID_EQUIPMENT_GATE',
            `${item.name || item.id || 'equipment'}.tier must be a finite safe integer >= 1`,
        );
    }
    const canonicalReqLevel = BALANCE.TIER_REQ_LEVEL?.[
        tier as keyof typeof BALANCE.TIER_REQ_LEVEL
    ];
    if (!Number.isSafeInteger(canonicalReqLevel) || Number(canonicalReqLevel) < 1) {
        throw new ProgressionSimulationError(
            'INVALID_EQUIPMENT_GATE',
            `Tier ${tier} is missing a canonical TIER_REQ_LEVEL`,
        );
    }
    if (Object.hasOwn(item, 'reqLevel')) {
        const declaredReqLevel = (item as any).reqLevel;
        if (!Number.isSafeInteger(declaredReqLevel)
            || Number(declaredReqLevel) !== Number(canonicalReqLevel)) {
            throw new ProgressionSimulationError(
                'INVALID_EQUIPMENT_GATE',
                `${item.name || item.id || 'equipment'}.reqLevel must equal canonical tier requirement ${canonicalReqLevel}`,
            );
        }
    }
    return Number(canonicalReqLevel);
};

const validateEquipmentCatalog = () => {
    const knownJobs = new Set(Object.keys(DB.CLASSES));
    for (const item of equipmentItems()) {
        getCanonicalEquipmentReqLevel(item);
        const jobs = (item as any).jobs;
        if (!Array.isArray(jobs)
            || jobs.length < 1
            || jobs.some((job) => typeof job !== 'string' || !knownJobs.has(job))
            || new Set(jobs).size !== jobs.length) {
            throw new ProgressionSimulationError(
                'INVALID_EQUIPMENT_GATE',
                `${item.name || item.id || 'equipment'}.jobs must be a non-empty unique array of canonical jobs`,
            );
        }
    }
};

const itemSlot = (item: Item) => (
    item.type === 'weapon' ? 'weapon'
        : item.type === 'armor' ? 'armor'
            : item.type === 'shield' ? 'offhand'
                : null
);

interface TierEquipMetrics {
    attemptedEquipCount: number;
    equippedCount: number;
    blockedByLevelCount: number;
    blockedByJobCount: number;
    prematureEquipCount: number;
    highestEquippedTier: number;
}

const applyModeledLoot = (
    player: Player,
    enemy: any,
    seed: number,
    action: number,
    metrics: TierEquipMetrics,
) => {
    const rng = createDomainRandom(seed, MODEL_POLICY.id, MODEL_POLICY.version, 'loot', action);
    const now = () => FIXED_EPOCH_MS + action;
    const loot = processLoot(enemy, player, 1, rng, now);
    let equip = { ...(player.equip || {}) };

    for (const item of loot.items) {
        const slot = itemSlot(item);
        if (!slot) continue;
        metrics.attemptedEquipCount += 1;
        const requiredLevel = getCanonicalEquipmentReqLevel(item);
        const eligibility = canEquip(item, player, equip);
        if (!eligibility.ok) {
            if (eligibility.reason === 'level') metrics.blockedByLevelCount += 1;
            if (eligibility.reason === 'job') metrics.blockedByJobCount += 1;
            continue;
        }

        if ((player.level || 1) < requiredLevel) {
            metrics.prematureEquipCount += 1;
            throw new ProgressionSimulationError(
                'PREMATURE_EQUIP',
                `${item.name || item.id || 'equipment'} passed canEquip below canonical level ${requiredLevel}`,
            );
        }

        const equippedTier = Number((equip[slot] as Item | null | undefined)?.tier || 0);
        const candidateTier = Number(item.tier || 0);
        if (candidateTier > equippedTier) {
            equip = { ...equip, [slot]: item };
            metrics.equippedCount += 1;
            metrics.highestEquippedTier = Math.max(metrics.highestEquippedTier, candidateTier);
        }
    }

    return { ...player, equip };
};

const isBaselineProfile = (profile: ProgressionProfile) => (
    profile.id === BASELINE_PROGRESSION_PROFILE.id
    && profile.version === BASELINE_PROGRESSION_PROFILE.version
    && profile.expMultiplier === BASELINE_PROGRESSION_PROFILE.expMultiplier
    && profile.lootMultiplier === BASELINE_PROGRESSION_PROFILE.lootMultiplier
    && profile.eventMultiplier === BASELINE_PROGRESSION_PROFILE.eventMultiplier
);

const resolveSimulationProfile = (options: ProgressionSimulationOptions) => {
    const normalizedProfile = options.profile === undefined
        ? structuredClone(BASELINE_PROGRESSION_PROFILE)
        : normalizeProgressionProfile(options.profile);
    if (!normalizedProfile) {
        throw new ProgressionSimulationError('INVALID_PROFILE', 'profile must satisfy the progression profile contract');
    }
    if (!isBaselineProfile(normalizedProfile)) {
        if (!options.predecessorProfile || !options.declaredAxis) {
            throw new ProgressionSimulationError(
                'INVALID_PROFILE_TRANSITION',
                'non-baseline profiles require predecessorProfile and declaredAxis',
            );
        }
        const transition = validateProgressionProfileTransition(
            options.predecessorProfile,
            normalizedProfile,
            options.declaredAxis,
        );
        if (!transition.ok) {
            throw new ProgressionSimulationError(
                'INVALID_PROFILE_TRANSITION',
                'profile must be a valid single-axis progression transition',
            );
        }
    }
    return normalizedProfile;
};

const runNarrativeProbe = (seed: number, eventMultiplier: number) => {
    let exploreState: Record<string, unknown> = {};
    let narrativeEvents = 0;
    let cumulativeChance = 0;

    for (let opportunity = 1; opportunity <= MODEL_POLICY.eventProbeOpportunities; opportunity += 1) {
        const routeRng = createDomainRandom(
            seed,
            MODEL_POLICY.id,
            MODEL_POLICY.version,
            'narrative-probe-route',
            opportunity,
        );
        const mapEntry = MODELED_MAPS[Math.floor(routeRng() * MODELED_MAPS.length)];
        const chance = getNarrativeEventChance(
            mapEntry.map.eventChance || 0,
            0,
            { exploreState },
            mapEntry.map,
            eventMultiplier,
        );
        if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
            throw new ProgressionSimulationError(
                'EVENT_AXIS_DIRECTION_MISMATCH',
                `Narrative chance must be finite and within [0, 1] at opportunity ${opportunity}`,
            );
        }
        cumulativeChance += chance;
        const eventRng = createDomainRandom(
            seed,
            MODEL_POLICY.id,
            MODEL_POLICY.version,
            'narrative-probe-roll',
            opportunity,
        );
        const outcome = eventRng() < chance ? 'narrative_event' : 'combat';
        if (outcome === 'narrative_event') narrativeEvents += 1;
        exploreState = advanceExploreState({ exploreState }, outcome);
    }

    return {
        narrativeEvents,
        meanNarrativeChance: cumulativeChance / MODEL_POLICY.eventProbeOpportunities,
    };
};

const buildEventProbe = (
    seed: number,
    configuredMultiplier: number,
    enforceDirection: boolean,
) => {
    const baseline = runNarrativeProbe(seed, BASELINE_PROGRESSION_PROFILE.eventMultiplier);
    const configured = runNarrativeProbe(seed, configuredMultiplier);
    const delta = configured.narrativeEvents - baseline.narrativeEvents;
    const direction = configuredMultiplier > 1
        ? 'increase'
        : configuredMultiplier < 1
            ? 'decrease'
            : 'neutral';
    const directionMatched = direction === 'increase'
        ? delta > 0
        : direction === 'decrease'
            ? delta < 0
            : delta === 0;
    if (enforceDirection && !directionMatched) {
        throw new ProgressionSimulationError(
            'EVENT_AXIS_DIRECTION_MISMATCH',
            `Seeded narrative proxy did not move in the declared ${direction} direction`,
        );
    }
    return {
        classification: 'proxy-report-only',
        actualPlayClaim: false,
        authority: 'getNarrativeEventChance + advanceExploreState',
        opportunities: MODEL_POLICY.eventProbeOpportunities,
        baselineMultiplier: BASELINE_PROGRESSION_PROFILE.eventMultiplier,
        configuredMultiplier,
        baselineNarrativeEvents: baseline.narrativeEvents,
        configuredNarrativeEvents: configured.narrativeEvents,
        narrativeEventDelta: delta,
        baselineMeanNarrativeChance: baseline.meanNarrativeChance,
        configuredMeanNarrativeChance: configured.meanNarrativeChance,
        direction,
        directionMatched,
    };
};

const buildPlayerAtLevel = (targetLevel: number) => {
    let player = structuredClone(PROGRESSION_SIMULATOR_BASELINE.player);
    let steps = 0;
    while ((player.level || 1) < targetLevel) {
        if (steps >= targetLevel) {
            throw new ProgressionSimulationError(
                'INVALID_JOB_SNAPSHOT',
                `CombatEngine.applyExpGain did not reach level ${targetLevel}`,
            );
        }
        steps += 1;
        const requiredExp = Number(player.nextExp) - Number(player.exp || 0);
        if (!Number.isFinite(requiredExp) || requiredExp < 1) {
            throw new ProgressionSimulationError(
                'INVALID_JOB_SNAPSHOT',
                `Invalid EXP boundary while building level ${targetLevel} snapshot`,
            );
        }
        player = CombatEngine.applyExpGain(player, requiredExp).updatedPlayer;
    }
    if ((player.level || 1) !== targetLevel) {
        throw new ProgressionSimulationError(
            'INVALID_JOB_SNAPSHOT',
            `CombatEngine.applyExpGain skipped level ${targetLevel}`,
        );
    }
    return player;
};

const snapshotNumber = (value: unknown, label: string, minimum: number) => {
    if (!Number.isFinite(value) || Number(value) < minimum) {
        throw new ProgressionSimulationError(
            'INVALID_JOB_SNAPSHOT',
            `${label} must be finite and >= ${minimum}`,
        );
    }
    return Number(value);
};

const buildJobSnapshots = (seed: number) => Object.entries(DB.CLASSES).map(([job, definition], index) => {
    const level = job === ROOT_JOB ? 1 : Number(definition.reqLv);
    const leveledPlayer = buildPlayerAtLevel(level);
    const vitals = buildClassVitals(level, job, leveledPlayer.meta || {});
    const player: Player = {
        ...leveledPlayer,
        job,
        hp: vitals.maxHp,
        maxHp: vitals.maxHp,
        mp: vitals.maxMp,
        maxMp: vitals.maxMp,
        equip: {},
        relics: [],
        status: [],
    };
    snapshotNumber(vitals.maxHp, `${job}.maxHp`, 1);
    snapshotNumber(vitals.maxMp, `${job}.maxMp`, 1);
    const stats = calculateFullStats(player);
    if (!stats) {
        throw new ProgressionSimulationError('INVALID_JOB_SNAPSHOT', `Missing derived stats for ${job}`);
    }
    snapshotNumber(stats.atk, `${job}.atk`, 1);

    const mapEntry = selectModeledMap(level, seed, index + 1);
    const encounterRng = createDomainRandom(
        seed,
        MODEL_POLICY.id,
        MODEL_POLICY.version,
        'job-snapshot-encounter',
        job,
    );
    const { mStats: enemy } = spawnEnemy(
        mapEntry.map,
        { ...player, loc: mapEntry.name },
        [],
        { addLog: () => undefined },
        { rng: encounterRng },
    );
    const enemyHp = snapshotNumber(enemy.hp, `${job}.enemy.hp`, 1);
    const enemyLevel = snapshotNumber(enemy.level, `${job}.enemy.level`, 1);
    const combatRng = createDomainRandom(
        seed,
        MODEL_POLICY.id,
        MODEL_POLICY.version,
        'job-snapshot-combat',
        job,
    );
    const combat = CombatEngine.attack(player, enemy, stats, combatRng);
    if (!Number.isFinite(combat.updatedEnemy.hp)) {
        throw new ProgressionSimulationError('INVALID_JOB_SNAPSHOT', `${job}.enemy.hp became non-finite`);
    }
    const damage = snapshotNumber(enemyHp - Number(combat.updatedEnemy.hp), `${job}.damage`, 1);

    return {
        job,
        tier: definition.tier,
        level,
        vitals: {
            maxHp: vitals.maxHp,
            maxMp: vitals.maxMp,
        },
        encounter: {
            map: mapEntry.name,
            enemy: enemy.name,
            enemyLevel,
        },
        combat: {
            authority: 'CombatEngine.attack',
            damage,
            isCrit: combat.isCrit,
            isVictory: combat.isVictory,
        },
    };
});

const runCombatMatrixSeed = (seed: number) => Object.entries(DB.CLASSES).map(([job, definition], index) => {
    const level = job === ROOT_JOB ? 1 : Number(definition.reqLv);
    const leveledPlayer = buildPlayerAtLevel(level);
    const vitals = buildClassVitals(level, job, leveledPlayer.meta || {});
    const mapEntry = selectModeledMap(level, seed, index + 1);
    const player: Player = {
        ...leveledPlayer,
        name: '시뮬레이션 모험가',
        job,
        loc: mapEntry.name,
        hp: vitals.maxHp,
        maxHp: vitals.maxHp,
        mp: vitals.maxMp,
        maxMp: vitals.maxMp,
        inv: [],
        equip: {},
        relics: [],
        status: [],
    };
    const encounterRng = createDomainRandom(
        seed,
        MODEL_POLICY.id,
        MODEL_POLICY.version,
        'combat-matrix-encounter',
        job,
    );
    const { mStats: enemy } = spawnEnemy(
        mapEntry.map,
        player,
        [],
        { addLog: () => undefined },
        { rng: encounterRng },
    );
    let state: GameState = {
        ...structuredClone(INITIAL_STATE),
        player,
        gameState: 'combat',
        enemy,
        combatTurn: 0,
        combatReceipt: null,
    };
    let turns = 0;
    while (state.gameState === 'combat' && turns < COMBAT_PROXY_MAX_TURNS) {
        const next = COMBAT_ACTION_MAP.RESOLVE_COMBAT_ACTION(state, {
            type: 'RESOLVE_COMBAT_ACTION',
            payload: {
                kind: 'attack',
                expectedTurn: state.combatTurn,
                seed: deriveSeed(seed, MODEL_POLICY.id, 'combat-matrix-turn', job, turns),
                now: FIXED_EPOCH_MS + index * COMBAT_PROXY_MAX_TURNS + turns,
            },
        });
        if (next === state || next.combatTurn !== state.combatTurn + 1) {
            throw new ProgressionSimulationError(
                'INVALID_JOB_SNAPSHOT',
                `${job} combat reducer did not accept modeled turn ${turns + 1}`,
            );
        }
        state = next;
        turns += 1;
    }

    const truncated = state.gameState === 'combat';
    const outcome = truncated
        ? 'truncated'
        : state.combatReceipt?.kind === 'victory'
            ? 'victory'
            : state.gameState === 'dead'
                ? 'defeat'
                : 'escape';
    return { job, level, turns, outcome, truncated };
});

export interface ProgressionSimulationOptions {
    seed?: number;
    maxSteps?: number;
    profile?: ProgressionProfile;
    predecessorProfile?: ProgressionProfile;
    declaredAxis?: ProgressionAxis;
}

export interface ProgressionComparisonOptions {
    seeds: number[];
    predecessorProfile: ProgressionProfile;
    candidateProfile: ProgressionProfile;
    declaredAxis: ProgressionAxis;
    maxSteps?: number;
}

const runProgressionSimulation = (
    options: ProgressionSimulationOptions = {},
    enforceEventDirection = true,
) => {
    const seed = options.seed ?? DEFAULT_SEED;
    if (!Number.isSafeInteger(seed)) {
        throw new ProgressionSimulationError('INVALID_SEED', 'seed must be a safe integer');
    }

    const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_ALLOWED_STEPS) {
        throw new ProgressionSimulationError(
            'INVALID_MAX_STEPS',
            `maxSteps must be a safe integer between 1 and ${MAX_ALLOWED_STEPS}`,
        );
    }

    const normalizedProfile = resolveSimulationProfile(options);
    const progressionProfile = deepFreeze(structuredClone(normalizedProfile));
    const jobReachability = getJobReachability();
    validateEquipmentCatalog();
    const jobSnapshots = buildJobSnapshots(seed);
    const eventProbe = buildEventProbe(seed, normalizedProfile.eventMultiplier, enforceEventDirection);

    let player = startExpedition(
        structuredClone(PROGRESSION_SIMULATOR_BASELINE.player),
        '고요한 숲',
        FIXED_EPOCH_MS,
        [],
        structuredClone(normalizedProfile),
    );
    assertFiniteProgression(player);

    const checkpoints: any[] = [];
    const tierEquip: TierEquipMetrics = {
        attemptedEquipCount: 0,
        equippedCount: 0,
        blockedByLevelCount: 0,
        blockedByJobCount: 0,
        prematureEquipCount: 0,
        highestEquippedTier: Math.max(
            0,
            ...Object.values(player.equip || {}).map((item: any) => Number(item?.tier || 0)),
        ),
    };
    let action = 0;

    while (checkpoints.length < PROGRESSION_CHECKPOINT_LEVELS.length) {
        if (action >= maxSteps) {
            throw new ProgressionSimulationError(
                'MAX_STEPS_EXCEEDED',
                `Level ${PROGRESSION_CHECKPOINT_LEVELS[checkpoints.length]} was not reached within ${maxSteps} actions`,
            );
        }
        action += 1;

        const priorLevel = player.level || 1;
        const priorExp = player.exp || 0;
        const modeledMap = selectModeledMap(priorLevel, seed, action);
        const encounterRng = createDomainRandom(seed, MODEL_POLICY.id, MODEL_POLICY.version, 'encounter', action);
        const { mStats: enemy } = spawnEnemy(
            modeledMap.map,
            { ...player, loc: modeledMap.name },
            [],
            { addLog: () => undefined },
            { rng: encounterRng },
        );

        const rawExp = finiteNumber(enemy.exp, 'enemy.exp', 1);
        const scaledExp = finiteNumber(scaleProgressionExpReward(player, rawExp), 'scaledExp', 1);
        const pacedExp = finiteNumber(getPacedCombatExp(player, scaledExp), 'pacedExp', 1);
        const expResult = CombatEngine.applyExpGain(player, pacedExp);
        player = grantGold(expResult.updatedPlayer, finiteNumber(enemy.gold, 'enemy.gold'));
        player = applyModeledLoot(player, enemy, seed, action, tierEquip);
        player = {
            ...player,
            stats: {
                ...player.stats,
                kills: (player.stats?.kills || 0) + 1,
            },
        };
        assertFiniteProgression(player);

        if ((player.level || 1) === priorLevel && (player.exp || 0) <= priorExp) {
            throw new ProgressionSimulationError('NON_PROGRESSING_REWARD', `Action ${action} did not advance EXP`);
        }

        while (checkpoints.length < PROGRESSION_CHECKPOINT_LEVELS.length
            && (player.level || 1) >= PROGRESSION_CHECKPOINT_LEVELS[checkpoints.length]) {
            const targetLevel = PROGRESSION_CHECKPOINT_LEVELS[checkpoints.length];
            const reachableJobs = reachableJobsAtLevel(targetLevel);
            checkpoints.push({
                targetLevel,
                reachedLevel: player.level,
                currentExp: player.exp,
                nextExp: player.nextExp,
                modeledActions: action,
                modeledSeconds: action * MODEL_POLICY.secondsPerAction,
                reachableJobCount: reachableJobs.length,
                reachableJobs,
                highestEquippedTier: tierEquip.highestEquippedTier,
                prematureEquipCount: tierEquip.prematureEquipCount,
            });
        }
    }

    return deepFreeze({
        schemaVersion: 1,
        seed,
        rngPolicy: { id: 'mulberry32-domain-streams', version: 1 },
        progressionProfile,
        modelPolicy: { ...MODEL_POLICY },
        authorityUsage: {
            encounter: 'spawnEnemy',
            profileSnapshot: 'startExpedition',
            expScaling: 'scaleProgressionExpReward + getPacedCombatExp',
            expApplication: 'CombatEngine.applyExpGain',
            goldApplication: 'grantGold',
            loot: 'processLoot',
            equipEligibility: 'canEquip',
            classVitals: 'buildClassVitals',
            combatSnapshot: 'CombatEngine.attack',
            narrativeProbe: 'getNarrativeEventChance + advanceExploreState',
        },
        limitations: [
            'Modeled actions settle rewards; they do not execute combat turns or represent observed player behavior.',
            'Modeled time is policy arithmetic only and is not an actual-play duration claim.',
            'Narrative occurrences are a seeded pacing proxy kept separate from reward settlement and modeled time.',
        ],
        jobReachability,
        jobSnapshots,
        eventProbe,
        checkpoints,
        tierEquip: { ...tierEquip },
        totalModeledActions: action,
        totalModeledSeconds: action * MODEL_POLICY.secondsPerAction,
        final: {
            level: player.level,
            exp: player.exp,
            nextExp: player.nextExp,
            gold: player.gold,
        },
    });
};

export const simulateProgression = (options: ProgressionSimulationOptions = {}) => (
    runProgressionSimulation(options)
);

const canonicalComparisonSeeds = (seeds: number[]) => {
    if (!Array.isArray(seeds)
        || seeds.length < 2
        || seeds.length > 1_000
        || seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
        || new Set(seeds).size !== seeds.length) {
        throw new ProgressionSimulationError(
            'INVALID_COMPARISON_SEEDS',
            'comparison seeds must contain 2 to 1000 unique uint32 integers',
        );
    }
    return [...seeds].sort((left, right) => left - right);
};

const summarizeNumbers = (values: number[]) => {
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
        throw new ProgressionSimulationError(
            'INVALID_REWARD_NUMBER',
            'comparison metrics must contain finite values',
        );
    }
    const sorted = [...values].sort((left, right) => left - right);
    const percentile = (ratio: number) => sorted[
        Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))
    ];
    return {
        total: sorted.reduce((sum, value) => sum + value, 0),
        min: sorted[0],
        p10: percentile(0.1),
        p50: percentile(0.5),
        p90: percentile(0.9),
        max: sorted.at(-1),
    };
};

const targetMetricDirection = (
    axis: ProgressionAxis,
    predecessorProfile: ProgressionProfile,
    candidateProfile: ProgressionProfile,
    predecessorRuns: ReturnType<typeof simulateProgression>[],
    candidateRuns: ReturnType<typeof simulateProgression>[],
) => {
    const multiplierKey = `${axis}Multiplier` as const;
    const multiplierIncreased = candidateProfile[multiplierKey] > predecessorProfile[multiplierKey];

    if (axis === 'exp') {
        const predecessor = summarizeNumbers(predecessorRuns.map((run) => run.totalModeledActions));
        const candidate = summarizeNumbers(candidateRuns.map((run) => run.totalModeledActions));
        const expected = multiplierIncreased ? 'decrease' : 'increase';
        return {
            metric: 'modeled_reward_actions_to_level_75',
            expected,
            predecessorP50: predecessor.p50,
            candidateP50: candidate.p50,
            matched: expected === 'decrease'
                ? candidate.p50 < predecessor.p50
                : candidate.p50 > predecessor.p50,
        };
    }

    const field = axis === 'event' ? 'narrativeEvents' : 'equipmentDropAttempts';
    const predecessorValues = predecessorRuns.map((run) => (
        axis === 'event'
            ? run.eventProbe.configuredNarrativeEvents
            : run.tierEquip.attemptedEquipCount
    ));
    const candidateValues = candidateRuns.map((run) => (
        axis === 'event'
            ? run.eventProbe.configuredNarrativeEvents
            : run.tierEquip.attemptedEquipCount
    ));
    const predecessor = summarizeNumbers(predecessorValues);
    const candidate = summarizeNumbers(candidateValues);
    const expected = multiplierIncreased ? 'increase' : 'decrease';
    return {
        metric: field === 'narrativeEvents' ? 'narrative_event_occurrences' : 'equipment_drop_attempts',
        expected,
        predecessorTotal: predecessor.total,
        candidateTotal: candidate.total,
        matched: expected === 'increase'
            ? candidate.total > predecessor.total
            : candidate.total < predecessor.total,
    };
};

export const simulateProgressionComparison = (options: ProgressionComparisonOptions) => {
    const seeds = canonicalComparisonSeeds(options.seeds);
    const predecessorProfile = normalizeProgressionProfile(options.predecessorProfile);
    if (!predecessorProfile || !isBaselineProfile(predecessorProfile)) {
        throw new ProgressionSimulationError(
            'UNSUPPORTED_PREDECESSOR_PROFILE',
            'the current comparison foundation supports the registered baseline predecessor only',
        );
    }

    const candidateProfile = normalizeProgressionProfile(options.candidateProfile);
    if (!candidateProfile) {
        throw new ProgressionSimulationError(
            'INVALID_PROFILE',
            'candidate profile must satisfy the progression profile contract',
        );
    }
    const transition = validateProgressionProfileTransition(
        predecessorProfile,
        candidateProfile,
        options.declaredAxis,
    );
    if (!transition.ok) {
        throw new ProgressionSimulationError(
            'INVALID_PROFILE_TRANSITION',
            'candidate must be a valid single-axis progression transition',
        );
    }

    const predecessorRuns = seeds.map((seed) => runProgressionSimulation({
        seed,
        maxSteps: options.maxSteps,
        profile: predecessorProfile,
    }, false));
    const candidateRuns = seeds.map((seed) => runProgressionSimulation({
        seed,
        maxSteps: options.maxSteps,
        profile: candidateProfile,
        predecessorProfile,
        declaredAxis: options.declaredAxis,
    }, false));
    const combatRuns = seeds.map((seed) => runCombatMatrixSeed(seed));

    const checkpoints = PROGRESSION_CHECKPOINT_LEVELS.map((targetLevel, index) => ({
        targetLevel,
        predecessor: summarizeNumbers(predecessorRuns.map((run) => run.checkpoints[index].modeledActions)),
        candidate: summarizeNumbers(candidateRuns.map((run) => run.checkpoints[index].modeledActions)),
    }));
    const narrativeEvents = {
        predecessor: summarizeNumbers(predecessorRuns.map((run) => run.eventProbe.configuredNarrativeEvents)),
        candidate: summarizeNumbers(candidateRuns.map((run) => run.eventProbe.configuredNarrativeEvents)),
    };
    const equipmentDropAttempts = {
        predecessor: summarizeNumbers(predecessorRuns.map((run) => run.tierEquip.attemptedEquipCount)),
        candidate: summarizeNumbers(candidateRuns.map((run) => run.tierEquip.attemptedEquipCount)),
    };
    const rewardActions = {
        predecessor: summarizeNumbers(predecessorRuns.map((run) => run.totalModeledActions)),
        candidate: summarizeNumbers(candidateRuns.map((run) => run.totalModeledActions)),
    };
    const jobSingleAttackDamage = Object.keys(DB.CLASSES).map((job, index) => ({
        job,
        predecessor: summarizeNumbers(predecessorRuns.map((run) => run.jobSnapshots[index].combat.damage)),
        candidate: summarizeNumbers(candidateRuns.map((run) => run.jobSnapshots[index].combat.damage)),
    }));
    const combatMatrixJobs = Object.keys(DB.CLASSES).map((job, index) => {
        const encounters = combatRuns.map((run) => run[index]);
        return {
            job,
            encounters: encounters.length,
            wins: encounters.filter((entry) => entry.outcome === 'victory').length,
            deaths: encounters.filter((entry) => entry.outcome === 'defeat').length,
            escapes: encounters.filter((entry) => entry.outcome === 'escape').length,
            truncated: encounters.filter((entry) => entry.truncated).length,
            turns: summarizeNumbers(encounters.map((entry) => entry.turns)),
        };
    });
    const combatMatrixTruncatedCount = combatMatrixJobs.reduce((sum, job) => sum + job.truncated, 0);
    const combatMatrix = {
        classification: 'un-geared-auto-attack-proxy',
        actualPlayClaim: false,
        authority: 'makeCombatActionMap.RESOLVE_COMBAT_ACTION',
        maxTurnsPerEncounter: COMBAT_PROXY_MAX_TURNS,
        jobs: combatMatrixJobs,
    };

    const predecessorPrematureEquipCount = predecessorRuns.reduce(
        (sum, run) => sum + run.tierEquip.prematureEquipCount,
        0,
    );
    const candidatePrematureEquipCount = candidateRuns.reduce(
        (sum, run) => sum + run.tierEquip.prematureEquipCount,
        0,
    );
    const predecessorJobSnapshotCount = predecessorRuns.reduce((sum, run) => sum + run.jobSnapshots.length, 0);
    const candidateJobSnapshotCount = candidateRuns.reduce((sum, run) => sum + run.jobSnapshots.length, 0);
    const hardCorrectness = predecessorPrematureEquipCount === 0
        && candidatePrematureEquipCount === 0
        && predecessorJobSnapshotCount === EXPECTED_JOB_COUNT * seeds.length
        && candidateJobSnapshotCount === EXPECTED_JOB_COUNT * seeds.length
        && combatMatrixTruncatedCount === 0;
    const direction = targetMetricDirection(
        options.declaredAxis,
        predecessorProfile,
        candidateProfile,
        predecessorRuns,
        candidateRuns,
    );
    const blockers = [
        ...(hardCorrectness ? [] : ['hard_correctness_failed']),
        ...(direction.matched ? [] : ['target_metric_direction_mismatch']),
        'production_funnel_evidence_missing',
        'full_combat_model_unavailable',
    ];

    return deepFreeze({
        schemaVersion: 1,
        classification: 'report-only',
        activationReady: false,
        seeds,
        predecessorProfile: structuredClone(predecessorProfile),
        candidateProfile: structuredClone(candidateProfile),
        declaredAxis: options.declaredAxis,
        limitations: [
            'This comparison uses modeled reward settlements and deterministic proxies, not observed player behavior.',
            'Candidate activation requires matching production funnel evidence and a full combat-turn model.',
            'The current comparison predecessor is the registered baseline profile only.',
        ],
        unavailableMetrics: [
            'actual_play_time',
            'combat_player_action_turns',
            'death_rate',
            'expedition_count',
            'retention',
        ],
        aggregates: {
            checkpoints,
            narrativeEvents,
            equipmentDropAttempts,
            rewardActions,
            jobSingleAttackDamage,
            combatMatrix,
        },
        correctness: {
            predecessorPrematureEquipCount,
            candidatePrematureEquipCount,
            predecessorJobSnapshotCount,
            candidateJobSnapshotCount,
            combatMatrixTruncatedCount,
        },
        gates: {
            profileTransition: true,
            deterministicSeedSet: true,
            hardCorrectness,
            targetMetricDirection: direction,
            productFunnelEvidence: false,
            fullCombatModel: false,
        },
        blockers,
    });
};
