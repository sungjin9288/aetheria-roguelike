import { getJobSkills } from '../../utils/gameUtils';
import { getEquipmentProfile, getNextEquipmentState } from '../../utils/equipmentUtils';
import { MSG } from '../../data/messages';
import type { Item, Player } from '../../types/index.js';

/**
 * 현재 선택된 스킬 반환. 없으면 null.
 */
// cycle 353: index / total 출력 dead 정리 — `.skill`만 외부 read.
//   useCombatActions는 `?.skill || null` unwrap, combatAttack은 `selected?.skill` 사용.
//   index 변수는 array 인덱싱용 internal const로만 사용.
export const getSelectedSkill = (player: Player) => {
    const skills = getJobSkills(player);
    if (!skills.length) return null;
    const selected = Number.isInteger(player.skillLoadout?.selected) ? (player.skillLoadout!.selected as number) : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    return { skill: skills[index] };
};

/**
 * 루트 아이템 중 장비 업그레이드 힌트 계산. 없으면 null.
 */
// cycle 534: equip / lootItems defaults 제거 — 1 callsite (combatVictory
//   :213) getLootUpgradeHint(updatedPlayer.equip, lootResult.items) 명시
//   전달이라 두 default 모두 도달 불가. body의 (lootItems || []) defensive
//   guard는 별개 보존. util/component/hook default 청소 메가 시리즈 30번째
//   batch (cycle 502-533).
export const getLootUpgradeHint = (equip: any, lootItems: Item[]): any => {
    const equipmentDrops = (lootItems || []).filter((item: any) => ['weapon', 'armor', 'shield'].includes(item?.type));
    if (!equipmentDrops.length) return null;

    const currentProfile = getEquipmentProfile(equip);
    const currentAtk = currentProfile.mainAttack + currentProfile.offhandAttack;
    const currentDef = (equip.armor?.val || 0) + currentProfile.shieldDef;

    // cycle 352: bestHint score 출력 dead 정리 — name / summary만 외부 read.
    //   score는 함수 내부 비교용으로만 사용 → 외부 노출 strip.
    let bestHint: any = null;
    let bestScore = -Infinity;
    equipmentDrops.forEach((item: any) => {
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
        if (score <= bestScore) return;
        const summaryParts: any[] = [];
        if (atkDelta > 0) summaryParts.push(`ATK +${atkDelta}`);
        if (defDelta > 0) summaryParts.push(`DEF +${defDelta}`);
        if (critDelta > 0) summaryParts.push(`CRIT +${critDelta}%`);
        if (mpDelta > 0) summaryParts.push(`MP +${mpDelta}`);
        bestHint = { name: item.name, summary: summaryParts.join(' / ') || MSG.COMBAT_DIGEST_DEFAULT_SUMMARY };
        bestScore = score;
    });
    return bestHint;
};

/**
 * 전투 종료 요약 로그 출력
 */
// cycle 591: 5 defaults batch 제거 (droppedItems/upgradeHint/traitHint/
//   bossRewardHint/bossClearBonus) — 1 production caller (combatVictory:215)
//   8 props 모두 명시 전달이라 5 defaults 모두 도달 불가. 청소 메가 시리즈
//   81번째 single-cycle 5-default batch.
// slice 20: victoryResult destructure 제거 — EXP/Gold 중복 파트 삭제로 body
//   read 0건. callsite는 8 props 명시 전달 그대로 (cycle 591 가드 보존).
export const addCombatDigestLogs = ({
    addLog, enemyName,
    droppedItems, upgradeHint, traitHint,
    bossRewardHint, bossClearBonus,
}: any) => {
    // slice 20: EXP/Gold 파트 제거 — 바로 위 MSG.VICTORY 로그("승리! EXP +N,
    //   Gold +N")와 동일 수치가 2회 출력되던 중복. digest는 처치 + 전리품 요약
    //   + 후속 힌트 anchor 역할만 담당.
    const summaryParts = [
        MSG.COMBAT_DIGEST_KILL(enemyName),
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
