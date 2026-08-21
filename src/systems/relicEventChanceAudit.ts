import type { Relic } from '../types/relic.js';
import { getAdditiveNumericRelicValue } from '../utils/relicEffectValues.js';
import {
    compareEventChanceBonusRhythm,
    type EventChanceBonusRhythmComparison,
} from './explorationRhythmSimulator.js';

export interface RelicEventChanceReport {
    schemaVersion: 1;
    classification: 'controlled-relic-event-chance';
    actualPlayClaim: false;
    policy: {
        stacking: 'additive';
        ancientMapCandidate: number;
        wandererCharm: number;
        candidateBothOrders: [number, number];
        legacyAncientMap: 0.6;
        legacyBothOrders: [number, number];
        activeRunSnapshot: 'preserved';
    };
    rhythm: {
        none: EventChanceBonusRhythmComparison;
        mapOnly: EventChanceBonusRhythmComparison;
        charm: EventChanceBonusRhythmComparison;
        stacked: EventChanceBonusRhythmComparison;
    };
    runtimePriority: {
        mandatoryStoryBeforeOptionalRoll: boolean;
        bossChallengeBeforeOptionalRoll: boolean;
    };
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const isExactEventChanceRelic = (
    relic: Relic | undefined,
    expected: { id: string; rarity: string; desc: string; value: number },
) => relic?.id === expected.id
    && relic.rarity === expected.rarity
    && relic.desc === expected.desc
    && relic.effect === 'event_chance'
    && relic.val === expected.value;

const numericValue = (relic: Relic | undefined) => (
    typeof relic?.val === 'number' && Number.isFinite(relic.val) && relic.val >= 0
        ? relic.val
        : 0
);

export const canonicalizeRelicEventChanceReport = (
    report: RelicEventChanceReport,
): RelicEventChanceReport => ({
    schemaVersion: 1,
    classification: 'controlled-relic-event-chance',
    actualPlayClaim: false,
    policy: {
        stacking: 'additive',
        ancientMapCandidate: report.policy.ancientMapCandidate,
        wandererCharm: report.policy.wandererCharm,
        candidateBothOrders: [...report.policy.candidateBothOrders] as [number, number],
        legacyAncientMap: 0.6,
        legacyBothOrders: [...report.policy.legacyBothOrders] as [number, number],
        activeRunSnapshot: 'preserved',
    },
    rhythm: {
        none: structuredClone(report.rhythm.none),
        mapOnly: structuredClone(report.rhythm.mapOnly),
        charm: structuredClone(report.rhythm.charm),
        stacked: structuredClone(report.rhythm.stacked),
    },
    runtimePriority: { ...report.runtimePriority },
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicEventChanceReport = ({
    relics,
    seeds,
    exploreActionsSource,
}: {
    relics: readonly Relic[];
    seeds: readonly number[];
    exploreActionsSource: string;
}): RelicEventChanceReport => {
    const errors = new Set<string>();
    const family = relics.filter((relic) => relic.effect === 'event_chance');
    const ancientMap = family.find((relic) => relic.id === 'ancient_map');
    const wandererCharm = family.find((relic) => relic.id === 'wanderer_charm');

    const familyIds = family.map((relic) => (
        typeof relic.id === 'string' ? relic.id : ''
    )).sort(compareText);
    if (family.length !== 2
        || familyIds[0] !== 'ancient_map'
        || familyIds[1] !== 'wanderer_charm') {
        errors.add('EVENT_CHANCE_FAMILY_IDS_MISMATCH');
    }
    if (!isExactEventChanceRelic(ancientMap, {
        id: 'ancient_map',
        rarity: 'common',
        desc: '이벤트 발생률 15% 증가',
        value: 0.15,
    })) {
        errors.add('ANCIENT_MAP_POLICY_MISMATCH');
    }
    if (!isExactEventChanceRelic(wandererCharm, {
        id: 'wanderer_charm',
        rarity: 'uncommon',
        desc: '이벤트 발생률 30% 증가',
        value: 0.3,
    })) {
        errors.add('WANDERER_CHARM_POLICY_MISMATCH');
    }

    const candidateMap = {
        id: 'ancient_map', effect: 'event_chance', val: numericValue(ancientMap),
    };
    const candidateCharm = {
        id: 'wanderer_charm', effect: 'event_chance', val: numericValue(wandererCharm),
    };
    const legacyMap = { id: 'ancient_map', effect: 'event_chance', val: 0.6 };
    const candidateBothOrders: [number, number] = [
        getAdditiveNumericRelicValue([candidateMap, candidateCharm], 'event_chance'),
        getAdditiveNumericRelicValue([candidateCharm, candidateMap], 'event_chance'),
    ];
    const legacyBothOrders: [number, number] = [
        getAdditiveNumericRelicValue([legacyMap, candidateCharm], 'event_chance'),
        getAdditiveNumericRelicValue([candidateCharm, legacyMap], 'event_chance'),
    ];
    if (candidateBothOrders[0] !== 0.45 || candidateBothOrders[1] !== 0.45) {
        errors.add('CANDIDATE_STACKING_POLICY_MISMATCH');
    }
    if (legacyBothOrders[0] !== 0.9 || legacyBothOrders[1] !== 0.9) {
        errors.add('LEGACY_STACKING_POLICY_MISMATCH');
    }

    const optionalRollIndex = exploreActionsSource.indexOf('await runExplorePostDecisionRoll(');
    const mandatoryStoryIndex = exploreActionsSource.indexOf('getChainEventForLoc(player.loc');
    const bossChallengeIndex = exploreActionsSource.indexOf('if (isAreaBossUndefeated(');
    const mandatoryStoryBeforeOptionalRoll = mandatoryStoryIndex >= 0
        && optionalRollIndex >= 0
        && mandatoryStoryIndex < optionalRollIndex;
    const bossChallengeBeforeOptionalRoll = bossChallengeIndex >= 0
        && optionalRollIndex >= 0
        && bossChallengeIndex < optionalRollIndex;
    if (!mandatoryStoryBeforeOptionalRoll) errors.add('MANDATORY_STORY_PRIORITY_MISMATCH');
    if (!bossChallengeBeforeOptionalRoll) errors.add('BOSS_CHALLENGE_PRIORITY_MISMATCH');

    const rhythm = {
        none: compareEventChanceBonusRhythm(seeds, 0, 0),
        mapOnly: compareEventChanceBonusRhythm(seeds, 0.6, 0.15),
        charm: compareEventChanceBonusRhythm(seeds, 0.3, 0.3),
        stacked: compareEventChanceBonusRhythm(seeds, 0.9, 0.45),
    };
    if (JSON.stringify(rhythm.none.predecessor) !== JSON.stringify(rhythm.none.candidate)
        || JSON.stringify(rhythm.charm.predecessor) !== JSON.stringify(rhythm.charm.candidate)) {
        errors.add('UNCHANGED_COHORT_RHYTHM_MISMATCH');
    }
    if (!rhythm.mapOnly.gates.generalNarrativeReduced
        || !rhythm.stacked.gates.generalNarrativeReduced) {
        errors.add('EVENT_CHANCE_DIRECTION_MISMATCH');
    }
    if (!(rhythm.mapOnly.candidate.generalNarrative < rhythm.charm.candidate.generalNarrative
        && rhythm.charm.candidate.generalNarrative < rhythm.stacked.candidate.generalNarrative)) {
        errors.add('CANDIDATE_RARITY_RHYTHM_MISMATCH');
    }
    if (Object.values(rhythm).some((comparison) => (
        !comparison.gates.expLootInvariant
        || !comparison.gates.globalProgressionProfileInvariant
        || !comparison.gates.mandatoryStoryInvariant
        || !comparison.gates.bossChallengeInvariant
    ))) {
        errors.add('CONTROLLED_RHYTHM_INVARIANT_MISMATCH');
    }

    const report: RelicEventChanceReport = {
        schemaVersion: 1,
        classification: 'controlled-relic-event-chance',
        actualPlayClaim: false,
        policy: {
            stacking: 'additive',
            ancientMapCandidate: numericValue(ancientMap),
            wandererCharm: numericValue(wandererCharm),
            candidateBothOrders,
            legacyAncientMap: 0.6,
            legacyBothOrders,
            activeRunSnapshot: 'preserved',
        },
        rhythm,
        runtimePriority: {
            mandatoryStoryBeforeOptionalRoll,
            bossChallengeBeforeOptionalRoll,
        },
        errors: [...errors],
    };
    return canonicalizeRelicEventChanceReport(report);
};
