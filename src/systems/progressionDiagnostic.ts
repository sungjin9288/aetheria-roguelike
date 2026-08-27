import { DB } from '../data/db.js';
import { BALANCE } from '../data/constants.js';
import { BOSS_MONSTERS } from '../data/monsters.js';
import { buildClassVitals } from '../hooks/gameActions/_shared.js';
import { INITIAL_STATE, type GameState } from '../reducers/gameReducer.js';
import { makeCombatActionMap } from '../reducers/handlers/combatHandlers.js';
import type { Item, Player } from '../types/index.js';
import { getBossSignatureDrops } from '../utils/bossSignatureHint.js';
import { canEquip } from '../utils/equipmentValidation.js';
import { spawnEnemy } from '../utils/exploreUtils.js';
import { advanceExploreState, getExplorationPitySteps } from '../utils/explorationPacing.js';
import { createDomainRandom, deriveSeed } from '../utils/seededRandom.js';
import { SIGNATURE_PITY } from '../utils/signaturePity.js';
import { CombatEngine } from './CombatEngine.js';
import {
    CANDIDATE_EXPLORATION_RHYTHM,
    EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED,
    resolveExplorationRhythmOutcomeStep,
    type ExplorationRhythmOutcome,
} from './explorationRhythmSimulator.js';
import { getPrestigeUnlocks } from './prestigeUnlocks.js';

export interface ProgressionDiagnosticOptions {
    focusedSeeds: readonly number[];
    comparisonSeeds: readonly number[];
    maxCombatTurns?: number;
}

export interface ProgressionDiagnosticCohorts {
    combat: {
        authority: 'makeCombatActionMap.RESOLVE_COMBAT_ACTION';
        jobs: CombatJobDiagnostic[];
    };
    loot: {
        authority: 'combatReceipt.lootSettlement';
        jobs: LootJobDiagnostic[];
        signatureBosses: SignatureBossDiagnostic[];
        capacityPressure: {
            oneSlot: CapacityPressureAggregate;
            full: CapacityPressureAggregate;
        };
    };
    exploration: ExplorationDiagnostic;
    hardErrors: string[];
}

interface Distribution {
    p10: number;
    p50: number;
    p90: number;
}

interface SeedObservationDistribution {
    observedSeeds: number;
    unobservedSeeds: number;
    values: Distribution;
}

interface CombatEncounterResult {
    encounterKey: string;
    outcome: 'victory' | 'defeat' | 'forced-escape' | 'truncated';
    acceptedTurns: number;
    rejectedSkillInputs: number;
    remainingHpRatio: number;
}

interface CombatCohortDiagnostic {
    loadout: 'base' | 'eligible-loadout';
    actionPolicy: 'attack-only' | 'skill-first';
    encounters: number;
    encounterKeys: string[];
    victories: number;
    defeats: number;
    forcedEscapes: number;
    truncated: number;
    acceptedTurns: Distribution;
    rejectedSkillInputs: number;
    remainingHpRatio: Distribution;
}

interface CombatJobDiagnostic {
    job: string;
    level: number;
    map: string;
    cohorts: CombatCohortDiagnostic[];
}

interface LootJobDiagnostic {
    job: string;
    level: number;
    map: string;
    classification: 'production-victory-receipt';
    kills: number;
    rolledItems: number;
    admittedItems: number;
    blockedItems: number;
    admittedEquipment: number;
    admittedSignatures: number;
    blockedSignatures: number;
    admittedItemIdsMatchedInventory: number;
    firstItemAttempt: SeedObservationDistribution;
    firstEquipmentAttempt: SeedObservationDistribution;
    firstEquipableTierAttempt: {
        attempt: SeedObservationDistribution;
        tier: SeedObservationDistribution;
    };
    noItemStreak: Distribution;
    noEquipmentStreak: Distribution;
}

interface SignatureBossDiagnostic {
    boss: string;
    signatureDrops: string[];
    classification: 'production-victory-receipt';
    attempts: number;
    admittedSignatures: number;
    blockedSignatures: number;
    firstSignatureAttempt: SeedObservationDistribution;
    noSignatureStreak: Distribution;
    pityActivations: number;
    pityResets: number;
    pityBeforeMax: number;
    pityAfterMax: number;
}

interface CapacityPressureAggregate {
    samples: number;
    rolledItems: number;
    admittedItems: number;
    capacityBlockedDrops: number;
    admittedBossSignatures: number;
    blockedBossSignatures: number;
    pityResets: number;
    pityIncrements: number;
}

interface ExplorationDiagnostic {
    classification: 'production-outcome-step-proxy';
    authority: 'resolveExplorationRhythmOutcomeStep';
    policy: { id: string; version: number };
    opportunitiesPerSeed: number;
    opportunities: number;
    outcomes: Record<ExplorationRhythmOutcome, number>;
    optionalDecisions: {
        count: number;
        density: number;
        gap: Distribution;
        longestStreak: number;
    };
    outcomeRhythm: Record<ExplorationRhythmOutcome, {
        gap: Distribution;
        longestStreak: Distribution;
    }>;
    pity: {
        maxSinceNarrative: number;
        narrativeActivations: number;
        discoveryActivations: number;
        relicActivations: number;
        maxSinceRelic: number;
        firstRelicPityActivations: number;
    };
}

