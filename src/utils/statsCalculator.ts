import { CONSTANTS, BALANCE } from '../data/constants.js';
import type { Player } from "../types/index.js";
import { DB } from '../data/db.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import { getEquipmentProfile, getWeaponHands, isMagicWeapon } from './equipmentUtils.js';
import { getRunBuildProfile, getTraitBonus, getTraitProfile } from './runProfileUtils.js';
import { getTitlePassive, getPassiveSkillBonuses } from './gameUtils.js';
import { computeSignatureSetBonus } from './signatureSetBonus.js';
import { getJobOutfitAffinity } from './jobOutfitAffinity.js';

const MAGIC_JOBS: any = ['마법사', '아크메이지', '흑마법사', '성직자'];
const PHYSICAL_ELEMENTS: any = ['물리', 'physical'];

/**
 * @param {object} equip
 * @returns {{ atkMult: number, defMult: number, hpMult: number, activeSet: object | null }}
 */
const computeSetBonus = (equip: any) => {
    const prefixes = [
        equip.weapon?.prefixName,
        equip.armor?.prefixName,
        equip.offhand?.prefixName,
    ].filter(Boolean);

    if (prefixes.length < 2) {
        return { atkMult: 1, defMult: 1, hpMult: 1, activeSet: null };
    }

    const counts = prefixes.reduce((acc: any, p: any) => ({ ...acc, [p]: (acc[p] || 0) + 1 }), {});
    const setName = Object.keys(counts).find((k: any) => counts[k] >= 2);
    if (!setName) return { atkMult: 1, defMult: 1, hpMult: 1, activeSet: null };

    const setData = DB.ITEMS.sets?.find((s: any) => s.prefix === setName);
    if (!setData?.setBonus) return { atkMult: 1, defMult: 1, hpMult: 1, activeSet: null };

    return {
        atkMult: setData.setBonus.atkMult || 1,
        defMult: setData.setBonus.defMult || 1,
        hpMult: setData.setBonus.hpMult || 1,
        activeSet: setData,
    };
};

/**
 * @param {object} stats player.stats
 * @returns {{ atk: number, def: number, hp: number }}
 */
const computeCodexBonus = (stats: any) => {
    let atk = 0;
    let def = 0;
    let hp = 0;
    const registry = stats?.killRegistry || {};
    Object.values(registry).forEach((kills: any) => {
        if (kills >= 10) hp += 5;
        if (kills >= 50) def += 1;
        if (kills >= 100) atk += 1;
    });
    atk += (stats?.codexBonusAtk || 0);
    def += (stats?.codexBonusDef || 0);
    hp += (stats?.codexBonusHp || 0);
    return { atk, def, hp };
};

/**
 * @param {Array<object>} relics
 * @param {object} player
 * @param {boolean} hasOffhandWeapon
 * @returns {object} relic-derived multipliers and flat bonuses
 */
const computeRelicBonuses = (relics: any, player: Player, hasOffhandWeapon: any) => {
    const hpRatio = (player.hp ?? 0) / Math.max(1, player.maxHp ?? 1);

    const atkFlat = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'glass_cannon') return acc + r.val.atk;
        if (r.effect === 'ancient_power') return acc + r.val.atk;
        if (r.effect === 'omega') return acc + r.val;
        if (r.effect === 'cursed_power') return acc + r.val.atk;
        if (r.effect === 'battle_start_atk') return acc + (r.val || 0);
        if (r.effect === 'triple_up') return acc + (r.atkVal || 0);
        if (r.effect === 'low_hp_atk') {
            const threshold = typeof r.val === 'object' ? r.val.threshold : 0.3;
            const bonus = typeof r.val === 'object' ? r.val.bonus : (r.val - 1);
            if (hpRatio < threshold) return acc + bonus;
        }
        return acc;
    }, 0);

    const defFlat = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'glass_cannon') return acc + r.val.def;
        if (r.effect === 'stone_skin' || r.effect === 'def_mult') return acc + r.val;
        if (r.effect === 'fortress') return acc + r.val.def;
        if (r.effect === 'omega') return acc + r.val;
        if (r.effect === 'triple_up') return acc + (r.defVal || 0);
        return acc;
    }, 0);

    const hpMult = 1 + relics.reduce((acc: any, r: any) => {
        if (r.effect === 'fortress') return acc + r.val.hp;
        if (r.effect === 'omega') return acc + r.val;
        return acc;
    }, 0);

    const mpMult = 1 + relics.reduce((acc: any, r: any) => {
        if (r.effect === 'mp_mult') return acc + r.val;
        if (r.effect === 'omega') return acc + r.val;
        return acc;
    }, 0);

    const critBonus = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'ancient_power') return acc + r.val.crit;
        if (r.effect === 'omega') return acc + r.val;
        if (r.effect === 'dual_crit' && hasOffhandWeapon) return acc + (r.val || 0);
        return acc;
    }, 0);

    const mpFlat = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'triple_up') return acc + (r.mpVal || 0);
        return acc;
    }, 0);

    return { atkFlat, defFlat, hpMult, mpMult, critBonus, mpFlat };
};

