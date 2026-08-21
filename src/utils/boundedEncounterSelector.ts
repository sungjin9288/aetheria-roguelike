import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import type {
    BoundedEncounter,
    BoundedEncounterChoice,
    BoundedEncounterContext,
} from '../types/encounter.js';
import type { Player } from '../types/player.js';
import { grantGold } from './gameUtils.js';
import { getDiscoveredSignatureNames } from './signatureDiscovery.js';
import { calculateFullStats } from './statsCalculator.js';

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const HP_BANDS = new Set(['critical', 'strained', 'healthy']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);
const isCopy = (value: unknown) => typeof value === 'string' && value.trim() === value && value.length > 0;
const isNonNegative = (value: unknown) => Number.isFinite(value) && Number(value) >= 0;

const canonicalItemNames = new Set(
    ['weapons', 'armors', 'consumables', 'materials']
        .flatMap((key) => Array.isArray((DB.ITEMS as any)[key]) ? (DB.ITEMS as any)[key] : [])
        .map((item: any) => item?.name)
        .filter(isCopy),
);

const canonicalBossNames = new Set<string>();
for (const [name, monster] of Object.entries(DB.MONSTERS)) {
    if ((monster as any)?.isBoss) canonicalBossNames.add(name);
}
for (const map of Object.values(DB.MAPS)) {
    if (typeof map.boss === 'string') canonicalBossNames.add(map.boss);
    for (const name of Array.isArray(map.bossMonsters) ? map.bossMonsters : []) {
        canonicalBossNames.add(name);
    }
}

const validateCost = (cost: unknown) => {
    if (cost === undefined) return true;
    if (!isPlainObject(cost)) return false;
    const keys = Object.keys(cost);
    return keys.every((key) => ['hp', 'mp', 'gold'].includes(key) && isNonNegative(cost[key]));
};

const validateBuff = (buff: unknown) => {
    if (buff === undefined) return true;
    if (!isPlainObject(buff) || !isCopy(buff.name)
        || !Number.isSafeInteger(buff.turn) || Number(buff.turn) < 1) return false;
    if (buff.atk !== undefined && !isNonNegative(buff.atk)) return false;
    if (buff.def !== undefined && !isNonNegative(buff.def)) return false;
    return buff.atk !== undefined || buff.def !== undefined;
};

const validateChoice = (choice: unknown, errors: string[]) => {
    if (!isPlainObject(choice) || !SAFE_ID.test(String(choice.id || ''))) {
        errors.push(`CHOICE_SCHEMA_INVALID:${String((choice as any)?.id || 'unknown')}`);
        return;
    }
    const id = String(choice.id);
    if (!isCopy(choice.label) || !isCopy(choice.tradeoff) || !isPlainObject(choice.outcome)
        || !isCopy(choice.outcome.result)) errors.push(`CHOICE_COPY_INVALID:${id}`);
    if (!validateCost(choice.cost)) errors.push(`CHOICE_COST_INVALID:${id}`);
    const outcome = isPlainObject(choice.outcome) ? choice.outcome : {};
    for (const key of ['hp', 'mp', 'gold']) {
        if (outcome[key] !== undefined && !isNonNegative(outcome[key])) {
            errors.push(`CHOICE_OUTCOME_INVALID:${id}`);
        }
    }
    if (outcome.item !== undefined && !canonicalItemNames.has(String(outcome.item))) {
        errors.push(`CHOICE_ITEM_INVALID:${id}`);
    }
    if (!validateBuff(outcome.buff)) errors.push(`CHOICE_BUFF_INVALID:${id}`);
    const materialEffects = ['hp', 'mp', 'gold', 'item', 'buff'].filter((key) => outcome[key] !== undefined);
    if (materialEffects.length === 0) errors.push(`CHOICE_EFFECT_MISSING:${id}`);
};

