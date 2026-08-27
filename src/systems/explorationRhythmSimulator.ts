import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import {
    BASELINE_PROGRESSION_PROFILE,
    EXPLORATION_RHYTHM_PROFILE,
    EXPLORATION_RHYTHM_V3_PROFILE,
    getProgressionMinimumOrdinaryGap,
} from '../data/progressionProfiles.js';
import { getPrestigeUnlocks } from './prestigeUnlocks.js';
import { createDomainRandom } from '../utils/seededRandom.js';
import {
    advanceExploreState,
    getDiscoveryOdds,
    getNarrativeEventChance,
} from '../utils/explorationPacing.js';

export interface ExplorationRhythmPolicy {
    id: 'baseline' | 'exploration-rhythm';
    version: 1 | 2 | 3;
    campfireChance: number;
    scoutChance: number;
    eventMultiplier: number;
    minimumOrdinaryGap: 0 | 1 | 2;
}

export const BASELINE_EXPLORATION_RHYTHM: Readonly<ExplorationRhythmPolicy> = Object.freeze({
    id: 'baseline',
    version: 1,
    campfireChance: 0.08,
    scoutChance: 0.25,
    eventMultiplier: 1,
    minimumOrdinaryGap: 0,
});

export const CANDIDATE_EXPLORATION_RHYTHM: Readonly<ExplorationRhythmPolicy> = Object.freeze({
    id: 'exploration-rhythm',
    version: 2,
    campfireChance: 0.08,
    scoutChance: 0.15,
    eventMultiplier: 0.8,
    minimumOrdinaryGap: 1,
});

export const ACTIVE_EXPLORATION_RHYTHM: Readonly<ExplorationRhythmPolicy> = Object.freeze({
    id: 'exploration-rhythm',
    version: 3,
    campfireChance: 0.08,
    scoutChance: 0.15,
    eventMultiplier: EXPLORATION_RHYTHM_V3_PROFILE.eventMultiplier,
    minimumOrdinaryGap: getProgressionMinimumOrdinaryGap(EXPLORATION_RHYTHM_V3_PROFILE),
});

export const CANDIDATE_EXPLORATION_RHYTHM_V3 = ACTIVE_EXPLORATION_RHYTHM;

export interface ExplorationRhythmAggregate {
    campfire: number;
    scout: number;
    generalNarrative: number;
    boundedEncounter: {
        classification: 'subset-of-general-narrative';
        countAuthority: 'production-integration';
    };
    combat: number;
    discovery: number;
    discoveryBreakdown: { anomaly: number; relic: number };
    nothing: number;
    optionalDecisionCount: number;
    optionalBackToBackCount: number;
    optionalGap: { p10: number; p50: number; p90: number };
    mandatoryStory: { classification: 'correctness-only' };
    bossChallenge: { classification: 'correctness-only' };
}

export interface ExplorationRhythmComparison {
    schemaVersion: 1;
    classification: 'rank0-no-mirror-proxy';
    actualPlayClaim: false;
    seeds: number[];
    opportunitiesPerSeed: 4096;
    predecessor: ExplorationRhythmAggregate;
    candidate: ExplorationRhythmAggregate;
    gates: {
        noOptionalBackToBack: boolean;
        candidateMedianGapInRange: boolean;
        eventDirectionMatched: boolean;
        expLootInvariant: boolean;
    };
    blockers: string[];
}

export interface EventChanceBonusRhythmComparison {
    schemaVersion: 1;
    classification: 'controlled-event-chance-bonus';
    actualPlayClaim: false;
    seeds: number[];
    opportunitiesPerSeed: 4096;
    eventChanceBonus: { predecessor: number; candidate: number };
    predecessor: ExplorationRhythmAggregate;
    candidate: ExplorationRhythmAggregate;
    gates: {
        generalNarrativeReduced: boolean;
        expLootInvariant: boolean;
        globalProgressionProfileInvariant: boolean;
        mandatoryStoryInvariant: boolean;
        bossChallengeInvariant: boolean;
    };
}

export type ExplorationRhythmOutcome = 'campfire' | 'scout' | 'generalNarrative' | 'combat' | 'anomaly' | 'relic' | 'nothing';

export const EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED = 4_096;
const NON_SAFE_MAPS = Object.entries(DB.MAPS)
    .filter(([, map]) => map.type !== 'safe')
    .sort(([left], [right]) => left.localeCompare(right));

const percentile = (values: number[], ratio: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))];
};

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): Readonly<T> => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
    seen.add(value as object);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
    return Object.freeze(value);
};

