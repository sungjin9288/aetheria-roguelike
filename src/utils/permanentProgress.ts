import type { Player } from '../types/player';
import { normalizeClassJourneyLedger } from './classJourney';
import { normalizeReturnSupplyRewardLedger } from './returnSupplyReward';

const clone = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([key, entry]) => [key, clone(entry)]),
        ) as T;
    }
    return value;
};

const numberOrZero = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

export const pickPermanentPlayerState = (
    player: Player,
    initialPlayer: Player,
): Partial<Player> => {
    const stats = player.stats || {};
    const initialStats = initialPlayer.stats || {};
    return {
        meta: clone({ ...(initialPlayer.meta || {}), ...(player.meta || {}) }),
        achievements: clone(Array.isArray(player.achievements) ? player.achievements : []),
        titles: clone(Array.isArray(player.titles) ? player.titles : []),
        activeTitle: player.activeTitle || null,
        premiumCurrency: Math.max(0, numberOrZero(player.premiumCurrency)),
        reviveTokens: Math.max(0, numberOrZero(player.reviveTokens)),
        ...(player.maxInv !== undefined
            ? { maxInv: Math.max(20, numberOrZero(player.maxInv) || 20) }
            : {}),
        seasonPass: clone(player.seasonPass || initialPlayer.seasonPass),
        weeklyProtocol: clone(player.weeklyProtocol || initialPlayer.weeklyProtocol),
        settings: clone(player.settings || initialPlayer.settings),
        classJourney: normalizeClassJourneyLedger(player.classJourney),
        expeditionSequence: Number.isSafeInteger(player.expeditionSequence)
            ? player.expeditionSequence
            : 0,
        returnSupplyRewards: normalizeReturnSupplyRewardLedger(player.returnSupplyRewards),
        stats: {
            ...clone(initialStats),
            kills: numberOrZero(stats.kills),
            bossKills: numberOrZero(stats.bossKills),
            deaths: numberOrZero(stats.deaths),
            total_gold: numberOrZero(stats.total_gold),
            relicCount: numberOrZero(stats.relicCount),
            abyssFloor: numberOrZero(stats.abyssFloor),
            abyssRecord: numberOrZero(stats.abyssRecord),
            escapes: numberOrZero(stats.escapes),
            syntheses: numberOrZero(stats.syntheses),
            maxKillStreak: numberOrZero(stats.maxKillStreak),
            explores: numberOrZero(stats.explores),
            exploresByLocation: clone(
                stats.exploresByLocation && typeof stats.exploresByLocation === 'object'
                    ? stats.exploresByLocation
                    : {},
            ),
            rests: numberOrZero(stats.rests),
            crafts: numberOrZero(stats.crafts),
            bountiesCompleted: numberOrZero(stats.bountiesCompleted),
            demonKingSlain: numberOrZero(stats.demonKingSlain),
            visitedMaps: clone(Array.isArray(stats.visitedMaps) ? stats.visitedMaps : initialStats.visitedMaps),
            discoveryChains: clone(Array.isArray(stats.discoveryChains) ? stats.discoveryChains : []),
            killRegistry: clone(
                stats.killRegistry && typeof stats.killRegistry === 'object'
                    ? stats.killRegistry
                    : {},
            ),
            buildWins: clone(
                stats.buildWins && typeof stats.buildWins === 'object'
                    ? stats.buildWins
                    : {},
            ),
            codex: clone(stats.codex || initialStats.codex),
            codexClaimed: clone(Array.isArray(stats.codexClaimed) ? stats.codexClaimed : []),
            cosmeticTitles: clone(Array.isArray(stats.cosmeticTitles) ? stats.cosmeticTitles : []),
            synthProtects: numberOrZero(stats.synthProtects),
            claimedAchievements: clone(
                Array.isArray(stats.claimedAchievements) ? stats.claimedAchievements : [],
            ),
            claimedQuestIds: clone(Array.isArray(stats.claimedQuestIds) ? stats.claimedQuestIds : []),
            codexBonusAtk: numberOrZero(stats.codexBonusAtk),
            codexBonusDef: numberOrZero(stats.codexBonusDef),
            codexBonusHp: numberOrZero(stats.codexBonusHp),
            signaturePity: numberOrZero(stats.signaturePity),
            bountyDate: stats.bountyDate ?? null,
            bountyIssued: Boolean(stats.bountyIssued),
            dailyProtocol: clone(stats.dailyProtocol ?? null),
            dailyInvadeCount: numberOrZero(stats.dailyInvadeCount),
            lastInvadeDate: stats.lastInvadeDate ?? null,
            abyssDailyDive: clone(stats.abyssDailyDive ?? null),
            lastSeenAt: stats.lastSeenAt ?? null,
        },
    };
};