const validateEncounter = (encounter: unknown) => {
    const errors: string[] = [];
    if (!isPlainObject(encounter) || !SAFE_ID.test(String(encounter.id || '')) || encounter.version !== 1) {
        return { ok: false, errors: ['ENCOUNTER_SCHEMA_INVALID'] };
    }
    const id = String(encounter.id);
    const map = DB.MAPS[String(encounter.region || '')];
    if (!map || map.type === 'safe') errors.push(`ENCOUNTER_REGION_INVALID:${id}`);
    if (!isCopy(encounter.family) || !isCopy(encounter.situation)) {
        errors.push(`ENCOUNTER_COPY_INVALID:${id}`);
    }
    if (!isPlainObject(encounter.eligibility)) {
        errors.push(`ENCOUNTER_ELIGIBILITY_INVALID:${id}`);
    } else {
        const eligibility = encounter.eligibility;
        if (eligibility.lineage !== undefined
            && (!Array.isArray(eligibility.lineage) || eligibility.lineage.length === 0
                || !eligibility.lineage.every((job) => isCopy(job) && Object.hasOwn(DB.CLASSES, job)))) {
            errors.push(`ENCOUNTER_LINEAGE_INVALID:${id}`);
        }
        if (eligibility.hpBand !== undefined && !HP_BANDS.has(String(eligibility.hpBand))) {
            errors.push(`ENCOUNTER_HP_BAND_INVALID:${id}`);
        }
        if (eligibility.requiresSignature !== undefined && eligibility.requiresSignature !== true) {
            errors.push(`ENCOUNTER_SIGNATURE_RULE_INVALID:${id}`);
        }
        if (eligibility.previousBoss !== undefined
            && !canonicalBossNames.has(String(eligibility.previousBoss))) {
            errors.push(`ENCOUNTER_BOSS_INVALID:${id}`);
        }
    }
    if (!Array.isArray(encounter.choices) || encounter.choices.length < 2) {
        errors.push(`ENCOUNTER_CHOICES_INVALID:${id}`);
    } else {
        encounter.choices.forEach((entry) => validateChoice(entry, errors));
        const choiceIds = new Set<string>();
        for (const entry of encounter.choices) {
            const choiceId = String((entry as any)?.id || '');
            if (choiceIds.has(choiceId)) errors.push(`CHOICE_ID_DUPLICATE:${choiceId}`);
            choiceIds.add(choiceId);
        }
    }
    return { ok: errors.length === 0, errors };
};

export const validateBoundedEncounterPack = (
    encounters: readonly BoundedEncounter[],
    selectedRegions: readonly string[],
) => {
    const errors: string[] = [];
    if (!Array.isArray(encounters) || !Array.isArray(selectedRegions)
        || selectedRegions.length !== 2 || new Set(selectedRegions).size !== 2
        || selectedRegions.some((region) => !DB.MAPS[region] || DB.MAPS[region].type === 'safe')) {
        return { ok: false, errors: ['SELECTED_REGIONS_INVALID'] };
    }
    const encounterIds = new Set<string>();
    const choiceIds = new Set<string>();
    for (const encounter of encounters) {
        const result = validateEncounter(encounter);
        errors.push(...result.errors);
        if (encounterIds.has(encounter?.id)) errors.push(`ENCOUNTER_ID_DUPLICATE:${encounter?.id}`);
        encounterIds.add(encounter?.id);
        for (const choice of Array.isArray(encounter?.choices) ? encounter.choices : []) {
            if (choiceIds.has(choice.id)) errors.push(`CHOICE_ID_DUPLICATE:${choice.id}`);
            choiceIds.add(choice.id);
        }
    }
    for (const region of selectedRegions) {
        const regional = encounters.filter((encounter) => encounter.region === region);
        if (regional.length !== 2 || new Set(regional.map((encounter) => encounter.family)).size !== 2) {
            errors.push(`REGION_FAMILY_COUNT_INVALID:${region}`);
        }
        if (!regional.some((encounter) => Object.keys(encounter.eligibility || {}).length === 0)) {
            errors.push(`REGION_UNCONDITIONAL_ENCOUNTER_MISSING:${region}`);
        }
    }
    if (encounters.some((encounter) => !selectedRegions.includes(encounter.region))) {
        errors.push('UNSELECTED_REGION_ENCOUNTER');
    }
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
};

export const buildBoundedEncounterReceiptKey = (
    expeditionId: string,
    encounterId: string,
    occurrenceSequence: number,
) => {
    if (!SAFE_ID.test(expeditionId) || !SAFE_ID.test(encounterId)
        || !Number.isSafeInteger(occurrenceSequence) || occurrenceSequence < 1) {
        throw new Error('INVALID_BOUNDED_ENCOUNTER_RECEIPT');
    }
    return `${expeditionId}:${encounterId}:${occurrenceSequence}`;
};

const hpBandFor = (hp: number, maxHp: number) => {
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0 || hp < 0) return null;
    const ratio = hp / maxHp;
    if (ratio <= 0.3) return 'critical';
    if (ratio <= 0.65) return 'strained';
    return 'healthy';
};

