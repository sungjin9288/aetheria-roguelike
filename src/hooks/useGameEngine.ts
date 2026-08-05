import { useReducer, useMemo, useCallback, useEffect, useRef } from 'react';
import { ADMIN_UIDS } from '../data/constants';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { GS } from '../reducers/gameStates';
import { calculateFullStats } from '../utils/statsCalculator';
import { getRunBuildProfile } from '../utils/runProfileUtils';
import { acknowledgeMilestoneStoryBeat } from '../utils/milestoneStory';

import { useFirebaseSync } from './useFirebaseSync';
import { createGameActions } from './useGameActions';
import { createCombatActions } from './useCombatActions';
import { createInventoryActions } from './useInventoryActions';

export const useGameEngine = () => {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
    const combatPendingRef = useRef<any>(null);
    const combatItemLocksRef = useRef<Set<string>>(new Set());
    const clearPendingCombat = useCallback(() => {
        if (combatPendingRef.current) clearTimeout(combatPendingRef.current);
        combatPendingRef.current = null;
    }, []);
    const schedulePendingCombat = useCallback((callback: () => void, delay: number) => {
        combatPendingRef.current = setTimeout(() => {
            combatPendingRef.current = null;
            callback();
        }, delay);
    }, []);
    const claimCombatItem = useCallback((itemId: string) => {
        if (combatItemLocksRef.current.has(itemId)) return false;
        combatItemLocksRef.current.add(itemId);
        return true;
    }, []);
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
        expeditionDebriefOpen,
        questClaimReceipt,
        economyReceipt,
    } = state;

    // --- Firebase Sync ---
    useFirebaseSync(state, dispatch);

    useEffect(() => {
        combatItemLocksRef.current.clear();
    }, [player.inv, gameState, enemy]);

    useEffect(() => () => clearPendingCombat(), [clearPendingCombat]);

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

    const narratedQuestClaimRef = useRef<string | null>(null);
    useEffect(() => {
        if (!questClaimReceipt || narratedQuestClaimRef.current === questClaimReceipt.key) return;
        narratedQuestClaimRef.current = questClaimReceipt.key;
        void addStoryLog('questComplete', { questTitle: questClaimReceipt.title });
    }, [addStoryLog, questClaimReceipt]);

    // --- Compose Actions from Extracted Hooks ---
    const actions = useMemo(
        () => {
            const deps = {
                player,
                gameState,
                uid,
                grave,
                currentEvent,
                isAiThinking,
                enemy,
                liveConfig,
                dispatch,
                addLog,
                addStoryLog,
                getFullStats,
            };
            const gameActions = createGameActions(deps);
            const combatActions = createCombatActions({
                ...deps,
                clearPendingCombat,
                schedulePendingCombat,
                claimCombatItem,
            });
            const inventoryActions = createInventoryActions(deps);

            return {
                ...gameActions,
                ...combatActions,
                ...inventoryActions,

                // UI State setters
                setSideTab: (val: any) => dispatch({ type: AT.SET_SIDE_TAB, payload: val }),
                setGameState: (val: any) => dispatch({ type: AT.SET_GAME_STATE, payload: val }),
                setShopItems: (val: any) => dispatch({ type: AT.SET_SHOP_ITEMS, payload: val }),
                acknowledgeMilestoneStoryBeat: (id: any) => dispatch({
                    type: AT.SET_PLAYER,
                    payload: (currentPlayer: any) => acknowledgeMilestoneStoryBeat(currentPlayer, id),
                }),
                openExpeditionDebrief: () => dispatch({ type: AT.SET_EXPEDITION_DEBRIEF_OPEN, payload: true }),
                closeExpeditionDebrief: () => {
                    const summaryId = player.lastExpeditionSummary?.id;
                    if (summaryId) {
                        dispatch({
                            type: AT.SET_PLAYER,
                            payload: (currentPlayer: any) => currentPlayer.lastExpeditionSummary?.id === summaryId
                                ? {
                                    lastExpeditionSummary: {
                                        ...currentPlayer.lastExpeditionSummary,
                                        reviewedAt: currentPlayer.lastExpeditionSummary.reviewedAt || Date.now(),
                                    },
                                }
                                : {},
                        });
                    }
                    dispatch({ type: AT.SET_EXPEDITION_DEBRIEF_OPEN, payload: false });
                },
                // cycle 406: setAiThinking 제거 — actions.setAiThinking 호출 0건이라 dead.
                //   AT.SET_AI_THINKING reducer handler는 보존 (다른 dispatch path 의존).
                setActiveTitle: (val: any) => dispatch({ type: AT.SET_PLAYER, payload: { activeTitle: val } }),
                setReadabilityMode: (val: any) => dispatch({
                    type: AT.SET_PLAYER,
                    payload: (currentPlayer: any) => ({
                        settings: {
                            ...(currentPlayer.settings || {}),
                            readabilityMode: val === 'high' ? 'high' : 'standard',
                        },
                    }),
                }),
                setEquipmentDetailMode: (val: any) => dispatch({
                    type: AT.SET_PLAYER,
                    payload: (currentPlayer: any) => ({
                        settings: {
                            ...(currentPlayer.settings || {}),
                            equipmentDetailMode: ['summary', 'full'].includes(val) ? val : 'auto',
                        },
                    }),
                }),
                dismissEvent: () => {
                    dispatch({ type: AT.SET_EVENT, payload: null });
                    dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                },

                // Feature Actions
                setQuickSlot: (index: any, item: any) => dispatch({ type: AT.SET_QUICK_SLOT, payload: { index, item } }),
                clearPostCombat: () => dispatch({ type: AT.SET_POST_COMBAT_RESULT, payload: null }),
                clearEconomyReceipt: () => dispatch({ type: AT.CLEAR_ECONOMY_RECEIPT }),
                economyReceipt,

                getUid: () => uid,
                isAdmin: () => ADMIN_UIDS.includes(uid ?? ''),
                liveConfig,
                leaderboard,
                getFullStats,
                dispatch,
            };
        },
        [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard, economyReceipt, clearPendingCombat, schedulePendingCombat, claimCombatItem]
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
        expeditionDebriefOpen,
        dispatch,
        addLog,
    };
};