const ROOT_JOB = '모험가';
const FIXED_EPOCH_MS = 1_700_000_000_000;
const COMBAT_ACTION_MAP = makeCombatActionMap(INITIAL_STATE.player);
const CODE_POINT_COMPARE = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export const PROGRESSION_DIAGNOSTIC_JOBS = Object.freeze(
    Object.keys(DB.CLASSES).sort(CODE_POINT_COMPARE),
);

const COMBAT_LOADOUTS = Object.freeze(['base', 'eligible-loadout'] as const);
const COMBAT_ACTION_POLICIES = Object.freeze(['attack-only', 'skill-first'] as const);
const LOOT_KILLS_PER_SEED = 32;
const SIGNATURE_ATTEMPTS_PER_SEED = 32;
const SIGNATURE_BOSSES = Object.freeze(
    BOSS_MONSTERS
        .filter((boss) => getBossSignatureDrops(boss).length > 0)
        .sort(CODE_POINT_COMPARE),
);
const DIAGNOSTIC_EXPLORATION_MAPS = Object.entries(DB.MAPS)
    .filter(([, map]) => map.type !== 'safe')
    .sort(([left], [right]) => CODE_POINT_COMPARE(left, right));
const EXPLORATION_OUTCOMES = Object.freeze([
    'campfire',
    'scout',
    'generalNarrative',
    'combat',
    'anomaly',
    'relic',
    'nothing',
] as const);

const percentile = (values: number[], ratio: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))];
};

const distribution = (values: number[]): Distribution => ({
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
});

const observedDistribution = (
    values: number[],
    totalSeeds: number,
): SeedObservationDistribution => ({
    observedSeeds: values.length,
    unobservedSeeds: totalSeeds - values.length,
    values: distribution(values),
});

interface DistributionHistogram {
    count: number;
    values: Map<number, number>;
}

const createDistributionHistogram = (): DistributionHistogram => ({
    count: 0,
    values: new Map(),
});

const recordDistributionValue = (histogram: DistributionHistogram, value: number) => {
    histogram.count += 1;
    histogram.values.set(value, (histogram.values.get(value) || 0) + 1);
};

const histogramDistribution = (histogram: DistributionHistogram): Distribution => {
    if (histogram.count === 0) return { p10: 0, p50: 0, p90: 0 };
    const ordered = [...histogram.values.entries()].sort(([left], [right]) => left - right);
    const at = (ratio: number) => {
        const target = Math.ceil(histogram.count * ratio);
        let cumulative = 0;
        for (const [value, count] of ordered) {
            cumulative += count;
            if (cumulative >= target) return value;
        }
        return ordered.at(-1)?.[0] || 0;
    };
    return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
};

const buildPlayerAtLevel = (targetLevel: number) => {
    let player = structuredClone(INITIAL_STATE.player);
    let steps = 0;
    while ((player.level || 1) < targetLevel) {
        if (steps >= targetLevel) throw new Error(`diagnostic level fixture stalled at ${targetLevel}`);
        steps += 1;
        const requiredExp = Number(player.nextExp) - Number(player.exp || 0);
        if (!Number.isFinite(requiredExp) || requiredExp < 1) {
            throw new Error(`diagnostic level fixture has invalid EXP at ${targetLevel}`);
        }
        player = CombatEngine.applyExpGain(player, requiredExp).updatedPlayer;
    }
    if ((player.level || 1) !== targetLevel) {
        throw new Error(`diagnostic level fixture skipped ${targetLevel}`);
    }
    return player;
};

const jobUnlockLevel = (job: string) => (
    job === ROOT_JOB ? 1 : Number(DB.CLASSES[job]?.reqLv)
);

const highestReachableMap = (level: number) => {
    const maps = Object.entries(DB.MAPS)
        .flatMap(([name, map]) => (
            map.type !== 'safe'
            && typeof map.level === 'number'
            && map.level <= level
            && Array.isArray(map.monsters)
            && map.monsters.length > 0
                ? [{ name, map: { ...map, name } }]
                : []
        ))
        .sort((left, right) => (
            Number(right.map.level) - Number(left.map.level)
            || CODE_POINT_COMPARE(left.name, right.name)
        ));
    const selected = maps[0];
    if (!selected) throw new Error(`diagnostic map unavailable at level ${level}`);
    return selected;
};

const itemSlot = (item: Item) => (
    item.type === 'weapon' ? 'weapon'
        : item.type === 'armor' ? 'armor'
            : item.type === 'shield' ? 'offhand'
                : null
);

