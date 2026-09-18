import { sanitizeQuickSlots } from './helpers';
import type { GameState, HandlerMap } from '../gameReducer';
import type { LoadDataPayload } from '../actionTypes';
import type { Player } from '../../types';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { clearAdventureRelicBonuses, endDevourBonus } from '../../utils/adventureRelicBonuses';
import { normalizeAdventureRelicBonuses } from '../../utils/adventureRelicState';
import { normalizeDeferredEventChainSteps } from '../../data/eventChains';

const getBootstrapLogs = (state: GameState, playerName: string) => {
    if (state.logs.length > 0 || !playerName.trim()) return state.logs;
    return [{ id: 'bootstrap-restore', type: 'system', text: MSG.SYNC_SAVE_RESTORED }];
};

/**
 * `lastActive`는 Firestore Timestamp(`toMillis()`) 또는 이미 ms로 정규화된 숫자다.
 * 분기는 기존 인라인 삼항과 같다 — Timestamp면 toMillis(), 아니면 숫자(0/누락은 now).
 */
const resolveLastActiveMillis = (lastActive: LoadDataPayload['lastActive']): number => {
    if (lastActive && typeof lastActive === 'object' && lastActive.toMillis) return lastActive.toMillis();
    return (typeof lastActive === 'number' ? lastActive : 0) || Date.now();
};

export const bootstrapActionMap = {
    SET_BOOT_STAGE: (state, action) =>
        ({ ...state, bootStage: action.payload }),

    SET_UID: (state, action) =>
        ({ ...state, uid: action.payload }),

    LOAD_DATA: (state, action) => {
        let loadedPlayer: Player = { ...state.player, ...action.payload.player,
            deferredEventChainSteps: normalizeDeferredEventChainSteps(
                action.payload.player?.deferredEventChainSteps, action.payload.player?.eventChainProgress,
            ),
            adventureRelicBonuses: normalizeAdventureRelicBonuses(
                action.payload.player?.adventureRelicBonuses, action.payload.player?.maxHp,
            ) };
        const enemy = action.payload.enemy || null;
        const requestedMode = action.payload.gameState || 'idle';
        const gameState = requestedMode === 'combat' && !enemy ? 'idle' : requestedMode;
        if (DB.MAPS[loadedPlayer.loc ?? '']?.type === 'safe' || gameState === 'dead') {
            loadedPlayer = clearAdventureRelicBonuses(loadedPlayer);
            loadedPlayer.deferredEventChainSteps = undefined;
        } else if (gameState !== 'combat') {
            loadedPlayer = endDevourBonus(loadedPlayer);
        }
        return {
            ...state,
            player: loadedPlayer,
            gameState,
            enemy,
            grave: action.payload.grave || null,
            currentEvent: action.payload.currentEvent || null,
            quickSlots: sanitizeQuickSlots(action.payload.quickSlots, loadedPlayer.inv),
            logs: getBootstrapLogs(state, loadedPlayer.name ?? ''),
            bootStage: 'ready',
            presentationEpoch: state.presentationEpoch + 1,
            syncStatus: 'synced',
            lastLoadedTimestamp: resolveLastActiveMillis(action.payload.lastActive),
        };
    },

    SET_LIVE_CONFIG: (state, action) =>
        ({ ...state, liveConfig: { ...state.liveConfig, ...action.payload } }),

    SET_LEADERBOARD: (state, action) =>
        ({ ...state, leaderboard: action.payload }),
} satisfies HandlerMap;