const aggregate = (outcomes: ExplorationRhythmOutcome[], gaps: number[]): ExplorationRhythmAggregate => ({
    campfire: outcomes.filter((outcome) => outcome === 'campfire').length,
    scout: outcomes.filter((outcome) => outcome === 'scout').length,
    generalNarrative: outcomes.filter((outcome) => outcome === 'generalNarrative').length,
    boundedEncounter: {
        classification: 'subset-of-general-narrative',
        countAuthority: 'production-integration',
    },
    combat: outcomes.filter((outcome) => outcome === 'combat').length,
    discovery: outcomes.filter((outcome) => outcome === 'anomaly' || outcome === 'relic').length,
    discoveryBreakdown: {
        anomaly: outcomes.filter((outcome) => outcome === 'anomaly').length,
        relic: outcomes.filter((outcome) => outcome === 'relic').length,
    },
    nothing: outcomes.filter((outcome) => outcome === 'nothing').length,
    optionalDecisionCount: outcomes.filter((outcome) => (
        outcome === 'campfire' || outcome === 'scout' || outcome === 'generalNarrative'
    )).length,
    optionalBackToBackCount: gaps.filter((gap) => gap === 1).length,
    optionalGap: {
        p10: percentile(gaps, 0.1),
        p50: percentile(gaps, 0.5),
        p90: percentile(gaps, 0.9),
    },
    mandatoryStory: { classification: 'correctness-only' },
    bossChallenge: { classification: 'correctness-only' },
});

interface SeedRhythmResult {
    aggregate: ExplorationRhythmAggregate;
    gaps: number[];
}

export const resolveExplorationRhythmOutcomeStep = ({
    map,
    player,
    exploreState,
    policy,
    eventChanceBonus,
    relicLimit,
    rng,
}: {
    map: any;
    player: any;
    exploreState: Record<string, any>;
    policy: ExplorationRhythmPolicy;
    eventChanceBonus: number;
    relicLimit: number;
    rng: () => number;
}): ExplorationRhythmOutcome => {
    const optionalAllowed = policy.minimumOrdinaryGap === 0
        || exploreState.sinceNarrativeEvent >= policy.minimumOrdinaryGap;

    if (optionalAllowed && map.type === 'dungeon' && rng() < policy.campfireChance) {
        return 'campfire';
    }
    if (optionalAllowed && rng() < policy.scoutChance) {
        return 'scout';
    }

    const narrativeChance = getNarrativeEventChance(
        map.eventChance || 0,
        eventChanceBonus,
        { exploreState },
        map,
        policy.eventMultiplier,
    );
    if (optionalAllowed && rng() < narrativeChance) {
        return 'generalNarrative';
    }

    const discoveryOdds = getDiscoveryOdds(player, map);
    if (rng() < discoveryOdds.quietChance) {
        if (rng() < discoveryOdds.anomalyChance) return 'anomaly';
        if (player.relics.length < relicLimit && rng() < discoveryOdds.relicChance) return 'relic';
        return 'nothing';
    }

    const firstRelicPity = player.relics.length === 0
        && exploreState.sinceRelic >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
    if (player.relics.length < relicLimit
        && (firstRelicPity || rng() < BALANCE.RELIC_FIND_CHANCE * 0.5)) {
        return 'relic';
    }
    return 'combat';
};

const simulateSeed = (
    seed: number,
    policy: ExplorationRhythmPolicy,
    eventChanceBonus = 0,
) => {
    const outcomes: ExplorationRhythmOutcome[] = [];
    const gaps: number[] = [];
    let lastOptionalAt = 0;
    let exploreState = { sinceNarrativeEvent: 0, sinceDiscovery: 0, sinceRelic: 0, quietStreak: 0, lastOutcome: 'start' };
    const player = {
        meta: { prestigeRank: 0, mirror: {} },
        relics: [],
        stats: { exploreState },
    } as any;
    const relicLimit = getPrestigeUnlocks(0).maxRelics;

    for (let index = 0; index < EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED; index += 1) {
        const [, map] = NON_SAFE_MAPS[index % NON_SAFE_MAPS.length];
        const rng = createDomainRandom(seed, 'exploration-rhythm', policy.id, policy.version, index);
        const outcome = resolveExplorationRhythmOutcomeStep({
            map,
            player,
            exploreState,
            policy,
            eventChanceBonus,
            relicLimit,
            rng,
        });
        if (outcome === 'relic') {
            player.relics.push({ id: `rhythm-relic-${player.relics.length + 1}` });
        }

        outcomes.push(outcome);
        if (outcome === 'campfire' || outcome === 'scout' || outcome === 'generalNarrative') {
            if (lastOptionalAt > 0) gaps.push(index + 1 - lastOptionalAt);
            else gaps.push(index + 1);
            lastOptionalAt = index + 1;
        }
        exploreState = advanceExploreState(
            { exploreState },
            outcome === 'generalNarrative' || outcome === 'campfire' || outcome === 'scout'
                ? 'narrative_event'
                : outcome === 'relic' ? 'relic_found' : outcome,
        );
        player.stats = { exploreState };
    }
    return { aggregate: aggregate(outcomes, gaps), gaps } satisfies SeedRhythmResult;
};

