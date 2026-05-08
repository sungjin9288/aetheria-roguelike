import { useEffect, useReducer, useMemo, useCallback } from 'react';
import { ADMIN_UIDS } from '../data/constants';
import { soundManager } from '../systems/SoundManager';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { GS } from '../reducers/gameStates';
import { calculateFullStats } from '../utils/statsCalculator';
import { getRunBuildProfile } from '../utils/runProfileUtils';

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
        sideTab,
        quickSlots,
        postCombatResult,
        pendingRelics,
        runSummary,
    } = state;

    // --- Firebase Sync ---
    useFirebaseSync(state, dispatch);

    // --- Sound Integration ---
    useEffect(() => {
        const lastLog = logs[logs.length - 1];
        if (lastLog) {
            if (lastLog.type === 'combat') soundManager.play('attack');
            // cycle 263: 'critical' 로그 타입 sensory cue — crit hit 시 'critical' 로그가
            //   'combat' 직후 push되어 lastLog가 'critical'이라 attack 사운드 dispatch 실패하던
            //   silent 회귀. 강화된 hit이 무음이라 약화된 hit처럼 들리던 회귀 fix. cycle 122/123 패턴.
            if (lastLog.type === 'critical') soundManager.play('attack');
            if (lastLog.type === 'levelUp') soundManager.play('levelUp');
            if (lastLog.type === 'error') soundManager.play('error');
            if (lastLog.type === 'item') soundManager.play('item');
            if (lastLog.type === 'legendary') soundManager.play('legendary');
        }
    }, [logs]);

    // cycle 217: 레벨업 sensory cue 누락 fix — applyExpGain은 visualEffect='levelUp'을 set하지만
    //   levelup 로그는 type:'system'이라 위 mapping이 절대 trigger 안 됨. visualEffect 변화를
    //   watch해 levelUp 사운드를 직접 dispatch. cycle 117/118/122/123 sensory cue 시리즈 합류.
    //   'shake' 등 다른 visualEffect는 false-positive 방지 위해 명시 비교.
    useEffect(() => {
        if (visualEffect === 'levelUp') {
            soundManager.play('levelUp');
        }
    }, [visualEffect]);

    // --- Shared Helpers ---
    const addLog = useCallback(
        (type: any, text: any) => dispatch({ type: AT.ADD_LOG, payload: { type, text, id: `${Date.now()}_${Math.random()}` } }),
        []
    );

    const getFullStats = useCallback(
        (targetPlayer: any = player) => calculateFullStats(targetPlayer ?? player),
        [player]
    );

    const addStoryLog = useCallback(
        async (type: any, data: any) => {
            dispatch({ type: AT.SET_AI_THINKING, payload: true });
            const tempId = Date.now();
            dispatch({ type: AT.ADD_LOG, payload: { type: 'loading', text: '...', id: tempId } });
            try {
                const fullStats = getFullStats();
                const buildProfile = getRunBuildProfile(player, fullStats);

                const narrative = await AI_SERVICE.generateStory(type, {
                    ...data,
                    history: player.history,
                    location: player.loc,
                    playerSnapshot: {
                        name: player.name,
                        job: player.job,
                        level: player.level,
                        hp: player.hp,
                        maxHp: player.maxHp,
                        mp: player.mp,
                        maxMp: player.maxMp,
                        title: player.activeTitle || null,
                        relicCount: (player.relics || []).length,
                        buildProfile: buildProfile.tags.map((tag: any) => tag.name).slice(0, 4)
                    }
                }, uid);

                dispatch({ type: AT.UPDATE_LOG, payload: { id: tempId, log: { id: tempId, type: 'story', text: narrative } } });
            } finally {
                dispatch({ type: AT.SET_AI_THINKING, payload: false });
            }
        },
        [player, uid, getFullStats]
    );

    // --- Compose Actions from Extracted Hooks ---
    const actions = useMemo(
        () => {
            const deps = { player, gameState, uid, grave, currentEvent, isAiThinking, enemy, liveConfig, dispatch, addLog, addStoryLog, getFullStats };
            const gameActions = createGameActions(deps);
            const combatActions = createCombatActions(deps);
            const inventoryActions = createInventoryActions(deps);

            return {
                ...gameActions,
                ...combatActions,
                ...inventoryActions,

                // UI State setters
                setSideTab: (val: any) => dispatch({ type: AT.SET_SIDE_TAB, payload: val }),
                setGameState: (val: any) => dispatch({ type: AT.SET_GAME_STATE, payload: val }),
                setShopItems: (val: any) => dispatch({ type: AT.SET_SHOP_ITEMS, payload: val }),
                setAiThinking: (val: any) => dispatch({ type: AT.SET_AI_THINKING, payload: val }),
                setActiveTitle: (val: any) => dispatch({ type: AT.SET_PLAYER, payload: { activeTitle: val } }),
                dismissEvent: () => {
                    dispatch({ type: AT.SET_EVENT, payload: null });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                },

                // Feature Actions
                setQuickSlot: (index: any, item: any) => dispatch({ type: AT.SET_QUICK_SLOT, payload: { index, item } }),
                clearPostCombat: () => dispatch({ type: AT.SET_POST_COMBAT_RESULT, payload: null }),

                getUid: () => uid,
                isAdmin: () => ADMIN_UIDS.includes(uid),
                liveConfig,
                leaderboard,
                getFullStats,
                dispatch,
            };
        },
        [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard]
    );

    const handleCommand = useCallback((text: any) => {
        const result = parseCommand(text, gameState, player, actions);
        if (typeof result === 'string') addLog('system', result);
    }, [gameState, player, actions, addLog]);

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
        // cycle 307: leaderboard top-level 반환 제거 — engine.leaderboard 접근 0건.
        //   SystemTab은 actions.leaderboard 경로로만 사용 (line 147 actions 객체 내).
        liveConfig,
        bootStage,
        handleCommand,
        // Feature additions
        quickSlots,
        postCombatResult,
        pendingRelics,
        runSummary,
        dispatch,
        addLog,
    };
};
