import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import {
    BASELINE_PROGRESSION_PROFILE,
    EXPLORATION_RHYTHM_PROFILE,
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
    version: 1 | 2;
    campfireChance: number;
    scoutChance: number;
    eventMultiplier: number;
    minimumOrdinaryGap: 0 | 1;
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

type Outcome = 'campfire' | 'scout' | 'generalNarrative' | 'combat' | 'anomaly' | 'relic' | 'nothing';

const OPPORTUNITIES_PER_SEED = 4_096;
const NON_SAFE_MAPS = Object.entries(DB.MAPS)
    .filter(([, map]) => map.type !== 'safe')
    .sort(([left], [right]) => left.localeCompare(right));

const percentile = (values: number[], ratio: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))];
};

const aggregate = (outcomes: Outcome[], gaps: number[]): ExplorationRhythmAggregate => ({
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

const simulateSeed = (seed: number, policy: ExplorationRhythmPolicy) => {
    const outcomes: Outcome[] = [];
    const gaps: number[] = [];
    let lastOptionalAt = 0;
    let exploreState = { sinceNarrativeEvent: 0, sinceDiscovery: 0, sinceRelic: 0, quietStreak: 0, lastOutcome: 'start' };
    const player = {
        meta: { prestigeRank: 0, mirror: {} },
        relics: [],
        stats: { exploreState },
    } as any;
    const relicLimit = getPrestigeUnlocks(0).maxRelics;

    for (let index = 0; index < OPPORTUNITIES_PER_SEED; index += 1) {
        const [, map] = NON_SAFE_MAPS[index % NON_SAFE_MAPS.length];
        const rng = createDomainRandom(seed, 'exploration-rhythm', policy.id, policy.version, index);
        const optionalAllowed = policy.minimumOrdinaryGap === 0 || exploreState.sinceNarrativeEvent >= policy.minimumOrdinaryGap;
        let outcome: Outcome = 'combat';

        if (optionalAllowed && map.type === 'dungeon' && rng() < policy.campfireChance) {
            outcome = 'campfire';
        } else if (optionalAllowed && rng() < policy.scoutChance) {
            outcome = 'scout';
        } else {
            const narrativeChance = getNarrativeEventChance(
                map.eventChance || 0,
                0,
                { exploreState },
                map,
                policy.eventMultiplier,
            );
            if (optionalAllowed && rng() < narrativeChance) {
                outcome = 'generalNarrative';
            } else {
                const discoveryOdds = getDiscoveryOdds(player, map);
                if (rng() < discoveryOdds.quietChance) {
                    if (rng() < discoveryOdds.anomalyChance) {
                        outcome = 'anomaly';
                    } else if (player.relics.length < relicLimit && rng() < discoveryOdds.relicChance) {
                        outcome = 'relic';
                        player.relics.push({ id: `rhythm-relic-${player.relics.length + 1}` });
                    } else {
                        outcome = 'nothing';
                    }
                } else {
                    const firstRelicPity = player.relics.length === 0
                        && exploreState.sinceRelic >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
                    if (player.relics.length < relicLimit
                        && (firstRelicPity || rng() < BALANCE.RELIC_FIND_CHANCE * 0.5)) {
                        outcome = 'relic';
                        player.relics.push({ id: `rhythm-relic-${player.relics.length + 1}` });
                    }
                }
            }
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
        opportunitiesPerSeed: OPPORTUNITIES_PER_SEED,
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
