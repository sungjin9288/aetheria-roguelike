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

export const getMapPacingProfile = (mapData = {}) => {
    if (!mapData || mapData.type === 'safe') {
        return {
            id: 'safe',
            label: '정비',
            note: '휴식과 보급에 맞는 정비 구간입니다.',
            narrativeMult: 1,
            quietMult: 1,
            relicMult: 1,
            anomalyMult: 1,
            keyEventMult: 1,
        };
    }

    if (mapData.boss) {
        return {
            id: 'boss',
            label: '전조',
            note: '보스 교전 징후가 짙습니다. 조용함은 줄고 압박이 빨라집니다.',
            narrativeMult: 0.82,
            quietMult: 0.72,
            relicMult: 1.08,
            anomalyMult: 0.94,
            keyEventMult: 1.18,
        };
    }

    if ((mapData.eventChance || 0) >= 0.25) {
        return {
            id: 'volatile',
            label: '변칙',
            note: '이변과 징후가 잦은 지대입니다. 발견 리듬이 빠릅니다.',
            narrativeMult: 1.12,
            quietMult: 0.82,
            relicMult: 1.08,
            anomalyMult: 1.14,
            keyEventMult: 1.08,
        };
    }

    if ((mapData.level || 1) >= 25 || mapData.level === 'infinite') {
        return {
            id: 'hostile',
            label: '압박',
            note: '상위 전장이라 전투 밀도가 높고 정적 구간이 짧습니다.',
            narrativeMult: 0.92,
            quietMult: 0.84,
            relicMult: 1.12,
            anomalyMult: 0.96,
            keyEventMult: 1.05,
        };
    }

    return {
        id: 'frontier',
        label: '개척',
        note: '전투와 발견이 번갈아 오는 개척 구간입니다.',
        narrativeMult: 1.02,
        quietMult: 0.96,
        relicMult: 1.03,
        anomalyMult: 1.02,
        keyEventMult: 1.03,
    };
};

export const getNarrativeEventChance = (baseChance = 0, bonusMultiplier = 0, stats = {}, mapData = null) => {
    const exploreState = getExploreState(stats);
    const profile = getMapPacingProfile(mapData);
    const base = Math.min(
        BALANCE.SPECIAL_EVENT_MAX_CHANCE,
        (baseChance || 0) * BALANCE.SPECIAL_EVENT_BASE_MULT * profile.narrativeMult * (1 + bonusMultiplier)
    );
    const pitySteps = Math.max(0, exploreState.sinceNarrativeEvent - 2);
    const pity = pitySteps * BALANCE.SPECIAL_EVENT_PITY_PER_EXPLORE;
    return clamp(base + pity, 0, BALANCE.SPECIAL_EVENT_MAX_CHANCE);
};

export const getQuietExplorationChance = (stats = {}, mapData = null) => {
    const exploreState = getExploreState(stats);
    const profile = getMapPacingProfile(mapData);
    const reduction = exploreState.quietStreak * BALANCE.QUIET_STREAK_NOTHING_REDUCTION;
    return clamp(
        (BALANCE.EVENT_CHANCE_NOTHING * profile.quietMult) - reduction,
        BALANCE.MIN_NOTHING_CHANCE,
        BALANCE.EVENT_CHANCE_NOTHING
    );
};

export const getDiscoveryOdds = (player, mapData) => {
    const exploreState = getExploreState(player?.stats);
    const profile = getMapPacingProfile(mapData);
    const pitySinceDiscovery = Math.max(0, exploreState.sinceDiscovery - 2);
    const pitySinceRelic = Math.max(0, exploreState.sinceRelic - 2);

    return {
        keyEventChance: clamp(
            (0.2 + Math.max(0, exploreState.sinceDiscovery - 3) * BALANCE.KEY_EVENT_PITY_PER_EXPLORE) * profile.keyEventMult,
            0,
            BALANCE.KEY_EVENT_MAX_CHANCE
        ),
        anomalyChance: clamp(
            (BALANCE.ANOMALY_BASE_CHANCE + pitySinceDiscovery * BALANCE.ANOMALY_PITY_PER_EXPLORE) * profile.anomalyMult,
            0,
            BALANCE.ANOMALY_MAX_CHANCE
        ),
        relicChance: clamp(
            (BALANCE.RELIC_FIND_CHANCE + pitySinceRelic * BALANCE.RELIC_PITY_PER_EXPLORE) * profile.relicMult,
            0,
            BALANCE.RELIC_FIND_MAX_CHANCE
        ),
        quietChance: getQuietExplorationChance(player?.stats, mapData),
        narrativeEventChance: getNarrativeEventChance(mapData?.eventChance || 0, 0, player?.stats, mapData),
        pacingProfile: profile,
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
