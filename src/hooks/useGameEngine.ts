import { useReducer, useMemo, useCallback, useEffect, useRef } from 'react';
import { ADMIN_UIDS } from '../data/constants';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE, type GameState } from '../reducers/gameReducer';
import { AT } from '../reducers/actionTypes';
import { GS } from '../reducers/gameStates';
import { calculateFullStats } from '../utils/statsCalculator';
import { getRunBuildProfile } from '../utils/runProfileUtils';
import { acknowledgeMilestoneStoryBeat } from '../utils/milestoneStory';

import { useFirebaseSync } from './useFirebaseSync';
import { useProductTelemetry } from './useProductTelemetry';
import { createGameActions } from './useGameActions';
import { createCombatActions } from './useCombatActions';
import { createInventoryActions } from './useInventoryActions';

export const consumeCombatReceiptStories = (
    receipt: GameState['combatReceipt'],
    consumedKey: string | null,
) => {
    if (!receipt || consumedKey === receipt.key) {
        const stories: NonNullable<GameState['combatReceipt']>['stories'] = [];
        return { consumedKey, stories };
    }
    return { consumedKey: receipt.key, stories: receipt.stories };
};

export const allocateStoryLogId = (sequence: { current: number }, now = Date.now()) =>
    `story-${now}-${++sequence.current}`;

/**
 * 내러티브 placeholder 로그 id의 단조 증가 시퀀스.
 *
 * 2026-09 N2: 예전엔 `useRef(0)`였다. addStoryLog가 그 ref를 클로저로 잡는 바람에
 * react-hooks/refs가 `actions` useMemo 안의 팩토리 호출 3건을 전부 "렌더 중 ref 접근"
 * 으로 표시했다(실제로는 호출 시점에만 읽으므로 오탐). 이 시퀀스는 오직 id 유일성만
 * 담당하고 렌더에 쓰이지 않으므로 모듈 스코프로 올린다 — 엔진은 세션당 1개
 * (GameRoot)이고, 리마운트 후에도 카운터가 이어져 유일성은 오히려 더 강해진다.
 */
const storyLogSequence = { current: 0 };

export const useGameEngine = () => {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
    useProductTelemetry(state);
    const combatPendingRef = useRef<any>(null);
    const combatItemLocksRef = useRef<Set<string>>(new Set());
    const combatActionLocksRef = useRef<Set<string>>(new Set());
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
    const claimCombatAction = useCallback((key: string) => {
        if (combatActionLocksRef.current.has(key)) return false;
        combatActionLocksRef.current.add(key);
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
        presentationEpoch,
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
        combatTurn,
        combatReceipt,
    } = state;

    // --- Firebase Sync ---
    const { flushLocalSave } = useFirebaseSync(state, dispatch);

    useEffect(() => {
        combatItemLocksRef.current.clear();
        combatActionLocksRef.current.clear();
    }, [player.inv, gameState, enemy, combatTurn]);

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
            const tempId = allocateStoryLogId(storyLogSequence);
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

    const narratedCombatReceiptRef = useRef<string | null>(null);
    useEffect(() => {
        const consumption = consumeCombatReceiptStories(
            combatReceipt,
            narratedCombatReceiptRef.current,
        );
        narratedCombatReceiptRef.current = consumption.consumedKey;
        consumption.stories.forEach((story: any) => {
            void addStoryLog(story.type, story.data);
        });
    }, [addStoryLog, combatReceipt]);

    // --- Stable action group ---
    // 2026-09 N2: player가 바뀔 때마다 새로 만들 이유가 없는 액션(순수 dispatch 래퍼)을
    //   분리한다. 아래 배열에 `player`가 들어가면 분리의 의미가 사라지므로
    //   tests/game-engine-actions-memo.test.js가 정적으로 막는다.
    const stableActions = useMemo(
        () => ({
            // UI State setters
            setSideTab: (val: any) => dispatch({ type: AT.SET_SIDE_TAB, payload: val }),
            setGameState: (val: any) => dispatch({ type: AT.SET_GAME_STATE, payload: val }),
            setShopItems: (val: any) => dispatch({ type: AT.SET_SHOP_ITEMS, payload: val }),
            acknowledgeMilestoneStoryBeat: (id: any) => dispatch({
                type: AT.SET_PLAYER,
                payload: (currentPlayer: any) => acknowledgeMilestoneStoryBeat(currentPlayer, id),
            }),
            openExpeditionDebrief: () => dispatch({ type: AT.SET_EXPEDITION_DEBRIEF_OPEN, payload: true }),
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

            getUid: () => uid,
            isAdmin: () => ADMIN_UIDS.includes(uid ?? ''),
        }),
        [uid]
    );

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
                claimCombatAction,
                combatTurn,
            });
            const inventoryActions = createInventoryActions(deps);

            return {
                ...gameActions,
                ...combatActions,
                ...inventoryActions,
                ...stableActions,

                // player 의존 — 열려 있던 요약의 id를 읽어 그 요약만 '확인함'으로 닫는다.
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

                economyReceipt,
                liveConfig,
                leaderboard,
                getFullStats,
                dispatch,
            };
        },
        [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard, economyReceipt, clearPendingCombat, schedulePendingCombat, claimCombatItem, claimCombatAction, combatTurn, stableActions]
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
        // H5(a): 세션 uid는 state.uid에만 있다(player.uid는 어디에서도 쓰이지 않는다).
        //   공개 묘비 목록에서 "내 묘비 제외"를 실제로 판정하려면 화면까지 내려가야 한다.
        uid,
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
        presentationEpoch,
        handleCommand,
        // Feature additions
        quickSlots,
        postCombatResult,
        pendingRelics,
        runSummary,
        expeditionDebriefOpen,
        dispatch,
        addLog,
        flushLocalSave,
    };
};
