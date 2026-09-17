import { sanitizeQuickSlots } from './helpers';
import type { GameState, GameAction } from '../gameReducer';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { clearAdventureRelicBonuses, endDevourBonus } from '../../utils/adventureRelicBonuses';
import { normalizeAdventureRelicBonuses } from '../../utils/adventureRelicState';
import { normalizeDeferredEventChainSteps } from '../../data/eventChains';

const getBootstrapLogs = (state: GameState, playerName: string) => {
    if (state.logs.length > 0 || !playerName.trim()) return state.logs;
    return [{ id: 'bootstrap-restore', type: 'system', text: MSG.SYNC_SAVE_RESTORED }];
};

export const bootstrapActionMap = {
    SET_BOOT_STAGE: (state: GameState, action: GameAction) =>
        ({ ...state, bootStage: action.payload }),

    SET_UID: (state: GameState, action: GameAction) =>
        ({ ...state, uid: action.payload }),

    LOAD_DATA: (state: GameState, action: GameAction) => {
        let loadedPlayer = { ...state.player, ...action.payload.player,
            deferredEventChainSteps: normalizeDeferredEventChainSteps(
                action.payload.player?.deferredEventChainSteps, action.payload.player?.eventChainProgress,
            ),
            adventureRelicBonuses: normalizeAdventureRelicBonuses(
                action.payload.player?.adventureRelicBonuses, action.payload.player?.maxHp,
            ) };
        const enemy = action.payload.enemy || null;
        const requestedMode = action.payload.gameState || 'idle';
        const gameState = requestedMode === 'combat' && !enemy ? 'idle' : requestedMode;
        if (DB.MAPS[loadedPlayer.loc]?.type === 'safe' || gameState === 'dead') {
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
            logs: getBootstrapLogs(state, loadedPlayer.name),
            bootStage: 'ready',
            presentationEpoch: state.presentationEpoch + 1,
            syncStatus: 'synced',
            lastLoadedTimestamp: action.payload.lastActive?.toMillis
                ? action.payload.lastActive.toMillis()
                : (action.payload.lastActive || Date.now())
        };
    },

    SET_LIVE_CONFIG: (state: GameState, action: GameAction) =>
        ({ ...state, liveConfig: { ...state.liveConfig, ...action.payload } }),

    SET_LEADERBOARD: (state: GameState, action: GameAction) =>
        ({ ...state, leaderboard: action.payload }),
};
