import { useEffect, useReducer, useMemo, useCallback } from 'react';
import { CONSTANTS, ADMIN_UIDS } from '../data/constants';
import { DB } from '../data/db';
import { soundManager } from '../systems/SoundManager';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE } from '../reducers/gameReducer';

import { useFirebaseSync } from './useFirebaseSync';
import { createGameActions } from './useGameActions';
import { createCombatActions } from './useCombatActions';
import { createInventoryActions } from './useInventoryActions';

export const useGameEngine = () => {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
    const {
        player,
        gameState,
        logs,
        enemy,
        grave,
        shopItems,
        isAiThinking,
        currentEvent,
        visualEffect,
        syncStatus,
        uid,
        bootStage,
        liveConfig,
        leaderboard,
        sideTab
    } = state;

    // --- Firebase Sync ---
    useFirebaseSync(state, dispatch);

    // --- Sound Integration ---
    useEffect(() => {
        const lastLog = logs[logs.length - 1];
        if (lastLog) {
            if (lastLog.type === 'combat') soundManager.play('attack');
            if (lastLog.type === 'levelUp') soundManager.play('levelUp');
            if (lastLog.type === 'error') soundManager.play('error');
            if (lastLog.type === 'item') soundManager.play('item');
        }
    }, [logs]);

    // --- Shared Helpers ---
    const addLog = useCallback(
        (type, text) => dispatch({ type: 'ADD_LOG', payload: { type, text, id: `${Date.now()}_${Math.random()}` } }),
        []
    );

    const addStoryLog = useCallback(
        async (type, data) => {
            dispatch({ type: 'SET_AI_THINKING', payload: true });
            const tempId = Date.now();
            dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });

            const narrative = await AI_SERVICE.generateStory(type, { ...data, history: player.history }, uid);

            dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text: narrative } } });
            dispatch({ type: 'SET_AI_THINKING', payload: false });
        },
        [player.history, uid]
    );

    const getFullStats = useCallback(() => {
        const cls = DB.CLASSES[player.job] || DB.CLASSES['모험가'];
        const wVal = player.equip.weapon?.val || 0;
        const aVal = player.equip.armor?.val || 0;
        const oVal = player.equip.offhand?.val || 0;
        const buff = player.tempBuff || {};
        const meta = player.meta || {};

        const isMagic =
            ['마법사', '아크메이지', '흑마법사', '성직자'].includes(player.job) ||
            (player.equip.weapon?.elem && !['물리', 'physical'].includes(player.equip.weapon.elem));

        return {
            atk: Math.floor((player.atk + wVal + (meta.bonusAtk || 0)) * cls.atkMod * (1 + (buff.atk || 0))),
            def: Math.floor((player.def + aVal + oVal) * (1 + (buff.def || 0))),
            elem: player.equip.weapon?.elem || '물리',
            isMagic,
            weaponHands: player.equip.weapon?.hands || 1
        };
    }, [player]);

    // --- Compose Actions from Extracted Hooks ---
    const actions = useMemo(
        () => {
            const deps = { player, gameState, uid, grave, currentEvent, isAiThinking, enemy, dispatch, addLog, addStoryLog, getFullStats };
            const gameActions = createGameActions(deps);
            const combatActions = createCombatActions(deps);
            const inventoryActions = createInventoryActions(deps);

            return {
                ...gameActions,
                ...combatActions,
                ...inventoryActions,

                // UI State setters
                setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
                setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
                setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }),
                setAiThinking: (val) => dispatch({ type: 'SET_AI_THINKING', payload: val }),
                getUid: () => uid,
                isAdmin: () => ADMIN_UIDS.includes(uid),
                liveConfig,
                leaderboard
            };
        },
        [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard]
    );

    const handleCommand = (text) => {
        const result = parseCommand(text, gameState, player, actions);
        if (typeof result === 'string') addLog('system', result);
    };

    return {
        player,
        gameState,
        logs,
        enemy,
        actions,
        getFullStats,
        sideTab,
        grave,
        shopItems,
        isAiThinking,
        currentEvent,
        visualEffect,
        syncStatus,
        leaderboard,
        liveConfig,
        bootStage,
        handleCommand
    };
};