const effectiveVitalsFor = (player: Player) => {
    const storedMaxHp = Number(player?.maxHp);
    const storedMaxMp = Number(player?.maxMp);
    const fallback = Number.isFinite(storedMaxHp) && storedMaxHp > 0
        && Number.isFinite(storedMaxMp) && storedMaxMp >= 0
        ? { maxHp: storedMaxHp, maxMp: storedMaxMp }
        : null;
    try {
        const stats = calculateFullStats(player);
        if (!stats || !Number.isFinite(stats.maxHp) || stats.maxHp <= 0
            || !Number.isFinite(stats.maxMp) || stats.maxMp < 0) return null;
        return { maxHp: Number(stats.maxHp), maxMp: Number(stats.maxMp) };
    } catch {
        return fallback;
    }
};

export const isBoundedEncounterEligible = (
    encounter: BoundedEncounter,
    context: BoundedEncounterContext,
    receipt?: { expeditionId: string; occurrenceSequence: number },
) => {
    if (!validateEncounter(encounter).ok || !isPlainObject(context)) return false;
    if (encounter.region !== context.region
        || !Array.isArray(context.jobLineage)
        || !Array.isArray(context.signatureNames)
        || !Array.isArray(context.bossNames)
        || !Array.isArray(context.receiptKeys)) return false;
    if (receipt) {
        let receiptKey: string;
        try {
            receiptKey = buildBoundedEncounterReceiptKey(
                receipt.expeditionId,
                encounter.id,
                receipt.occurrenceSequence,
            );
        } catch {
            return false;
        }
        if (context.receiptKeys.includes(receiptKey)) return false;
    }
    const eligibility = encounter.eligibility;
    if (eligibility.lineage
        && !eligibility.lineage.some((job) => context.jobLineage.includes(job))) return false;
    if (eligibility.hpBand && hpBandFor(context.hp, context.maxHp) !== eligibility.hpBand) return false;
    if (eligibility.requiresSignature
        && !context.signatureNames.some((name) => Object.hasOwn(SIGNATURE_ITEM_REGISTRY, name))) return false;
    if (eligibility.previousBoss && !context.bossNames.includes(eligibility.previousBoss)) return false;
    return true;
};

export const selectBoundedEncounter = (
    encounters: readonly BoundedEncounter[],
    context: BoundedEncounterContext,
    receiptOrRng: { expeditionId: string; occurrenceSequence: number } | (() => number),
    maybeRng?: () => number,
) => {
    const receipt = typeof receiptOrRng === 'function' ? undefined : receiptOrRng;
    const rng = typeof receiptOrRng === 'function' ? receiptOrRng : maybeRng;
    if (!Array.isArray(encounters) || typeof rng !== 'function') return null;
    const eligible = encounters
        .filter((encounter) => isBoundedEncounterEligible(encounter, context, receipt))
        .sort((left, right) => left.id.localeCompare(right.id));
    if (eligible.length === 0) return null;
    const roll = rng();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    return eligible[Math.floor(roll * eligible.length)] || null;
};

const jobLineageFor = (job: string) => {
    if (!Object.hasOwn(DB.CLASSES, job)) return [];
    const queue: Array<{ job: string; path: string[] }> = [{ job: '모험가', path: ['모험가'] }];
    const visited = new Set<string>();
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current.job)) continue;
        visited.add(current.job);
        if (current.job === job) return current.path;
        const classDef = DB.CLASSES[current.job];
        for (const next of Array.isArray(classDef?.next) ? classDef.next : []) {
            if (typeof next === 'string') queue.push({ job: next, path: [...current.path, next] });
        }
    }
    return [];
};

export const buildBoundedEncounterContext = (player: Player, region: string): BoundedEncounterContext | null => {
    const effectiveVitals = effectiveVitalsFor(player);
    if (!effectiveVitals) return null;
    const journey = isPlainObject((player as any)?.classJourney) ? (player as any).classJourney : {};
    const byJob = isPlainObject(journey.byJob) ? journey.byJob : {};
    const bossNames = Object.values(byJob).flatMap((entry: any) => (
        isPlainObject(entry) && Array.isArray(entry.bossNames) ? entry.bossNames : []
    )).filter((name): name is string => typeof name === 'string');
    const progress = isPlainObject((player as any)?.eventChainProgress) ? (player as any).eventChainProgress : {};
    if (progress.boundedEncounterReceipts !== undefined
        && !isPlainObject(progress.boundedEncounterReceipts)) return null;
    const receipts = isPlainObject(progress.boundedEncounterReceipts)
        ? Object.keys(progress.boundedEncounterReceipts)
        : [];
    return {
        region,
        jobLineage: jobLineageFor(String((player as any)?.job || '')),
        hp: Number((player as any)?.hp || 0),
        maxHp: effectiveVitals.maxHp,
        signatureNames: getDiscoveredSignatureNames(player),
        bossNames: [...new Set(bossNames)],
        receiptKeys: receipts,
    };
};

