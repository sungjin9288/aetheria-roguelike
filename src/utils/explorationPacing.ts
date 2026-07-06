import { BALANCE } from '../data/constants.js';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { getMirrorEffects } from '../systems/mirrorUpgrades';
import type { GameMap, Player } from "../types/index.js";

export const DEFAULT_EXPLORE_STATE = Object.freeze({
    sinceNarrativeEvent: 0,
    sinceDiscovery: 0,
    sinceRelic: 0,
    quietStreak: 0,
    lastOutcome: 'start',
});

const clamp = (value: any, min: any, max: any) => Math.min(max, Math.max(min, value));

// cycle 297: export 제거 — explorationPacing 내부 4회 사용만 (getNarrativeEventChance/
// getQuietExplorationChance/getDiscoveryOdds/advanceExploreState), 외부 consumer 0건.
// cycle 554: stats default {} 제거 — 4 internal callsite (line 90/103/114/
//   145) 모두 명시 전달이라 default 도달 불가. body의 stats?.exploreState
//   가드가 undefined 안전 처리. 청소 메가 시리즈 48번째 (cycle 502-553).
const getExploreState = (stats: any) => {
    const raw = stats?.exploreState || {};
    return {
        sinceNarrativeEvent: Math.max(0, raw.sinceNarrativeEvent || 0),
        sinceDiscovery: Math.max(0, raw.sinceDiscovery || 0),
        sinceRelic: Math.max(0, raw.sinceRelic || 0),
        quietStreak: Math.max(0, raw.quietStreak || 0),
        lastOutcome: raw.lastOutcome || DEFAULT_EXPLORE_STATE.lastOutcome,
    };
};

// cycle 599: mapData default {} 제거 — 4 callsite (3 internal + 1
//   exploreActions production) 모두 mapData 명시 전달이라 default 도달 불가.
//   body의 !mapData guard가 undefined/null 안전 처리. cycle 600 milestone
//   직전 마지막 cleanup.
export const getMapPacingProfile = (mapData: GameMap | null | undefined) => {
    if (!mapData || mapData.type === 'safe') {
        return {
            id: 'safe',
            label: '정비',
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
            narrativeMult: 1.12,
            quietMult: 0.82,
            relicMult: 1.08,
            anomalyMult: 1.14,
            keyEventMult: 1.08,
        };
    }

    if ((typeof mapData.level === 'number' && mapData.level >= 25) || mapData.level === 'infinite') {
        return {
            id: 'hostile',
            label: '압박',
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
        narrativeMult: 1.02,
        quietMult: 0.96,
        relicMult: 1.03,
        anomalyMult: 1.02,
        keyEventMult: 1.03,
    };
};

// cycle 507: 4 default 제거 — 2 callsite 모두 4 args 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 6번째 (cycle 502-506 lens).
export const getNarrativeEventChance = (baseChance: any, bonusMultiplier: any, stats: any, mapData: GameMap | null) => {
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

// cycle 507: 2 default 제거 — 2 callsite 모두 2 args 전달이라 default 도달 불가.
export const getQuietExplorationChance = (stats: any, mapData: GameMap | null) => {
    const exploreState = getExploreState(stats);
    const profile = getMapPacingProfile(mapData);
    const reduction = exploreState.quietStreak * BALANCE.QUIET_STREAK_NOTHING_REDUCTION;
    return clamp(
        (BALANCE.EVENT_CHANCE_NOTHING * profile.quietMult) - reduction,
        BALANCE.MIN_NOTHING_CHANCE,
        BALANCE.EVENT_CHANCE_NOTHING
    );
};

export const getDiscoveryOdds = (player: Player, mapData: GameMap | null | undefined) => {
    const exploreState = getExploreState(player?.stats);
    const profile = getMapPacingProfile(mapData);
    const pitySinceDiscovery = Math.max(0, exploreState.sinceDiscovery - 2);
    const pitySinceRelic = Math.max(0, exploreState.sinceRelic - 2);
    // feat/prestige-rank-ladder: rank≥6 "잔향의 나침반" — 유물 발견 pity 누적 가속 ×1.5.
    //   기본 확률(RELIC_FIND_CHANCE)은 불변, pity 누적분에만 곱해 신규 플레이어(rank0) 곡선 보존.
    const relicPityMult = getPrestigeUnlocks(player?.meta?.prestigeRank).relicPityMult;
    // 2026-07 — 에테르 거울: relic_pity 노드(레벨당 +25%)도 동일하게 pity 누적분에만 곱한다.
    //   rank6 배율과는 서로 다른 소스(영구환생 vs 에센스 소비)이므로 곱연산으로 겹쳐 —
    //   두 해금을 모두 가진 플레이어가 손해 보지 않도록 보장(단조 증가).
    const mirrorRelicPityMult = 1 + getMirrorEffects(player?.meta).relicPityBonus;
    const totalRelicPityMult = relicPityMult * mirrorRelicPityMult;

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
            (BALANCE.RELIC_FIND_CHANCE + pitySinceRelic * BALANCE.RELIC_PITY_PER_EXPLORE * totalRelicPityMult) * profile.relicMult,
            0,
            BALANCE.RELIC_FIND_MAX_CHANCE
        ),
        quietChance: getQuietExplorationChance(player?.stats, mapData ?? null),
        narrativeEventChance: getNarrativeEventChance(mapData?.eventChance || 0, 0, player?.stats, mapData ?? null),
        pacingProfile: profile,
    };
};

// cycle 515: stats / outcome defaults 제거 — 1 callsite (_shared.ts:53)
//   advanceExploreState(currentPlayer.stats, outcome) 항상 2 args 명시 전달이라
//   default 도달 불가. util default 청소 메가 시리즈 13번째 (cycle 502-514).
export const advanceExploreState = (stats: any, outcome: any) => {
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
