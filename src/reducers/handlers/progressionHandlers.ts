/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */
import type { GameState, GameAction } from '../gameReducer';
import type { AscendPayload } from '../actionTypes';
import { GS } from '../gameStates';
import { createCurrentRunProgress } from '../../utils/runProgress';
import { pickPermanentPlayerState } from '../../utils/permanentProgress';
import { getAscensionOutcome } from '../../utils/ascensionPreview';

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE: any) => ({
    // cycle 204: 사망 후 '다시 시작' 시 META 진행도 보존 — cycle 191(handleDefeat)와 정합.
    //   기존 동작은 ...INITIAL_STATE로 모든 META를 wipe해 cycle 191의 preserve를
    //   nullify(다시 시작 클릭 즉시 영구 자산 / 영구 카운터 사라짐).
    //   이제 cycle 119 / 188 / 191 / 202 / 203 보존 시리즈와 동일 패턴으로 META 명시 보존:
    //   - meta / titles / activeTitle (영구 자산)
    //   - premiumCurrency / reviveTokens / maxInv / seasonPass (premium 영구 자산)
    //   - stats: kills / bossKills / total_gold / abyssRecord / escapes / syntheses /
    //     maxKillStreak / visitedMaps / discoveryChains / explores / rests / killRegistry /
    //     buildWins / cosmeticTitles / synthProtects / claimedAchievements (multi-run 카운터/ledger)
    //   RUN 진행도(gold / inv / equip / relics / hp / mp / quests / skillLoadout)는
    //   INITIAL_STATE로 reset 유지.
    RESET_GAME: (state: GameState) => {
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player);
        const permanentStats: any = permanent.stats || {};
        return {
            ...INITIAL_STATE,
            grave: state.grave,
            bootStage: 'ready',
            uid: state.uid,
            syncStatus: 'syncing',
            player: {
                ...INITIAL_STATE.player,
                ...permanent,
                stats: {
                    ...permanentStats,
                    currentRun: createCurrentRunProgress(permanentStats),
                },
            },
        };
    },

    SET_RUN_SUMMARY: (state: GameState, action: GameAction) =>
        ({ ...state, runSummary: action.payload }),

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
        if (state.gameState !== GS.ASCENSION && state.gameState !== GS.TRUE_ENDING) return state;
        const payload = action.payload as Partial<AscendPayload> | undefined;
        const expectedPrestigeRank = Number(payload?.expectedPrestigeRank);
        if (!Number.isSafeInteger(expectedPrestigeRank) || expectedPrestigeRank < 0) return state;
        const outcome = getAscensionOutcome(state.player.meta);
        if (expectedPrestigeRank !== outcome.currentRank) return state;
        const sourceReceiptKey = payload?.sourceReceiptKey;
        if (sourceReceiptKey !== null && typeof sourceReceiptKey !== 'string') return state;
        const currentReceiptKey = state.player.meta?.endgame?.lastEndgameReceiptKey ?? null;
        if (sourceReceiptKey !== currentReceiptKey) return state;
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player);
        const permanentStats: any = permanent.stats || {};
        const prevTitles = permanent.titles || [];
        const freshPlayer: Record<string, any> = {
            ...INITIAL_STATE.player,
            ...permanent,
            name: state.player.name,
            gender: state.player.gender,
            meta: outcome.meta,
            titles: [...new Set([...prevTitles, outcome.title])],
            activeTitle: outcome.title,
            stats: {
                ...permanentStats,
                currentRun: createCurrentRunProgress(permanentStats),
            },
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