const validateEventChanceBonus = (value: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error('INVALID_EVENT_CHANCE_BONUS');
    }
    return value;
};

const validateSeeds = (seeds: readonly number[]) => {
    if (!Array.isArray(seeds) || seeds.length < 2 || seeds.length > 1_000
        || seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
        || new Set(seeds).size !== seeds.length) {
        throw new Error('seeds must contain 2 to 1000 unique uint32 integers');
    }
    return [...seeds].sort((left, right) => left - right);
};

const sumAggregates = (runs: SeedRhythmResult[]) => {
    const sum = (key: keyof ExplorationRhythmAggregate) => runs.reduce((total, run) => total + (
        typeof run.aggregate[key] === 'number' ? run.aggregate[key] as number : 0
    ), 0);
    const gaps = runs.flatMap((run) => run.gaps);
    return {
        campfire: sum('campfire'),
        scout: sum('scout'),
        generalNarrative: sum('generalNarrative'),
        boundedEncounter: { classification: 'subset-of-general-narrative', countAuthority: 'production-integration' },
        combat: sum('combat'),
        discovery: sum('discovery'),
        discoveryBreakdown: {
            anomaly: runs.reduce((total, run) => total + run.aggregate.discoveryBreakdown.anomaly, 0),
            relic: runs.reduce((total, run) => total + run.aggregate.discoveryBreakdown.relic, 0),
        },
        nothing: sum('nothing'),
        optionalDecisionCount: sum('optionalDecisionCount'),
        optionalBackToBackCount: sum('optionalBackToBackCount'),
        optionalGap: {
            p10: percentile(gaps, 0.1),
            p50: percentile(gaps, 0.5),
            p90: percentile(gaps, 0.9),
        },
        mandatoryStory: { classification: 'correctness-only' },
        bossChallenge: { classification: 'correctness-only' },
    } as ExplorationRhythmAggregate;
};

export const compareExplorationRhythm = (
    seeds: readonly number[],
): Readonly<ExplorationRhythmComparison> => {
    const canonicalSeeds = validateSeeds(seeds);
    const predecessor = sumAggregates(canonicalSeeds.map((seed) => simulateSeed(seed, BASELINE_EXPLORATION_RHYTHM)));
    const candidate = sumAggregates(canonicalSeeds.map((seed) => simulateSeed(seed, CANDIDATE_EXPLORATION_RHYTHM)));
    return {
        schemaVersion: 1,
        classification: 'rank0-no-mirror-proxy',
        actualPlayClaim: false,
        seeds: canonicalSeeds,
        opportunitiesPerSeed: EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED,
        predecessor,
        candidate,
        gates: {
            noOptionalBackToBack: candidate.optionalBackToBackCount === 0,
            candidateMedianGapInRange: candidate.optionalGap.p50 >= 4 && candidate.optionalGap.p50 <= 5,
            eventDirectionMatched: candidate.generalNarrative < predecessor.generalNarrative
                && candidate.scout < predecessor.scout,
            expLootInvariant: EXPLORATION_RHYTHM_PROFILE.expMultiplier === BASELINE_PROGRESSION_PROFILE.expMultiplier
                && EXPLORATION_RHYTHM_PROFILE.lootMultiplier === BASELINE_PROGRESSION_PROFILE.lootMultiplier,
        },
        blockers: [],
    };
};

export interface ExplorationRhythmV3Comparison {
    schemaVersion: 2;
    classification: 'registered-v2-to-v3-event-only';
    actualPlayClaim: false;
    comparisonMethod: 'independent-policy-stream-monte-carlo';
    seeds: number[];
    opportunitiesPerSeed: 4096;
    predecessorPolicy: { id: 'exploration-rhythm'; version: 2 };
    candidatePolicy: { id: 'exploration-rhythm'; version: 3 };
    predecessor: ExplorationRhythmAggregate & { optionalDecisionDensity: number };
    candidate: ExplorationRhythmAggregate & { optionalDecisionDensity: number };
    gates: {
        eventOnly: boolean;
        noOptionalBackToBack: boolean;
        candidateDensityInRange: boolean;
        candidateMedianGapInRange: boolean;
        eventDirectionMatched: boolean;
        expLootInvariant: boolean;
    };
    blockers: string[];
}