/**
 * @param {Array<object>} relics
 * @param {number} abyssFloor
 * @returns {{ atk: number, def: number, crit: number }}
 */
const computeAbyssRelicBonuses = (relics: any, abyssFloor: any) => {
    const atk = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'abyss_atk_scale') {
            const bonus = Math.min(r.val.maxBonus, Math.floor(abyssFloor / r.val.perFloors) * r.val.atkPer);
            return acc + bonus;
        }
        if (r.effect === 'abyss_floor_power' && abyssFloor >= r.val.minFloor) {
            return acc + r.val.atkBonus;
        }
        return acc;
    }, 0);

    const def = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'abyss_floor_power' && abyssFloor >= r.val.minFloor) {
            return acc + r.val.defBonus;
        }
        return acc;
    }, 0);

    const crit = relics.reduce((acc: any, r: any) => {
        if (r.effect === 'abyss_crit_scale') {
            return acc + Math.min(r.val.maxBonus, Math.floor(abyssFloor / r.val.perFloors) * r.val.critPer);
        }
        return acc;
    }, 0);

    return { atk, def, crit };
};

/**
 * @param {Array<object>} relics
 * @param {number} totalKills
 * @returns {number}
 */
const computeKillStackAtkBonus = (relics: any, totalKills: any) =>
    relics.reduce((acc: any, r: any) => {
        if (r.effect === 'kill_stack') {
            const stacks = Math.floor(totalKills / (r.stackPer || 50));
            return acc + stacks * (r.stackVal || 25);
        }
        return acc;
    }, 0);

/**
 * @param {object} equip
 * @returns {{ atk: number, def: number }}
 */
const computeEnhanceBonus = (equip: any) => {
    const weaponEnhance = equip.weapon?.enhance || 0;
    const armorEnhance = equip.armor?.enhance || 0;
    const offhandEnhance = equip.offhand?.enhance || 0;
    const weaponBaseVal = equip.weapon?.val || 0;
    const armorBaseVal = equip.armor?.val || 0;
    const offhandBaseVal = equip.offhand?.val || 0;

    const atk =
        Math.floor(weaponBaseVal * BALANCE.ENHANCE_STAT_BONUS * weaponEnhance) +
        Math.floor(offhandBaseVal * BALANCE.ENHANCE_STAT_BONUS * offhandEnhance * 0.5);
    const def = Math.floor(armorBaseVal * BALANCE.ENHANCE_STAT_BONUS * armorEnhance);

    return { atk, def };
};

/**
 * @param {Array<object>} synergies
 * @param {object} preBuildStats
 * @param {number} hpRatio
 * @returns {{ atkMult: number, statMult: number, mpFlat: number, lowHpAtk: number }}
 */
