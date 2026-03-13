import { BALANCE } from '../data/constants.js';

export const DEFAULT_EXPLORE_STATE = Object.freeze({
    sinceNarrativeEvent: 0,
    sinceDiscovery: 0,
    sinceRelic: 0,
    quietStreak: 0,
    lastOutcome: 'start',
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getExploreState = (stats = {}) => {
    const raw = stats?.exploreState || {};
    return {
        sinceNarrativeEvent: Math.max(0, raw.sinceNarrativeEvent || 0),
        sinceDiscovery: Math.max(0, raw.sinceDiscovery || 0),
        sinceRelic: Math.max(0, raw.sinceRelic || 0),
        quietStreak: Math.max(0, raw.quietStreak || 0),
        lastOutcome: raw.lastOutcome || DEFAULT_EXPLORE_STATE.lastOutcome,
    };
};

export const getNarrativeEventChance = (baseChance = 0, bonusMultiplier = 0, stats = {}) => {
    const exploreState = getExploreState(stats);
    const base = Math.min(
        BALANCE.SPECIAL_EVENT_MAX_CHANCE,
        (baseChance || 0) * BALANCE.SPECIAL_EVENT_BASE_MULT * (1 + bonusMultiplier)
    );
    const pitySteps = Math.max(0, exploreState.sinceNarrativeEvent - 2);
    const pity = pitySteps * BALANCE.SPECIAL_EVENT_PITY_PER_EXPLORE;
    return clamp(base + pity, 0, BALANCE.SPECIAL_EVENT_MAX_CHANCE);
};

export const getQuietExplorationChance = (stats = {}) => {
    const exploreState = getExploreState(stats);
    const reduction = exploreState.quietStreak * BALANCE.QUIET_STREAK_NOTHING_REDUCTION;
    return clamp(
        BALANCE.EVENT_CHANCE_NOTHING - reduction,
        BALANCE.MIN_NOTHING_CHANCE,
        BALANCE.EVENT_CHANCE_NOTHING
    );
};

export const getDiscoveryOdds = (player, mapData) => {
    const exploreState = getExploreState(player?.stats);
    const pitySinceDiscovery = Math.max(0, exploreState.sinceDiscovery - 2);
    const pitySinceRelic = Math.max(0, exploreState.sinceRelic - 2);

    return {
        keyEventChance: clamp(
            0.2 + Math.max(0, exploreState.sinceDiscovery - 3) * BALANCE.KEY_EVENT_PITY_PER_EXPLORE,
            0,
            BALANCE.KEY_EVENT_MAX_CHANCE
        ),
        anomalyChance: clamp(
            BALANCE.ANOMALY_BASE_CHANCE + pitySinceDiscovery * BALANCE.ANOMALY_PITY_PER_EXPLORE,
            0,
            BALANCE.ANOMALY_MAX_CHANCE
        ),
        relicChance: clamp(
            BALANCE.RELIC_FIND_CHANCE + pitySinceRelic * BALANCE.RELIC_PITY_PER_EXPLORE,
            0,
            BALANCE.RELIC_FIND_MAX_CHANCE
        ),
        quietChance: getQuietExplorationChance(player?.stats),
        narrativeEventChance: getNarrativeEventChance(mapData?.eventChance || 0, 0, player?.stats),
    };
};

export const advanceExploreState = (stats = {}, outcome = 'combat') => {
    const current = getExploreState(stats);
    const next = { ...current, lastOutcome: outcome };

    switch (outcome) {
        case 'narrative_event':
            next.sinceNarrativeEvent = 0;
            next.sinceDiscovery = 0;
            next.sinceRelic = current.sinceRelic + 1;
            next.quietStreak = 0;
            break;
        case 'relic_found':
            next.sinceNarrativeEvent = current.sinceNarrativeEvent + 1;
            next.sinceDiscovery = 0;
            next.sinceRelic = 0;
            next.quietStreak = 0;
            break;
        case 'anomaly':
        case 'key_event':
            next.sinceNarrativeEvent = current.sinceNarrativeEvent + 1;
            next.sinceDiscovery = 0;
            next.sinceRelic = current.sinceRelic + 1;
            next.quietStreak = 0;
            break;
        case 'nothing':
            next.sinceNarrativeEvent = current.sinceNarrativeEvent + 1;
            next.sinceDiscovery = current.sinceDiscovery + 1;
            next.sinceRelic = current.sinceRelic + 1;
            next.quietStreak = current.quietStreak + 1;
            break;
        case 'combat':
        default:
            next.sinceNarrativeEvent = current.sinceNarrativeEvent + 1;
            next.sinceDiscovery = current.sinceDiscovery + 1;
            next.sinceRelic = current.sinceRelic + 1;
            next.quietStreak = 0;
            break;
    }

    return next;
};
