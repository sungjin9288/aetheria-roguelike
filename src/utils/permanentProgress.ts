import type { EventChainProgress, EventChainProgressValue, Player } from '../types/player';
import { EVENT_CHAINS } from '../data/eventChains';
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

/** 체인 진행 값의 실제 모양 — 스텝 번호이거나 실패 마커다(영수증 레코드는 아니다). */
const isChainStepValue = (value: EventChainProgressValue): value is number | 'failed' => (
    value === 'failed' || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
);

/**
 * 2026-09 Wave 14 F2: 이벤트 체인 진행도는 승천/사망을 넘어 이어진다 — 지식 축의
 * 나머지(`stats.discoveryChains`·`stats.visitedMaps`·`stats.codex`·`titles`)가 전부
 * 계승되는데 이것 하나만 리셋되고 있었다. 체인은 Lv10~40(2.05h~21.08h)에 열리고
 * 완주는 그보다 훨씬 깊어서, 리셋 지점(승천 Lv48 ≈ 53.28h)이 **항상 그 사이에** 있다.
 *
 * **이월 대상은 `EVENT_CHAINS`의 체인 id 키뿐이다.** 이 필드는 용도가 둘이라
 * 예약 키 `boundedEncounterReceipts`가 원정 조우 영수증 레저를 겸한다
 * (`types/player.ts` · `boundedEncounterSelector.ts`). 통째로 넘기면 그 영수증이
 * 승천을 넘어가 같은 조우의 재획득을 영구히 막는다 — 그래서 progress 쪽 키를
 * 훑는 것이 아니라 **EVENT_CHAINS를 훑어 화이트리스트로** 고른다(정의에 없는
 * 키는 구조적으로 실릴 수 없다).
 */
const pickEventChainProgress = (progress: EventChainProgress | undefined): EventChainProgress => {
    const carried: EventChainProgress = {};
    for (const chain of EVENT_CHAINS) {
        const value = progress?.[chain.id];
        if (value === undefined || !isChainStepValue(value)) continue;
        carried[chain.id] = value;
    }
    return carried;
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
        // 2026-09 Wave 12 D2: 시즌 상태는 환생/사망을 넘어 그대로 이어진다 — 시즌은
        //   런(run)이 아니라 계정 단위 사다리이기 때문이다. 회전이 생긴 뒤로는
        //   `archive`/`completedSeasons`도 같은 clone에 실려 넘어가므로, 완주 기록이
        //   승천으로 사라지지 않는다(tests/permanent-progress-copy.test.js가 고정).
        //   구세이브 호환을 위해 **여기서 정규화하지 않는다** — 없는 선택 필드는
        //   읽는 쪽이 채운다(`resolveSeasonOrdinal`).
        seasonPass: clone(player.seasonPass || initialPlayer.seasonPass),
        weeklyProtocol: clone(player.weeklyProtocol || initialPlayer.weeklyProtocol),
        settings: clone(player.settings || initialPlayer.settings),
        classJourney: normalizeClassJourneyLedger(player.classJourney),
        expeditionSequence: Number.isSafeInteger(player.expeditionSequence)
            ? player.expeditionSequence
            : 0,
        returnSupplyRewards: normalizeReturnSupplyRewardLedger(player.returnSupplyRewards),
        eventChainProgress: pickEventChainProgress(player.eventChainProgress),
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