const applySynergyBonuses = (synergies: any, preBuildStats: any, hpRatio: any) => {
    let atkMult = 1;
    let statMult = 1;
    let mpFlat = 0;
    let lowHpAtk = 0;

    synergies.forEach((syn: any) => {
        if (syn.bonus.atkMult) atkMult += syn.bonus.atkMult;
        if (syn.bonus.mpMult) mpFlat += Math.floor(preBuildStats.maxMp * syn.bonus.mpMult);
        if (syn.bonus.statBonus) statMult += syn.bonus.statBonus;
        if (syn.bonus.lowHpAtk && hpRatio < 0.4) lowHpAtk += syn.bonus.lowHpAtk;
    });

    return { atkMult, statMult, mpFlat, lowHpAtk };
};

/**
 * @param {number} killStreak
 * @returns {{ atkBonus: number, critBonus: number, tierIdx: number }}
 */
const computeKillStreakBonus = (killStreak: any) => {
    const tierIdx = BALANCE.KILL_STREAK_TIERS.reduce(
        (best: any, threshold: any, i: any) => (killStreak >= threshold ? i : best),
        -1
    );
    const atkBonus = tierIdx >= 0 ? BALANCE.KILL_STREAK_ATK_BONUS[tierIdx] : 0;
    const critBonus = tierIdx >= 0 ? BALANCE.KILL_STREAK_CRIT_BONUS[tierIdx] : 0;
    return { atkBonus, critBonus, tierIdx };
};

/**
 * Pure function that computes a player's full derived combat stats.
 * No side effects; identical input produces identical output.
 *
 * @param {object} player
 * @returns {object} derived stats
 */
