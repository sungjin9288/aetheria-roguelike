import { useEffect, useReducer, useMemo, useCallback } from 'react';
import { CONSTANTS, ADMIN_UIDS, BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { soundManager } from '../systems/SoundManager';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE } from '../reducers/gameReducer';
import { isWeapon, isShield, isTwoHandWeapon, isMagicWeapon } from '../utils/equipmentUtils';

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
        onboardingDismissed,
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
        const mainWeapon = isWeapon(player.equip.weapon) ? player.equip.weapon : null;
        const offhandItem = player.equip.offhand || null;
        const offhandWeapon = isWeapon(offhandItem) ? offhandItem : null;
        const offhandShield = isShield(offhandItem) ? offhandItem : null;

        const mainWeaponVal = mainWeapon?.val || 0;
        const offhandWeaponVal = offhandWeapon ? Math.floor((offhandWeapon.val || 0) * BALANCE.OFFHAND_WEAPON_RATIO) : 0;
        const twoHandMult = isTwoHandWeapon(mainWeapon) ? BALANCE.TWO_HAND_ATK_BONUS : 1;
        const dualWieldMult = offhandWeapon ? BALANCE.DUAL_WIELD_ATK_BONUS : 1;
        const dualWieldDefMult = offhandWeapon ? BALANCE.DUAL_WIELD_DEF_MULT : 1;

        const aVal = player.equip.armor?.val || 0;
        const shieldVal = offhandShield?.val || 0;
        const buff = player.tempBuff || {};
        const meta = player.meta || {};

        // === Set Bonus ===
        let atkMultBonus = 1;
        let defMultBonus = 1;
        let hpMultBonus = 1;
        let activeSet = null;

        const wPrefix = player.equip.weapon?.prefixName;
        const aPrefix = player.equip.armor?.prefixName;
        const oPrefix = player.equip.offhand?.prefixName;

        const prefixes = [wPrefix, aPrefix, oPrefix].filter(Boolean);
        if (prefixes.length >= 2) {
            const counts = prefixes.reduce((acc, p) => ({ ...acc, [p]: (acc[p] || 0) + 1 }), {});
            const setName = Object.keys(counts).find(k => counts[k] >= 2);
            if (setName) {
                const setData = DB.ITEMS.sets?.find(s => s.prefix === setName);
                if (setData && setData.setBonus) {
                    activeSet = setData;
                    atkMultBonus = setData.setBonus.atkMult || 1;
                    defMultBonus = setData.setBonus.defMult || 1;
                    hpMultBonus = setData.setBonus.hpMult || 1;
                }
            }
        }

        const isMagic =
            ['마법사', '아크메이지', '흑마법사', '성직자'].includes(player.job) ||
            (player.equip.weapon?.elem && !['물리', 'physical'].includes(player.equip.weapon.elem));

        // === Codex Bonus ===
        let codexAtk = 0;
        let codexDef = 0;
        let codexHp = 0;
        const registry = player.stats?.killRegistry || {};
        Object.values(registry).forEach(kills => {
            if (kills >= 10) codexHp += 5;
            if (kills >= 50) codexDef += 1;
            if (kills >= 100) codexAtk += 1;
        });

        return {
            atk: Math.floor((player.atk + mainWeaponVal + offhandWeaponVal + codexAtk + (meta.bonusAtk || 0)) * cls.atkMod * (1 + (buff.atk || 0)) * atkMultBonus * twoHandMult * dualWieldMult),
            def: Math.floor((player.def + aVal + shieldVal + codexDef) * (1 + (buff.def || 0)) * defMultBonus * dualWieldDefMult),
            maxHp: Math.floor((player.maxHp + codexHp) * hpMultBonus),
            elem: mainWeapon?.elem || offhandWeapon?.elem || '물리',
            isMagic: isMagic || isMagicWeapon(mainWeapon) || isMagicWeapon(offhandWeapon),
            weaponHands: mainWeapon?.hands || 1,
            activeSet
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

                // Feature Actions
                setQuickSlot: (index, item) => dispatch({ type: 'SET_QUICK_SLOT', payload: { index, item } }),
                clearPostCombat: () => dispatch({ type: 'SET_POST_COMBAT_RESULT', payload: null }),
                dismissOnboarding: () => dispatch({ type: 'SET_ONBOARDING_DISMISSED' }),

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
        handleCommand,
        // Feature additions
        quickSlots,
        postCombatResult,
        onboardingDismissed,
        dispatch,
    };
};
