import { useEffect, useReducer, useMemo, useCallback } from 'react';
import { CONSTANTS, ADMIN_UIDS, BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { soundManager } from '../systems/SoundManager';
import { AI_SERVICE } from '../services/aiService';
import { parseCommand } from '../utils/commandParser';
import { gameReducer, INITIAL_STATE } from '../reducers/gameReducer';
import { getTitlePassive } from '../utils/gameUtils';
import { getEquipmentProfile, getWeaponHands, isMagicWeapon } from '../utils/equipmentUtils';
import { getRunBuildProfile, getTraitBonus, getTraitProfile } from '../utils/runProfileUtils';

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

    const getFullStats = useCallback((targetPlayer = player) => {
        const activePlayer = targetPlayer ?? player;
        const cls = DB.CLASSES[activePlayer.job] || DB.CLASSES['모험가'];
        const equipProfile = getEquipmentProfile(activePlayer.equip);
        const {
            mainWeapon,
            offhandWeapon,
            offhandShield,
            mainAttack,
            offhandAttack,
            shieldDef,
            critBonus: equipmentCritBonus,
            mpBonus: equipmentMpBonus,
        } = equipProfile;
        const dualWieldMult = offhandWeapon ? BALANCE.DUAL_WIELD_ATK_BONUS : 1;
        const dualWieldDefMult = offhandWeapon ? BALANCE.DUAL_WIELD_DEF_MULT : 1;

        const aVal = activePlayer.equip.armor?.val || 0;
        const buff = activePlayer.tempBuff || {};
        const meta = activePlayer.meta || {};
        const titlePassive = getTitlePassive(activePlayer.activeTitle) || {};

        // === Set Bonus ===
        let atkMultBonus = 1;
        let defMultBonus = 1;
        let hpMultBonus = 1;
        let activeSet = null;

        const wPrefix = activePlayer.equip.weapon?.prefixName;
        const aPrefix = activePlayer.equip.armor?.prefixName;
        const oPrefix = activePlayer.equip.offhand?.prefixName;

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
            ['마법사', '아크메이지', '흑마법사', '성직자'].includes(activePlayer.job) ||
            (activePlayer.equip.weapon?.elem && !['물리', 'physical'].includes(activePlayer.equip.weapon.elem));

        // === Codex Bonus ===
        let codexAtk = 0;
        let codexDef = 0;
        let codexHp = 0;
        const registry = activePlayer.stats?.killRegistry || {};
        Object.values(registry).forEach(kills => {
            if (kills >= 10) codexHp += 5;
            if (kills >= 50) codexDef += 1;
            if (kills >= 100) codexAtk += 1;
        });

        // v4.0 — 유물 스탯 배율 계산
        const relics = activePlayer.relics || [];
        const ra = relics.reduce((acc, r) => {
            if (r.effect === 'glass_cannon')  return acc + r.val.atk;
            if (r.effect === 'ancient_power') return acc + r.val.atk;
            if (r.effect === 'omega')         return acc + r.val;
            if (r.effect === 'cursed_power')  return acc + r.val.atk;
            if (r.effect === 'low_hp_atk' && activePlayer.hp / Math.max(1, activePlayer.maxHp) < r.val.threshold) return acc + r.val.bonus;
            return acc;
        }, 0);
        const rd = relics.reduce((acc, r) => {
            if (r.effect === 'glass_cannon') return acc + r.val.def; // 음수
            if (r.effect === 'stone_skin' || r.effect === 'def_mult') return acc + r.val;
            if (r.effect === 'fortress')     return acc + r.val.def;
            if (r.effect === 'omega')        return acc + r.val;
            return acc;
        }, 0);
        const rhp = 1 + relics.reduce((acc, r) => {
            if (r.effect === 'fortress') return acc + r.val.hp;
            if (r.effect === 'omega')    return acc + r.val;
            return acc;
        }, 0);
        const rmp = 1 + relics.reduce((acc, r) => {
            if (r.effect === 'mp_mult') return acc + r.val;
            if (r.effect === 'omega')   return acc + r.val;
            return acc;
        }, 0);
        const relicCritBonus = relics.reduce((acc, r) => {
            if (r.effect === 'ancient_power') return acc + r.val.crit;
            if (r.effect === 'omega')         return acc + r.val;
            return acc;
        }, 0);

        const baseAtk = (activePlayer.atk + mainAttack + offhandAttack + codexAtk + (meta.bonusAtk || 0)) * cls.atkMod * (1 + (buff.atk || 0)) * atkMultBonus * dualWieldMult;
        const baseDef = (activePlayer.def + aVal + shieldDef + codexDef) * (1 + (buff.def || 0)) * defMultBonus * dualWieldDefMult;
        const baseMaxHp = (activePlayer.maxHp + codexHp) * hpMultBonus;
        const baseMaxMp = ((activePlayer.maxMp || 50) + equipmentMpBonus) * rmp;
        const baseCritChance = Math.min(0.75, BALANCE.CRIT_CHANCE + equipmentCritBonus + relicCritBonus + (titlePassive.crit || 0));
        const preBuildStats = {
            atk: Math.floor(baseAtk * (1 + ra) + (titlePassive.atk || 0)),
            def: Math.floor(baseDef * (1 + rd) + (titlePassive.def || 0)),
            maxHp: Math.floor(baseMaxHp * rhp) + (titlePassive.hp || 0),
            maxMp: Math.floor(baseMaxMp) + (titlePassive.mp || 0),
            elem: mainWeapon?.elem || offhandWeapon?.elem || '물리',
            isMagic: isMagic || isMagicWeapon(mainWeapon) || isMagicWeapon(offhandWeapon) || Boolean(offhandShield?.elem && offhandShield?.elem !== '물리'),
            weaponHands: getWeaponHands(mainWeapon),
            activeSet,
            relics,
            critChance: baseCritChance,
        };
        const buildProfile = getRunBuildProfile(activePlayer, preBuildStats);
        const traitProfile = getTraitProfile(activePlayer, preBuildStats);
        const traitBonus = getTraitBonus(activePlayer, preBuildStats);
        const finalAtk = Math.floor(preBuildStats.atk * (traitBonus.atkMult || 1));
        const finalDef = Math.floor(preBuildStats.def * (traitBonus.defMult || 1));
        const finalMaxHp = preBuildStats.maxHp;
        const finalMaxMp = preBuildStats.maxMp + (traitBonus.mpFlat || 0);
        const finalCritChance = Math.min(0.75, preBuildStats.critChance + (traitBonus.critBonus || 0));

        return {
            atk: finalAtk,
            def: finalDef,
            maxHp: finalMaxHp,
            maxMp: finalMaxMp,
            elem: preBuildStats.elem,
            isMagic: preBuildStats.isMagic,
            weaponHands: preBuildStats.weaponHands,
            activeSet,
            relics,
            critChance: finalCritChance,
            buildProfile,
            traitProfile,
            traitBonus,
            titlePassive,
        };
    }, [player]);

    const addStoryLog = useCallback(
        async (type, data) => {
            dispatch({ type: 'SET_AI_THINKING', payload: true });
            const tempId = Date.now();
            dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });
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
                    buildProfile: buildProfile.tags.map((tag) => tag.name).slice(0, 4)
                }
            }, uid);

            dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text: narrative } } });
            dispatch({ type: 'SET_AI_THINKING', payload: false });
        },
        [player, uid, getFullStats]
    );

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
                setActiveTitle: (val) => dispatch({ type: 'SET_PLAYER', payload: { activeTitle: val } }),

                // Feature Actions
                setQuickSlot: (index, item) => dispatch({ type: 'SET_QUICK_SLOT', payload: { index, item } }),
                clearPostCombat: () => dispatch({ type: 'SET_POST_COMBAT_RESULT', payload: null }),
                dismissOnboarding: () => dispatch({ type: 'SET_ONBOARDING_DISMISSED' }),

                getUid: () => uid,
                isAdmin: () => ADMIN_UIDS.includes(uid),
                liveConfig,
                leaderboard,
                getFullStats,
            };
        },
        [player, gameState, enemy, isAiThinking, uid, liveConfig, grave, currentEvent, addLog, addStoryLog, getFullStats, leaderboard]
    );

    const handleCommand = useCallback((text) => {
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
        leaderboard,
        liveConfig,
        bootStage,
        handleCommand,
        // Feature additions
        quickSlots,
        postCombatResult,
        onboardingDismissed,
        pendingRelics,
        runSummary,
        dispatch,
    };
};
