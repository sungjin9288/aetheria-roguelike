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
                demonKingSlain: (prevStats.demonKingSlain || 0) + 1,
                bountiesCompleted: prevStats.bountiesCompleted,
                crafts: prevStats.crafts,
                codex: prevStats.codex || initialStats.codex,
                codexClaimed: prevStats.codexClaimed || [],
            },
            premiumCurrency: state.player.premiumCurrency || 0,
            seasonPass: state.player.seasonPass || INITIAL_STATE.player.seasonPass,
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