const eligibleEquipment = () => [...DB.ITEMS.weapons, ...DB.ITEMS.armors]
    .filter((item) => itemSlot(item) !== null)
    .sort((left, right) => (
        Number(right.tier || 0) - Number(left.tier || 0)
        || CODE_POINT_COMPARE(String(left.name || left.id || ''), String(right.name || right.id || ''))
    ));

const buildEligibleLoadout = (player: Player) => {
    let equip: NonNullable<Player['equip']> = {};
    for (const slot of ['weapon', 'armor', 'offhand'] as const) {
        const item = eligibleEquipment().find((candidate) => (
            itemSlot(candidate) === slot && canEquip(candidate, player, equip).ok
        ));
        if (item) equip = { ...equip, [slot]: structuredClone(item) };
    }
    return equip;
};

const buildCombatPlayer = (
    job: string,
    mapName: string,
    loadout: 'base' | 'eligible-loadout',
) => {
    const level = jobUnlockLevel(job);
    const leveled = buildPlayerAtLevel(level);
    const vitals = buildClassVitals(level, job, leveled.meta || {});
    const player: Player = {
        ...leveled,
        name: '진단 모험가',
        job,
        loc: mapName,
        hp: vitals.maxHp,
        maxHp: vitals.maxHp,
        mp: vitals.maxMp,
        maxMp: vitals.maxMp,
        inv: [],
        equip: {},
        relics: [],
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
    };
    return loadout === 'eligible-loadout'
        ? { ...player, equip: buildEligibleLoadout(player) }
        : player;
};

const victoryFixturePlayer = (
    player: Player,
    inventory: Item[],
    maxInv: number,
    signaturePity = 0,
): Player => ({
    ...player,
    hp: Math.max(1, Number(player.maxHp || player.hp || 1)),
    atk: 1_000_000,
    inv: inventory,
    maxInv,
    status: [],
    stats: { ...player.stats, signaturePity },
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
});

const settleLootVictory = (
    player: Player,
    enemy: any,
    seed: number,
    hardErrors: string[],
    label: string,
) => {
    const state: GameState = {
        ...structuredClone(INITIAL_STATE),
        player,
        gameState: 'combat',
        enemy: {
            ...enemy,
            hp: 1,
            maxHp: Math.max(1, Number(enemy.maxHp || enemy.hp || 1)),
            def: 0,
            pattern: { ...(enemy.pattern || {}), guardChance: 0, heavyChance: 0 },
        },
        logs: [],
        combatTurn: 0,
        combatReceipt: null,
    };
    const result = resolveAction(
        state,
        'attack',
        seed,
        FIXED_EPOCH_MS + (seed % 1_000_000),
    );
    const receipt = result.combatReceipt?.lootSettlement;
    if (result.combatReceipt?.kind !== 'victory' || !receipt) {
        hardErrors.push(`${label}:missing-victory-loot-receipt`);
        return null;
    }
    if (receipt.rolledCount !== receipt.admittedCount + receipt.blockedCount) {
        hardErrors.push(`${label}:loot-receipt-count-mismatch`);
    }
    const inventoryById = new Map((result.player.inv || []).flatMap((item) => (
        typeof item.id === 'string' ? [[item.id, item] as const] : []
    )));
    const admittedItems = receipt.admittedItemIds.flatMap((id) => {
        const item = inventoryById.get(id);
        if (!item) {
            hardErrors.push(`${label}:admitted-item-missing-from-inventory`);
            return [];
        }
        return [item];
    });
    if (admittedItems.length !== receipt.admittedCount) {
        hardErrors.push(`${label}:admitted-id-count-mismatch`);
    }
    return { result, receipt, admittedItems };
};

const spawnGeneralEnemy = (player: Player, map: ReturnType<typeof highestReachableMap>, seed: number) => {
    const rng = createDomainRandom(
        seed,
        'progression-diagnostic-v2',
        'loot-general-spawn',
        String(player.job || ROOT_JOB),
    );
    return spawnEnemy(map.map, player, [], { addLog: () => undefined }, { rng }).mStats;
};

const signatureBossMap = (boss: string) => {
    const entry = Object.entries(DB.MAPS)
        .filter(([, map]) => (
            map.boss === boss
            || map.bossMonsters?.includes(boss)
            || map.monsters?.includes(boss)
        ))
        .sort(([left], [right]) => CODE_POINT_COMPARE(left, right))[0];
    if (!entry) throw new Error(`diagnostic signature boss map unavailable: ${boss}`);
    const [name, map] = entry;
    return { name, map: { ...map, name, boss } };
};

const spawnSignatureBoss = (boss: string, player: Player, seed: number) => {
    const map = signatureBossMap(boss);
    const rng = createDomainRandom(seed, 'progression-diagnostic-v2', 'loot-signature-spawn', boss);
    return spawnEnemy(
        map.map,
        { ...player, loc: map.name },
        [],
        { addLog: () => undefined },
        { forceAreaBoss: true, rng },
    ).mStats;
};

const isEquipment = (item: Item) => (
    item.type === 'weapon' || item.type === 'armor' || item.type === 'shield'
);