export const calculateFullStats = (player: Player) => {
    if (!player) return null;

    const cls = DB.CLASSES[player.job as string] || DB.CLASSES[CONSTANTS.DEFAULT_JOB];
    const equipProfile = getEquipmentProfile(player.equip);
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

    const dualWieldAtkMult = offhandWeapon ? BALANCE.DUAL_WIELD_ATK_BONUS : 1;
    const dualWieldDefMult = offhandWeapon ? BALANCE.DUAL_WIELD_DEF_MULT : 1;

    const armorVal = player.equip?.armor?.val || 0;
    const buff = player.tempBuff || {};
    const meta = player.meta || {};
    const titlePassive = getTitlePassive(player.activeTitle) || {};

    const setBonus = computeSetBonus(player.equip);
    const signatureSetBonus = computeSignatureSetBonus(player.equip);
    const codexBonus = computeCodexBonus(player.stats);
    // cycle 45: outfit set bonus — 장비의 jobs[]가 player.job과 매칭되는 슬롯 카운트별 누적 보너스
    const affinity = getJobOutfitAffinity(player);
    const affinityAtkMult = affinity.bonus.atkMult || 1;
    const affinityDefMult = affinity.bonus.defMult || 1;
    const affinityMpBonus = affinity.bonus.mpBonus || 0;
    const affinityHpBonus = affinity.bonus.hpBonus || 0;

    const weaponElem = player.equip?.weapon?.elem;
    const isMagic =
        MAGIC_JOBS.includes(player.job as string) ||
        (weaponElem && !PHYSICAL_ELEMENTS.includes(weaponElem));

    const relics = player.relics || [];
    const relicBonus = computeRelicBonuses(relics, player, Boolean(offhandWeapon));
    const abyssBonus = computeAbyssRelicBonuses(relics, player.stats?.abyssFloor || 0);
    const killStackAtkBonus = computeKillStackAtkBonus(relics, player.stats?.kills || 0);

    const passiveBonus = getPassiveSkillBonuses(player);
    const enhanceBonus = computeEnhanceBonus(player.equip);

    const baseAtk =
        ((player.atk ?? 0) + mainAttack + offhandAttack + codexBonus.atk + enhanceBonus.atk + killStackAtkBonus + (meta.bonusAtk || 0) + passiveBonus.atk) *
        cls.atkMod *
        (1 + (buff.atk || 0) + abyssBonus.atk) *
        setBonus.atkMult *
        signatureSetBonus.atkMult *
        dualWieldAtkMult *
        affinityAtkMult *
        (passiveBonus.lowHpAtkMult || 1);

    const baseDef =
        ((player.def ?? 0) + armorVal + shieldDef + codexBonus.def + enhanceBonus.def + passiveBonus.def) *
        (1 + (buff.def || 0) + abyssBonus.def) *
        setBonus.defMult *
        signatureSetBonus.defMult *
        dualWieldDefMult *
        affinityDefMult;

    const baseMaxHp = ((player.maxHp ?? 0) + codexBonus.hp + passiveBonus.hp) * setBonus.hpMult * signatureSetBonus.hpMult * (1 + affinityHpBonus);
    const baseMaxMp = ((player.maxMp || 50) + equipmentMpBonus + relicBonus.mpFlat + passiveBonus.mp) * relicBonus.mpMult * (1 + affinityMpBonus);
    const baseCritChance = Math.min(
        0.75,
        BALANCE.CRIT_CHANCE + equipmentCritBonus + relicBonus.critBonus + abyssBonus.crit + (titlePassive.crit || 0) + passiveBonus.crit
    );

    const preBuildStats: Record<string, any> = {
        atk: Math.floor(baseAtk * (1 + relicBonus.atkFlat) + (titlePassive.atk || 0)),
        def: Math.floor(baseDef * (1 + relicBonus.defFlat) + (titlePassive.def || 0)),
        maxHp: Math.floor(baseMaxHp * relicBonus.hpMult) + (titlePassive.hp || 0),
        maxMp: Math.floor(baseMaxMp) + (titlePassive.mp || 0),
        elem: mainWeapon?.elem || offhandWeapon?.elem || '물리',
        isMagic: isMagic || isMagicWeapon(mainWeapon) || isMagicWeapon(offhandWeapon) || Boolean(offhandShield?.elem && offhandShield?.elem !== '물리'),
        weaponHands: getWeaponHands(mainWeapon),
        activeSet: setBonus.activeSet,
        activeSignatureSet: signatureSetBonus.activeSet,
        relics,
        critChance: baseCritChance,
    };

    const buildProfile = getRunBuildProfile(player, preBuildStats);
    const traitProfile = getTraitProfile(player, preBuildStats);
    const traitBonus = getTraitBonus(player, preBuildStats);

    const activeSynergies = getActiveRelicSynergies(relics);
    const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 150);
    const synergyBonus = applySynergyBonuses(activeSynergies, preBuildStats, hpRatio);

    const streak = computeKillStreakBonus(player.killStreak || 0);

    const finalAtk = Math.floor(
        preBuildStats.atk *
        (traitBonus.atkMult || 1) *
        synergyBonus.atkMult *
        synergyBonus.statMult *
        (1 + synergyBonus.lowHpAtk) *
        (1 + streak.atkBonus)
    );
    const finalDef = Math.floor(preBuildStats.def * (traitBonus.defMult || 1) * synergyBonus.statMult);
    const finalMaxHp = Math.floor(preBuildStats.maxHp * synergyBonus.statMult);
    const finalMaxMp = preBuildStats.maxMp + (traitBonus.mpFlat || 0) + synergyBonus.mpFlat;
    const finalCritChance = Math.min(0.75, preBuildStats.critChance + (traitBonus.critBonus || 0) + streak.critBonus);

    return {
        atk: finalAtk,
        def: finalDef,
        maxHp: finalMaxHp,
        maxMp: finalMaxMp,
        elem: preBuildStats.elem,
        isMagic: preBuildStats.isMagic,
        weaponHands: preBuildStats.weaponHands,
        activeSet: setBonus.activeSet,
        activeSignatureSet: signatureSetBonus.activeSet,
        relics,
        critChance: finalCritChance,
        buildProfile,
        traitProfile,
        traitBonus,
        titlePassive,
        activeSynergies,
        killStreak: player.killStreak || 0,
        killStreakTier: streak.tierIdx,
        passiveGoldMult: passiveBonus.goldMult,
        passiveExpMult: passiveBonus.expMult,
        jobAffinity: affinity,  // cycle 45: { matchCount, totalSlots, bonus, label, tier, slots }
    };
};
