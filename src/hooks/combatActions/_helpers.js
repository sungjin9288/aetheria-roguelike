import { getJobSkills } from '../../utils/gameUtils';
import { getEquipmentProfile, getNextEquipmentState } from '../../utils/equipmentUtils';
import { MSG } from '../../data/messages';

/**
 * 현재 선택된 스킬 반환. 없으면 null.
 */
export const getSelectedSkill = (player) => {
    const skills = getJobSkills(player);
    if (!skills.length) return null;
    const selected = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout.selected : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    return { skill: skills[index], index, total: skills.length };
};

/**
 * 루트 아이템 중 장비 업그레이드 힌트 계산. 없으면 null.
 */
export const getLootUpgradeHint = (equip = {}, lootItems = []) => {
    const equipmentDrops = (lootItems || []).filter((item) => ['weapon', 'armor', 'shield'].includes(item?.type));
    if (!equipmentDrops.length) return null;

    const currentProfile = getEquipmentProfile(equip);
    const currentAtk = currentProfile.mainAttack + currentProfile.offhandAttack;
    const currentDef = (equip.armor?.val || 0) + currentProfile.shieldDef;

    let bestHint = null;
    equipmentDrops.forEach((item) => {
        const nextEquip = getNextEquipmentState(equip, item);
        const nextProfile = getEquipmentProfile(nextEquip);
        const nextAtk = nextProfile.mainAttack + nextProfile.offhandAttack;
        const nextDef = (nextEquip.armor?.val || 0) + nextProfile.shieldDef;
        const critDelta = Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100);
        const mpDelta = nextProfile.mpBonus - currentProfile.mpBonus;
        const atkDelta = nextAtk - currentAtk;
        const defDelta = nextDef - currentDef;
        const score = atkDelta + defDelta + (critDelta * 2) + Math.floor(mpDelta / 5);
        if (score <= 0) return;
        const summaryParts = [];
        if (atkDelta > 0) summaryParts.push(`ATK +${atkDelta}`);
        if (defDelta > 0) summaryParts.push(`DEF +${defDelta}`);
        if (critDelta > 0) summaryParts.push(`CRIT +${critDelta}%`);
        if (mpDelta > 0) summaryParts.push(`MP +${mpDelta}`);
        const candidate = { name: item.name, score, summary: summaryParts.join(' / ') || MSG.COMBAT_DIGEST_DEFAULT_SUMMARY };
        if (!bestHint || candidate.score > bestHint.score) bestHint = candidate;
    });
    return bestHint;
};

/**
 * 전투 종료 요약 로그 출력
 */
export const addCombatDigestLogs = ({
    addLog, enemyName, victoryResult,
    droppedItems = [], upgradeHint = null, traitHint = null,
    bossRewardHint = null, bossClearBonus = 0,
}) => {
    const summaryParts = [
        MSG.COMBAT_DIGEST_KILL(enemyName),
        `EXP +${victoryResult.expGained || 0}`,
        `Gold +${victoryResult.goldGained || 0}`,
    ];
    if (droppedItems.length > 0) {
        const lootText = `${droppedItems.slice(0, 2).join(' · ')}${droppedItems.length > 2 ? ` +${droppedItems.length - 2}` : ''}`;
        summaryParts.push(MSG.COMBAT_DIGEST_LOOT(lootText));
    }
    addLog('system', MSG.COMBAT_DIGEST(summaryParts.join(' · ')));
    if (bossRewardHint) {
        addLog('info', MSG.COMBAT_DIGEST_BOSS_REWARD(bossClearBonus, bossRewardHint));
        return;
    }
    if (upgradeHint) {
        addLog('info', MSG.COMBAT_DIGEST_EQUIP_UPGRADE(upgradeHint.name, upgradeHint.summary));
        return;
    }
    if (traitHint) {
        addLog('info', MSG.COMBAT_DIGEST_TRAIT_HINT(traitHint.name, traitHint.summary));
    }
};