const buildLootJobDiagnostic = (
    job: string,
    focusedSeeds: readonly number[],
    hardErrors: string[],
): LootJobDiagnostic => {
    const level = jobUnlockLevel(job);
    const map = highestReachableMap(level);
    const basePlayer = buildCombatPlayer(job, map.name, 'base');
    let rolledItems = 0;
    let admittedItems = 0;
    let blockedItems = 0;
    let admittedEquipment = 0;
    let admittedSignatures = 0;
    let blockedSignatures = 0;
    let admittedItemIdsMatchedInventory = 0;
    const firstItemAttempts: number[] = [];
    const firstEquipmentAttempts: number[] = [];
    const firstEquipableAttempts: number[] = [];
    const firstEquipableTiers: number[] = [];
    const noItemStreaks: number[] = [];
    const noEquipmentStreaks: number[] = [];

    for (const seed of focusedSeeds) {
        let firstItemAttempt: number | null = null;
        let firstEquipmentAttempt: number | null = null;
        let firstEquipableTierAttempt: { attempt: number; tier: number } | null = null;
        let noItemStreak = 0;
        let noEquipmentStreak = 0;
        let longestNoItemStreak = 0;
        let longestNoEquipmentStreak = 0;
        for (let kill = 1; kill <= LOOT_KILLS_PER_SEED; kill += 1) {
            const encounterSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'loot-general', job, kill);
            const player = victoryFixturePlayer(basePlayer, [], 100);
            const enemy = spawnGeneralEnemy(player, map, encounterSeed);
            const settled = settleLootVictory(player, enemy, encounterSeed, hardErrors, `${job}/loot/${seed}/${kill}`);
            if (!settled) continue;
            const { receipt, admittedItems: admitted } = settled;
            rolledItems += receipt.rolledCount;
            admittedItems += receipt.admittedCount;
            blockedItems += receipt.blockedCount;
            admittedSignatures += receipt.admittedSignatureCount;
            blockedSignatures += receipt.blockedSignatureCount;
            admittedItemIdsMatchedInventory += admitted.length;
            const equipment = admitted.filter(isEquipment);
            admittedEquipment += equipment.length;

            if (receipt.admittedCount > 0) {
                if (firstItemAttempt === null) firstItemAttempt = kill;
                noItemStreak = 0;
            } else {
                noItemStreak += 1;
                longestNoItemStreak = Math.max(longestNoItemStreak, noItemStreak);
            }
            if (equipment.length > 0) {
                if (firstEquipmentAttempt === null) firstEquipmentAttempt = kill;
                noEquipmentStreak = 0;
            } else {
                noEquipmentStreak += 1;
                longestNoEquipmentStreak = Math.max(longestNoEquipmentStreak, noEquipmentStreak);
            }
            if (firstEquipableTierAttempt === null) {
                const equipable = equipment.find((item) => canEquip(item, settled.result.player, settled.result.player.equip || {}).ok);
                if (equipable) {
                    firstEquipableTierAttempt = { attempt: kill, tier: Number(equipable.tier || 0) };
                }
            }
        }
        if (firstItemAttempt !== null) firstItemAttempts.push(firstItemAttempt);
        if (firstEquipmentAttempt !== null) firstEquipmentAttempts.push(firstEquipmentAttempt);
        if (firstEquipableTierAttempt !== null) {
            firstEquipableAttempts.push(firstEquipableTierAttempt.attempt);
            firstEquipableTiers.push(firstEquipableTierAttempt.tier);
        }
        noItemStreaks.push(longestNoItemStreak);
        noEquipmentStreaks.push(longestNoEquipmentStreak);
    }

    return {
        job,
        level,
        map: map.name,
        classification: 'production-victory-receipt',
        kills: focusedSeeds.length * LOOT_KILLS_PER_SEED,
        rolledItems,
        admittedItems,
        blockedItems,
        admittedEquipment,
        admittedSignatures,
        blockedSignatures,
        admittedItemIdsMatchedInventory,
        firstItemAttempt: observedDistribution(firstItemAttempts, focusedSeeds.length),
        firstEquipmentAttempt: observedDistribution(firstEquipmentAttempts, focusedSeeds.length),
        firstEquipableTierAttempt: {
            attempt: observedDistribution(firstEquipableAttempts, focusedSeeds.length),
            tier: observedDistribution(firstEquipableTiers, focusedSeeds.length),
        },
        noItemStreak: distribution(noItemStreaks),
        noEquipmentStreak: distribution(noEquipmentStreaks),
    };
};

