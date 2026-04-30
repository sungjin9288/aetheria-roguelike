/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE) => ({
    RESET_GAME: (state) => ({
        ...INITIAL_STATE,
        grave: state.grave,
        bootStage: 'ready',
        uid: state.uid,
        syncStatus: 'syncing'
    }),

    SET_RUN_SUMMARY: (state, action) =>
        ({ ...state, runSummary: action.payload }),

    TRIGGER_TRUE_ENDING: (state) =>
        ({ ...state, gameState: 'true_ending', syncStatus: 'syncing' }),

    UPDATE_EVENT_CHAIN: (state, action) => {
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

    SET_PENDING_RELICS: (state, action) =>
        ({ ...state, pendingRelics: action.payload }),

    ADD_RELIC: (state, action) => {
        const relic = action.payload;
        return {
            ...state,
            pendingRelics: null,
            player: {
                ...state.player,
                relics: [...(state.player.relics || []), relic],
                stats: { ...state.player.stats, relicCount: (state.player.stats.relicCount || 0) + 1 },
            },
            syncStatus: 'syncing',
        };
    },

    DECLINE_RELIC: (state) =>
        ({ ...state, pendingRelics: null }),

    ASCEND: (state, action) => {
        const { meta, newTitle } = action.payload;
        const prevTitles = state.player.titles || [];
        const freshPlayer = {
            ...INITIAL_STATE.player,
            name: state.player.name,
            gender: state.player.gender,
            meta,
            titles: [...new Set([...prevTitles, newTitle])],
            activeTitle: newTitle,
            stats: {
                ...INITIAL_STATE.player.stats,
                kills: state.player.stats.kills,
                bossKills: state.player.stats.bossKills,
                deaths: state.player.stats.deaths,
                total_gold: state.player.stats.total_gold,
                relicCount: state.player.stats.relicCount,
                abyssFloor: state.player.stats.abyssFloor,
                demonKingSlain: (state.player.stats.demonKingSlain || 0) + 1,
                bountiesCompleted: state.player.stats.bountiesCompleted,
                crafts: state.player.stats.crafts,
                codex: state.player.stats.codex || INITIAL_STATE.player.stats.codex,
                codexClaimed: state.player.stats.codexClaimed || [],
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

    UNLOCK_TITLES: (state, action) => {
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