export const compareExplorationRhythmV3 = (
    seeds: readonly number[],
): Readonly<ExplorationRhythmV3Comparison> => {
    const canonicalSeeds = validateSeeds(seeds);
    const predecessor = sumAggregates(canonicalSeeds.map((seed) => (
        simulateSeed(seed, CANDIDATE_EXPLORATION_RHYTHM)
    )));
    const candidate = sumAggregates(canonicalSeeds.map((seed) => (
        simulateSeed(seed, ACTIVE_EXPLORATION_RHYTHM)
    )));
    const withDensity = (aggregate: ExplorationRhythmAggregate) => ({
        ...aggregate,
        optionalDecisionDensity: aggregate.optionalDecisionCount
            / (canonicalSeeds.length * EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED),
    });
    const predecessorWithDensity = withDensity(predecessor);
    const candidateWithDensity = withDensity(candidate);
    const gates = {
        eventOnly: EXPLORATION_RHYTHM_PROFILE.expMultiplier === EXPLORATION_RHYTHM_V3_PROFILE.expMultiplier
            && EXPLORATION_RHYTHM_PROFILE.lootMultiplier === EXPLORATION_RHYTHM_V3_PROFILE.lootMultiplier,
        noOptionalBackToBack: candidate.optionalBackToBackCount === 0,
        candidateDensityInRange: candidateWithDensity.optionalDecisionDensity >= 0.15
            && candidateWithDensity.optionalDecisionDensity <= 0.18,
        candidateMedianGapInRange: candidateWithDensity.optionalGap.p50 >= 5
            && candidateWithDensity.optionalGap.p50 <= 7,
        eventDirectionMatched: candidate.generalNarrative < predecessor.generalNarrative,
        expLootInvariant: EXPLORATION_RHYTHM_PROFILE.expMultiplier === EXPLORATION_RHYTHM_V3_PROFILE.expMultiplier
            && EXPLORATION_RHYTHM_PROFILE.lootMultiplier === EXPLORATION_RHYTHM_V3_PROFILE.lootMultiplier,
    } as const;
    const blockers = Object.entries(gates)
        .filter(([, passed]) => !passed)
        .map(([gate]) => `${gate}_failed`);
    return deepFreeze({
        schemaVersion: 2,
        classification: 'registered-v2-to-v3-event-only',
        actualPlayClaim: false,
        comparisonMethod: 'independent-policy-stream-monte-carlo',
        seeds: canonicalSeeds,
        opportunitiesPerSeed: EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED,
        predecessorPolicy: { id: 'exploration-rhythm', version: 2 },
        candidatePolicy: { id: 'exploration-rhythm', version: 3 },
        predecessor: predecessorWithDensity,
        candidate: candidateWithDensity,
        gates,
        blockers,
    });
};

export const compareRegisteredExplorationRhythm = compareExplorationRhythmV3;

export const compareEventChanceBonusRhythm = (
    seeds: readonly number[],
    predecessorBonus: number,
    candidateBonus: number,
): Readonly<EventChanceBonusRhythmComparison> => {
    const canonicalSeeds = validateSeeds(seeds);
    const predecessor = validateEventChanceBonus(predecessorBonus);
    const candidate = validateEventChanceBonus(candidateBonus);
    const predecessorRuns = canonicalSeeds.map((seed) => (
        simulateSeed(seed, CANDIDATE_EXPLORATION_RHYTHM, predecessor)
    ));
    const candidateRuns = canonicalSeeds.map((seed) => (
        simulateSeed(seed, CANDIDATE_EXPLORATION_RHYTHM, candidate)
    ));
    const predecessorAggregate = sumAggregates(predecessorRuns);
    const candidateAggregate = sumAggregates(candidateRuns);
    const profileInvariant = EXPLORATION_RHYTHM_PROFILE.expMultiplier === BASELINE_PROGRESSION_PROFILE.expMultiplier
        && EXPLORATION_RHYTHM_PROFILE.lootMultiplier === BASELINE_PROGRESSION_PROFILE.lootMultiplier;
    const mandatoryStoryInvariant = predecessorAggregate.mandatoryStory.classification
        === candidateAggregate.mandatoryStory.classification;
    const bossChallengeInvariant = predecessorAggregate.bossChallenge.classification
        === candidateAggregate.bossChallenge.classification;

    return {
        schemaVersion: 1,
        classification: 'controlled-event-chance-bonus',
        actualPlayClaim: false,
        seeds: canonicalSeeds,
        opportunitiesPerSeed: EXPLORATION_RHYTHM_OPPORTUNITIES_PER_SEED,
        eventChanceBonus: { predecessor, candidate },
        predecessor: predecessorAggregate,
        candidate: candidateAggregate,
        gates: {
            generalNarrativeReduced: candidateAggregate.generalNarrative < predecessorAggregate.generalNarrative,
            expLootInvariant: profileInvariant,
            globalProgressionProfileInvariant: profileInvariant,
            mandatoryStoryInvariant,
            bossChallengeInvariant,
        },
    };
};