const buildSignatureBossDiagnostic = (
    boss: string,
    focusedSeeds: readonly number[],
    hardErrors: string[],
): SignatureBossDiagnostic => {
    const map = signatureBossMap(boss);
    const basePlayer = buildCombatPlayer(ROOT_JOB, map.name, 'base');
    let admittedSignatures = 0;
    let blockedSignatures = 0;
    const firstSignatureAttempts: number[] = [];
    const noSignatureStreaks: number[] = [];
    let pityActivations = 0;
    let pityResets = 0;
    let pityBeforeMax = 0;
    let pityAfterMax = 0;

    for (const seed of focusedSeeds) {
        let pity = 0;
        let noSignatureStreak = 0;
        let longestNoSignatureStreak = 0;
        let firstSignatureAttempt: number | null = null;
        for (let attempt = 1; attempt <= SIGNATURE_ATTEMPTS_PER_SEED; attempt += 1) {
            const encounterSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'loot-signature', boss, attempt);
            const player = victoryFixturePlayer(basePlayer, [], 100, pity);
            const enemy = spawnSignatureBoss(boss, player, encounterSeed);
            const settled = settleLootVictory(player, enemy, encounterSeed, hardErrors, `${boss}/pity/${seed}/${attempt}`);
            if (!settled) continue;
            const { receipt } = settled;
            admittedSignatures += receipt.admittedSignatureCount;
            blockedSignatures += receipt.blockedSignatureCount;
            pityBeforeMax = Math.max(pityBeforeMax, receipt.pityBefore);
            pityAfterMax = Math.max(pityAfterMax, receipt.pityAfter);
            if (receipt.pityBefore >= SIGNATURE_PITY.THRESHOLD) pityActivations += 1;
            if (receipt.admittedSignatureCount > 0) {
                if (firstSignatureAttempt === null) firstSignatureAttempt = attempt;
                if (receipt.pityBefore > 0 && receipt.pityAfter === 0) pityResets += 1;
                noSignatureStreak = 0;
            } else {
                noSignatureStreak += 1;
                longestNoSignatureStreak = Math.max(longestNoSignatureStreak, noSignatureStreak);
            }
            pity = receipt.pityAfter;
        }
        if (firstSignatureAttempt !== null) firstSignatureAttempts.push(firstSignatureAttempt);
        noSignatureStreaks.push(longestNoSignatureStreak);
    }

    return {
        boss,
        signatureDrops: getBossSignatureDrops(boss).map(({ name }) => name).sort(CODE_POINT_COMPARE),
        classification: 'production-victory-receipt',
        attempts: focusedSeeds.length * SIGNATURE_ATTEMPTS_PER_SEED,
        admittedSignatures,
        blockedSignatures,
        firstSignatureAttempt: observedDistribution(firstSignatureAttempts, focusedSeeds.length),
        noSignatureStreak: distribution(noSignatureStreaks),
        pityActivations,
        pityResets,
        pityBeforeMax,
        pityAfterMax,
    };
};

const emptyCapacityAggregate = (): CapacityPressureAggregate => ({
    samples: 0,
    rolledItems: 0,
    admittedItems: 0,
    capacityBlockedDrops: 0,
    admittedBossSignatures: 0,
    blockedBossSignatures: 0,
    pityResets: 0,
    pityIncrements: 0,
});

const addCapacitySample = (
    aggregate: CapacityPressureAggregate,
    settled: NonNullable<ReturnType<typeof settleLootVictory>>,
    boss: boolean,
) => {
    const { receipt } = settled;
    aggregate.samples += 1;
    aggregate.rolledItems += receipt.rolledCount;
    aggregate.admittedItems += receipt.admittedCount;
    aggregate.capacityBlockedDrops += receipt.blockedCount;
    if (boss) {
        aggregate.admittedBossSignatures += receipt.admittedSignatureCount;
        aggregate.blockedBossSignatures += receipt.blockedSignatureCount;
        if (receipt.admittedSignatureCount > 0 && receipt.pityBefore > 0 && receipt.pityAfter === 0) {
            aggregate.pityResets += 1;
        }
        if (receipt.pityAfter > receipt.pityBefore) aggregate.pityIncrements += 1;
    }
};

const buildCapacityPressure = (focusedSeeds: readonly number[], hardErrors: string[]) => {
    const oneSlot = emptyCapacityAggregate();
    const full = emptyCapacityAggregate();
    const filler: Item = { id: 'diagnostic-capacity-filler', name: '진단 자리 점유', type: 'material' };

    for (const job of PROGRESSION_DIAGNOSTIC_JOBS) {
        const level = jobUnlockLevel(job);
        const map = highestReachableMap(level);
        const basePlayer = buildCombatPlayer(job, map.name, 'base');
        for (const seed of focusedSeeds) {
            const encounterSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'capacity-general', job);
            const enemy = spawnGeneralEnemy(basePlayer, map, encounterSeed);
            const admitted = settleLootVictory(
                victoryFixturePlayer(basePlayer, [], 1),
                enemy,
                encounterSeed,
                hardErrors,
                `${job}/capacity-one-slot/${seed}`,
            );
            const blocked = settleLootVictory(
                victoryFixturePlayer(basePlayer, [filler], 1),
                enemy,
                encounterSeed,
                hardErrors,
                `${job}/capacity-full/${seed}`,
            );
            if (admitted) addCapacitySample(oneSlot, admitted, false);
            if (blocked) addCapacitySample(full, blocked, false);
        }
    }

    for (const boss of SIGNATURE_BOSSES) {
        const map = signatureBossMap(boss);
        const basePlayer = buildCombatPlayer(ROOT_JOB, map.name, 'base');
        for (const seed of focusedSeeds) {
            const encounterSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'capacity-signature', boss);
            const enemy = spawnSignatureBoss(boss, basePlayer, encounterSeed);
            const admitted = settleLootVictory(
                victoryFixturePlayer(basePlayer, [], 1, SIGNATURE_PITY.THRESHOLD),
                enemy,
                encounterSeed,
                hardErrors,
                `${boss}/capacity-one-slot/${seed}`,
            );
            const blocked = settleLootVictory(
                victoryFixturePlayer(basePlayer, [filler], 1, SIGNATURE_PITY.THRESHOLD),
                enemy,
                encounterSeed,
                hardErrors,
                `${boss}/capacity-full/${seed}`,
            );
            if (admitted) addCapacitySample(oneSlot, admitted, true);
            if (blocked) addCapacitySample(full, blocked, true);
        }
    }
    return { oneSlot, full };
};