const settlementFailure = (player: Player, reason: string, receiptKey: string | null = null) => ({
    applied: false as const,
    player,
    reason,
    receiptKey,
    result: null,
});

export const applyBoundedEncounterChoice = (
    player: Player,
    encounter: BoundedEncounter,
    choiceId: string,
    receipt: { expeditionId: string; occurrenceSequence: number },
) => {
    if (!validateEncounter(encounter).ok) return settlementFailure(player, 'invalid_encounter');
    const choice = encounter.choices.find((entry) => entry.id === choiceId) as BoundedEncounterChoice | undefined;
    if (!choice) return settlementFailure(player, 'invalid_choice');
    let receiptKey: string;
    try {
        receiptKey = buildBoundedEncounterReceiptKey(
            receipt.expeditionId,
            encounter.id,
            receipt.occurrenceSequence,
        );
    } catch {
        return settlementFailure(player, 'invalid_receipt');
    }
    const progress = isPlainObject(player.eventChainProgress) ? player.eventChainProgress : {};
    const existingReceipts = progress.boundedEncounterReceipts;
    if (existingReceipts !== undefined && !isPlainObject(existingReceipts)) {
        return settlementFailure(player, 'invalid_receipt_ledger', receiptKey);
    }
    if (isPlainObject(existingReceipts) && Object.hasOwn(existingReceipts, receiptKey)) {
        return settlementFailure(player, 'already_applied', receiptKey);
    }

    const cost = choice.cost || {};
    const hp = Number(player.hp);
    const mp = Number(player.mp);
    const gold = Number(player.gold);
    if (![hp, mp, gold].every(Number.isFinite)
        || hp - (cost.hp || 0) < 1
        || mp < (cost.mp || 0)
        || gold < (cost.gold || 0)) {
        return settlementFailure(player, 'insufficient_resources', receiptKey);
    }
    if (choice.outcome.item) {
        const capacity = Number.isSafeInteger(player.maxInv) && Number(player.maxInv) > 0
            ? Number(player.maxInv)
            : BALANCE.INV_MAX_SIZE;
        if ((player.inv || []).length >= capacity) {
            return settlementFailure(player, 'inventory_full', receiptKey);
        }
    }

    const effectiveVitals = effectiveVitalsFor(player);
    if (!effectiveVitals) return settlementFailure(player, 'invalid_player_vitals', receiptKey);
    const { maxHp, maxMp } = effectiveVitals;
    const outcome = choice.outcome;
    let nextPlayer: Player = {
        ...player,
        hp: Math.min(maxHp, hp - (cost.hp || 0) + (outcome.hp || 0)),
        mp: Math.min(maxMp, mp - (cost.mp || 0) + (outcome.mp || 0)),
        gold: gold - (cost.gold || 0),
    };
    nextPlayer = grantGold(nextPlayer, outcome.gold || 0);
    if (outcome.item) {
        const item = canonicalItemNames.has(outcome.item)
            ? ['weapons', 'armors', 'consumables', 'materials']
                .flatMap((key) => (DB.ITEMS as any)[key] || [])
                .find((entry: any) => entry?.name === outcome.item)
            : null;
        if (!item) return settlementFailure(player, 'invalid_item', receiptKey);
        nextPlayer = {
            ...nextPlayer,
            inv: [...(player.inv || []), { ...item, id: `bounded:${receiptKey}` }],
        };
    }
    if (outcome.buff) nextPlayer = { ...nextPlayer, tempBuff: { ...outcome.buff } };
    nextPlayer = {
        ...nextPlayer,
        eventChainProgress: {
            ...progress,
            boundedEncounterReceipts: {
                ...(existingReceipts || {}),
                [receiptKey]: { encounterId: encounter.id, choiceId },
            },
        },
    };
    return {
        applied: true as const,
        player: nextPlayer,
        reason: 'applied',
        receiptKey,
        result: outcome.result,
    };
};
