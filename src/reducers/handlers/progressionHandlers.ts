/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */
import type { GameState, GameAction } from '../gameReducer';

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE: any) => ({
    RESET_GAME: (state: GameState) => ({
        ...INITIAL_STATE,
        grave: state.grave,
        bootStage: 'ready',
        uid: state.uid,
        syncStatus: 'syncing'
    }),

    SET_RUN_SUMMARY: (state: GameState, action: GameAction) =>
        ({ ...state, runSummary: action.payload }),

    TRIGGER_TRUE_ENDING: (state: GameState) =>
        ({ ...state, gameState: 'true_ending', syncStatus: 'syncing' }),

    UPDATE_EVENT_CHAIN: (state: GameState, action: GameAction) => {
        const { chainId, step } = action.payload;
        return {
            ...state,
            player: {
                ...state.player,
                eventChainProgress: {
                    ...(state.player.eventChainProgress || {}),
                    [chainId]: step,
                }
            }
        };
    },

    SET_PENDING_RELICS: (state: GameState, action: GameAction) =>
        ({ ...state, pendingRelics: action.payload }),

    ADD_RELIC: (state: GameState, action: GameAction) => {
        const relic = action.payload;
        return {
            ...state,
            pendingRelics: null,
            player: {
                ...state.player,
                relics: [...(state.player.relics || []), relic],
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            },
            syncStatus: 'syncing',
        };
    },

    DECLINE_RELIC: (state: GameState) =>
        ({ ...state, pendingRelics: null }),

    ASCEND: (state: GameState, action: GameAction) => {
        const { meta, newTitle } = action.payload;
        const prevTitles = state.player.titles || [];
        const prevStats: any = state.player.stats || {};
        const initialStats: any = INITIAL_STATE.player.stats || {};
        const freshPlayer: Record<string, any> = {
            ...INITIAL_STATE.player,
            name: state.player.name,
            gender: state.player.gender,
            meta,
            titles: [...new Set([...prevTitles, newTitle])],
            activeTitle: newTitle,
            stats: {
                ...initialStats,
                kills: prevStats.kills,
                bossKills: prevStats.bossKills,
                deaths: prevStats.deaths,
                total_gold: prevStats.total_gold,
                relicCount: prevStats.relicCount,
                abyssFloor: prevStats.abyssFloor,
                // cycle 119: abyssRecord(best-ever 심연), escapes(cycle 74), syntheses(cycle 82),
                // maxKillStreak(cycle 95 max-ever 시맨틱), visitedMaps(cycle 83 cartographer
                // 정합), discoveryChains(cycle 102 ach_chain_*) — 환생 후 진행도 회귀를
                //막기 위해 명시 보존. 모두 multi-run achievement / title 데이터 소스.
                abyssRecord: prevStats.abyssRecord,
                escapes: prevStats.escapes,
                syntheses: prevStats.syntheses,
                maxKillStreak: prevStats.maxKillStreak,
                visitedMaps: Array.isArray(prevStats.visitedMaps) ? prevStats.visitedMaps : initialStats.visitedMaps,
                discoveryChains: Array.isArray(prevStats.discoveryChains) ? prevStats.discoveryChains : [],
                demonKingSlain: (prevStats.demonKingSlain || 0) + 1,
                bountiesCompleted: prevStats.bountiesCompleted,
                crafts: prevStats.crafts,
                codex: prevStats.codex || initialStats.codex,
                codexClaimed: prevStats.codexClaimed || [],
                // cycle 188: cosmeticTitles는 premium 구매로 획득한 영구 자산 — 환생 후에도
                //   PremiumShop의 'owned' 체크가 정상 동작하도록 보존. 미보존 시 player.titles에는
                //   남지만 ownership 추적이 풀려 동일 칭호 중복 구매 가능 회귀.
                cosmeticTitles: Array.isArray(prevStats.cosmeticTitles) ? prevStats.cosmeticTitles : [],
                // cycle 188: synthProtects(합성 보호권 잔여 토큰) — premium 구매로 획득한 영구 자산.
                //   미보존 시 환생 후 보유 토큰 0으로 리셋되어 premium 구매가 손실.
                synthProtects: prevStats.synthProtects || 0,
                // cycle 202: claimedAchievements 영구 ledger 보존 — cycle 188 패턴 확장.
                //   기존엔 ASCEND 시 [] 으로 리셋되었으나 kills/bossKills 등 영구 카운터는 보존되므로
                //   isAchievementUnlocked가 여전히 true → claimAchievement는 'claimed.includes()'만
                //   가드해 ASCEND마다 모든 업적 재청구 가능 exploit. 영구 청구 ledger로 잠금.
                claimedAchievements: Array.isArray(prevStats.claimedAchievements) ? prevStats.claimedAchievements : [],
                // cycle 203: cycle 119 누락분 4 영구 카운터 보존 — multi-run achievement / title /
                //   codex 데이터 소스. 기존엔 ASCEND 시 0 / {} 리셋되어 progress 회귀.
                //   · explores — 6+ quest target / 1 achievement / 2 title('방랑자' val 100, '길잡이' val 500).
                //   · rests — title '안락함의 추구자'(rests 50 cond) source.
                //   · killRegistry — Bestiary / MonsterCodex / atk_per_kill_kind 시너지 source.
                //   · buildWins — questProgress.ts:51 quest 조건. build kind win counter.
                explores: prevStats.explores || 0,
                rests: prevStats.rests || 0,
                killRegistry: (prevStats.killRegistry && typeof prevStats.killRegistry === 'object')
                    ? prevStats.killRegistry
                    : {},
                buildWins: (prevStats.buildWins && typeof prevStats.buildWins === 'object')
                    ? prevStats.buildWins
                    : {},
            },
            premiumCurrency: state.player.premiumCurrency || 0,
            seasonPass: state.player.seasonPass || INITIAL_STATE.player.seasonPass,
            // cycle 188: 프리미엄 구매 자산 보존 — 환생해도 잔여 토큰/확장 슬롯 유지.
            reviveTokens: (state.player as any).reviveTokens || 0,
            maxInv: (state.player as any).maxInv || undefined,
        };
        return {
            ...INITIAL_STATE,
            uid: state.uid,
            bootStage: 'ready',
            player: freshPlayer,
            syncStatus: 'syncing',
        };
    },

    UNLOCK_TITLES: (state: GameState, action: GameAction) => {
        const newIds = action.payload;
        if (!newIds || newIds.length === 0) return state;
        const merged = [...new Set([...(state.player.titles || []), ...newIds])];
        return {
            ...state,
            player: {
                ...state.player,
                titles: merged,
                activeTitle: state.player.activeTitle || newIds[0],
            },
            syncStatus: 'syncing',
        };
    },
});