const buildExplorationDiagnostic = (
    comparisonSeeds: readonly number[],
    hardErrors: string[],
): ExplorationDiagnostic => {
    const outcomes: Record<ExplorationRhythmOutcome, number> = {
        campfire: 0,
        scout: 0,
        generalNarrative: 0,
        combat: 0,
        anomaly: 0,
        relic: 0,
        nothing: 0,
    };
    const optionalGapHistogram = createDistributionHistogram();
    const outcomeGapHistograms = Object.fromEntries(
        EXPLORATION_OUTCOMES.map((outcome) => [outcome, createDistributionHistogram()]),
    ) as Record<ExplorationRhythmOutcome, DistributionHistogram>;
    const outcomeLongestStreaks = Object.fromEntries(
        EXPLORATION_OUTCOMES.map((outcome) => [outcome, [] as number[]]),
    ) as Record<ExplorationRhythmOutcome, number[]>;
    let longestStreak = 0;
    let maxSinceNarrative = 0;
    let maxSinceRelic = 0;
    let narrativeActivations = 0;
    let discoveryActivations = 0;
    let relicActivations = 0;
    let firstRelicPityActivations = 0;
    const relicLimit = getPrestigeUnlocks(0).maxRelics;

    for (const seed of comparisonSeeds) {
        let exploreState = {
            sinceNarrativeEvent: 0,
            sinceDiscovery: 0,
            sinceRelic: 0,
            quietStreak: 0,
            lastOutcome: 'start',
        };
        const player = {
            meta: { prestigeRank: 0, mirror: {} },
            relics: [] as Array<{ id: string }>,
            stats: { exploreState },
        };
        let lastOptionalAt = 0;
        let optionalStreak = 0;
        let activeOutcome: ExplorationRhythmOutcome | null = null;
        let activeOutcomeStreak = 0;
        const lastOutcomeAt = Object.fromEntries(
            EXPLORATION_OUTCOMES.map((outcome) => [outcome, 0]),
        ) as Record<ExplorationRhythmOutcome, number>;
        const longestOutcomeStreak = Object.fromEntries(
            EXPLORATION_OUTCOMES.map((outcome) => [outcome, 0]),
        ) as Record<ExplorationRhythmOutcome, number>;

        for (let index = 0; index < EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED; index += 1) {
            const [, map] = DIAGNOSTIC_EXPLORATION_MAPS[index % DIAGNOSTIC_EXPLORATION_MAPS.length];
            const rng = createDomainRandom(
                seed,
                'progression-diagnostic-v2',
                'exploration',
                CANDIDATE_EXPLORATION_RHYTHM.id,
                CANDIDATE_EXPLORATION_RHYTHM.version,
                index,
            );
            const firstRelicPityReady = player.relics.length === 0
                && exploreState.sinceRelic >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
            const pitySteps = getExplorationPitySteps({ exploreState });
            if (pitySteps.narrative > 0) narrativeActivations += 1;
            if (pitySteps.discovery > 0) discoveryActivations += 1;
            if (pitySteps.relic > 0) relicActivations += 1;
            const outcome = resolveExplorationRhythmOutcomeStep({
                map,
                player,
                exploreState,
                policy: CANDIDATE_EXPLORATION_RHYTHM,
                eventChanceBonus: 0,
                relicLimit,
                rng,
            });
            outcomes[outcome] += 1;
            const opportunity = index + 1;
            recordDistributionValue(
                outcomeGapHistograms[outcome],
                lastOutcomeAt[outcome] > 0 ? opportunity - lastOutcomeAt[outcome] : opportunity,
            );
            lastOutcomeAt[outcome] = opportunity;
            if (activeOutcome === outcome) {
                activeOutcomeStreak += 1;
            } else {
                activeOutcome = outcome;
                activeOutcomeStreak = 1;
            }
            longestOutcomeStreak[outcome] = Math.max(
                longestOutcomeStreak[outcome],
                activeOutcomeStreak,
            );
            if (outcome === 'relic') {
                if (firstRelicPityReady) firstRelicPityActivations += 1;
                player.relics.push({ id: `diagnostic-relic-${player.relics.length + 1}` });
            }

            const optional = outcome === 'campfire'
                || outcome === 'scout'
                || outcome === 'generalNarrative';
            if (optional) {
                recordDistributionValue(
                    optionalGapHistogram,
                    lastOptionalAt > 0 ? opportunity - lastOptionalAt : opportunity,
                );
                lastOptionalAt = opportunity;
                optionalStreak += 1;
                longestStreak = Math.max(longestStreak, optionalStreak);
            } else {
                optionalStreak = 0;
            }

            exploreState = advanceExploreState(
                { exploreState },
                optional ? 'narrative_event' : outcome === 'relic' ? 'relic_found' : outcome,
            ) as typeof exploreState;
            player.stats = { exploreState };
            maxSinceNarrative = Math.max(maxSinceNarrative, exploreState.sinceNarrativeEvent);
            maxSinceRelic = Math.max(maxSinceRelic, exploreState.sinceRelic);
        }
        for (const outcome of EXPLORATION_OUTCOMES) {
            outcomeLongestStreaks[outcome].push(longestOutcomeStreak[outcome]);
        }
    }

    const opportunities = comparisonSeeds.length * EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED;
    const counted = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
    if (counted !== opportunities) hardErrors.push('exploration:outcome-count-mismatch');
    const optionalCount = outcomes.campfire + outcomes.scout + outcomes.generalNarrative;
    const outcomeRhythm = Object.fromEntries(EXPLORATION_OUTCOMES.map((outcome) => [
        outcome,
        {
            gap: histogramDistribution(outcomeGapHistograms[outcome]),
            longestStreak: distribution(outcomeLongestStreaks[outcome]),
        },
    ])) as ExplorationDiagnostic['outcomeRhythm'];
    return {
        classification: 'production-outcome-step-proxy',
        authority: 'resolveExplorationRhythmOutcomeStep',
        policy: {
            id: CANDIDATE_EXPLORATION_RHYTHM.id,
            version: CANDIDATE_EXPLORATION_RHYTHM.version,
        },
        opportunitiesPerSeed: EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED,
        opportunities,
        outcomes,
        optionalDecisions: {
            count: optionalCount,
            density: optionalCount / opportunities,
            gap: histogramDistribution(optionalGapHistogram),
            longestStreak,
        },
        outcomeRhythm,
        pity: {
            maxSinceNarrative,
            narrativeActivations,
            discoveryActivations,
            relicActivations,
            maxSinceRelic,
            firstRelicPityActivations,
        },
    };
};

const finiteCombatState = (state: GameState) => [
    state.player.hp,
    state.player.maxHp,
    state.player.mp,
    state.player.maxMp,
    state.enemy?.hp,
    state.enemy?.maxHp,
].filter((value) => value !== undefined && value !== null)
    .every((value) => Number.isFinite(value));

const resolveAction = (
    state: GameState,
    kind: 'attack' | 'skill',
    seed: number,
    now: number,
) => COMBAT_ACTION_MAP.RESOLVE_COMBAT_ACTION(state, {
    type: 'RESOLVE_COMBAT_ACTION',
    payload: { kind, expectedTurn: state.combatTurn, seed, now },
});

const runCombatEncounter = ({
    job,
    seed,
    loadout,
    actionPolicy,
    maxCombatTurns,
    hardErrors,
}: {
    job: string;
    seed: number;
    loadout: 'base' | 'eligible-loadout';
    actionPolicy: 'attack-only' | 'skill-first';
    maxCombatTurns: number;
    hardErrors: string[];
}): CombatEncounterResult => {
    const level = jobUnlockLevel(job);
    const selectedMap = highestReachableMap(level);
    const player = buildCombatPlayer(job, selectedMap.name, loadout);
    const encounterPlayer = buildCombatPlayer(job, selectedMap.name, 'base');
    const encounterRandom = createDomainRandom(seed, 'progression-diagnostic-v2', 'encounter', job);
    const { mStats: enemy } = spawnEnemy(
        selectedMap.map,
        encounterPlayer,
        [],
        { addLog: () => undefined },
        { rng: encounterRandom },
    );
    let state: GameState = {
        ...structuredClone(INITIAL_STATE),
        player,
        gameState: 'combat',
        enemy,
        combatTurn: 0,
        combatReceipt: null,
    };
    let acceptedTurns = 0;
    let rejectedSkillInputs = 0;

    while (state.gameState === 'combat' && state.enemy && acceptedTurns < maxCombatTurns) {
        const preState = state;
        const turn = acceptedTurns + 1;
        let next: GameState | null = null;
        if (actionPolicy === 'skill-first') {
            const skillSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'skill', job, loadout, turn);
            const skillState = resolveAction(preState, 'skill', skillSeed, FIXED_EPOCH_MS + turn);
            if (skillState.combatReceipt?.kind === 'rejected') {
                rejectedSkillInputs += 1;
            } else {
                next = skillState;
            }
        }
        if (!next) {
            const attackSeed = deriveSeed(seed, 'progression-diagnostic-v2', 'attack', job, loadout, turn);
            next = resolveAction(preState, 'attack', attackSeed, FIXED_EPOCH_MS + turn);
        }
        if (next === preState || next.combatTurn !== preState.combatTurn + 1) {
            hardErrors.push(`${job}/${loadout}/${actionPolicy}/${seed}:accepted-exact-no-op`);
            break;
        }
        if (!finiteCombatState(next)) {
            hardErrors.push(`${job}/${loadout}/${actionPolicy}/${seed}:non-finite-state`);
            break;
        }
        state = next;
        acceptedTurns += 1;
    }

    const outcome = state.gameState === 'combat'
        ? 'truncated'
        : state.combatReceipt?.kind === 'victory'
            ? 'victory'
            : state.gameState === 'dead' || state.combatReceipt?.kind === 'defeat'
                ? 'defeat'
                : 'forced-escape';
    if (outcome === 'truncated') {
        hardErrors.push(`${job}/${loadout}/${actionPolicy}/${seed}:truncated`);
    }
    if (outcome !== 'truncated' && state.combatReceipt?.kind
        && !['victory', 'defeat', 'escape'].includes(state.combatReceipt.kind)) {
        hardErrors.push(`${job}/${loadout}/${actionPolicy}/${seed}:outcome-mismatch`);
    }
    return {
        encounterKey: [
            enemy.name,
            enemy.baseName,
            enemy.level,
            enemy.hp,
            enemy.atk,
            enemy.def,
        ].map(String).join('|'),
        outcome,
        acceptedTurns,
        rejectedSkillInputs,
        remainingHpRatio: Math.max(0, Number(state.player.hp || 0)) / Math.max(1, Number(state.player.maxHp || 1)),
    };
};

const aggregateCombatCohort = (
    loadout: 'base' | 'eligible-loadout',
    actionPolicy: 'attack-only' | 'skill-first',
    encounters: CombatEncounterResult[],
): CombatCohortDiagnostic => ({
    loadout,
    actionPolicy,
    encounters: encounters.length,
    encounterKeys: encounters.map(({ encounterKey }) => encounterKey),
    victories: encounters.filter(({ outcome }) => outcome === 'victory').length,
    defeats: encounters.filter(({ outcome }) => outcome === 'defeat').length,
    forcedEscapes: encounters.filter(({ outcome }) => outcome === 'forced-escape').length,
    truncated: encounters.filter(({ outcome }) => outcome === 'truncated').length,
    acceptedTurns: distribution(encounters.map(({ acceptedTurns }) => acceptedTurns)),
    rejectedSkillInputs: encounters.reduce((sum, row) => sum + row.rejectedSkillInputs, 0),
    remainingHpRatio: distribution(encounters.map(({ remainingHpRatio }) => remainingHpRatio)),
});

export const runProgressionDiagnosticCohorts = (
    focusedSeeds: readonly number[],
    comparisonSeeds: readonly number[],
    maxCombatTurns: number,
): ProgressionDiagnosticCohorts => {
    const hardErrors: string[] = [];
    const combatJobs = PROGRESSION_DIAGNOSTIC_JOBS.map((job) => {
        const level = jobUnlockLevel(job);
        const map = highestReachableMap(level).name;
        const cohorts = COMBAT_LOADOUTS.flatMap((loadout) => (
            COMBAT_ACTION_POLICIES.map((actionPolicy) => {
                const encounters = focusedSeeds.map((seed) => runCombatEncounter({
                    job,
                    seed,
                    loadout,
                    actionPolicy,
                    maxCombatTurns,
                    hardErrors,
                }));
                return aggregateCombatCohort(loadout, actionPolicy, encounters);
            })
        ));
        return { job, level, map, cohorts };
    });
    const lootJobs = PROGRESSION_DIAGNOSTIC_JOBS.map((job) => (
        buildLootJobDiagnostic(job, focusedSeeds, hardErrors)
    ));
    const signatureBosses = SIGNATURE_BOSSES.map((boss) => (
        buildSignatureBossDiagnostic(boss, focusedSeeds, hardErrors)
    ));
    const capacityPressure = buildCapacityPressure(focusedSeeds, hardErrors);
    const exploration = buildExplorationDiagnostic(comparisonSeeds, hardErrors);

    return {
        combat: {
            authority: 'makeCombatActionMap.RESOLVE_COMBAT_ACTION',
            jobs: combatJobs,
        },
        loot: {
            authority: 'combatReceipt.lootSettlement',
            jobs: lootJobs,
            signatureBosses,
            capacityPressure,
        },
        exploration,
        hardErrors,
    };
};
