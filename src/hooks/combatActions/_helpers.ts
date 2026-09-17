import { getJobSkills } from '../../utils/gameUtils';
import { getEquipmentComparison } from '../../utils/equipmentUtils';
import { MSG } from '../../data/messages';
import { AT } from '../../reducers/actionTypes';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import type { FullStats, Item, Player } from '../../types/index.js';

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
//   :213) 명시 전달이라 두 default 모두 도달 불가. body의 (lootItems || [])
//   defensive guard는 별개 보존. util/component/hook default 청소 메가 시리즈
//   30번째 batch (cycle 502-533).
// A2 (2026-09 감사 G4): 델타/점수/라벨을 자체 계산하던 로직 제거 →
//   equipmentUtils.getEquipmentComparison(= getEquipmentDecision 기반)에 위임.
//   기존 계산은 (a) 강화 +N 보너스를 무시했고 (b) 점수식
//   `atk + def + crit*2 + floor(mp/5)`를 inline 복제해 constants.ts의 장비 점수
//   가중치(EQUIP_SCORE_CRIT_WEIGHT / EQUIP_SCORE_MP_DIVISOR)와 이중 관리 상태였다. 이제 상점/인벤/루팅 3표면이 동일한 델타를 보고한다.
//   첫 인자가 equip에서 player로 바뀐 이유: 강화·직업 제한 판정에 player가 필요.
export const getLootUpgradeHint = (player: Player, lootItems: Item[]): any => {
    const equipmentDrops = (lootItems || []).filter((item: any) => ['weapon', 'armor', 'shield'].includes(item?.type));
    if (!equipmentDrops.length) return null;

    // cycle 352: bestHint score 출력 dead 정리 — name / summary만 외부 read.
    //   score는 함수 내부 비교용으로만 사용 → 외부 노출 strip.
    let bestHint: any = null;
    let bestScore = -Infinity;
    equipmentDrops.forEach((item: any) => {
        const comparison = getEquipmentComparison(player, item);
        if (!comparison) return;
        if (comparison.score <= 0) return;
        if (comparison.score <= bestScore) return;
        bestHint = { name: item.name, summary: comparison.upgradeText || MSG.COMBAT_DIGEST_DEFAULT_SUMMARY };
        bestScore = comparison.score;
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
    // slice 20: 경험/골드 파트 제거 — 바로 위 MSG.VICTORY 로그
    //   ("승리했습니다. 경험 +N · 골드 +N")와 동일 수치가 2회 출력되던 중복. digest는 처치 + 전리품 요약
    //   + 후속 힌트 anchor 역할만 담당.
    const summaryParts = [
        MSG.COMBAT_DIGEST_KILL(enemyName),
    ];
    // slice 24: 전리품 1건은 LOOT_GET 개별 로그("전리품: X")가 이미 표시하므로
    //   digest에선 생략 — 동일 아이템명 2회 출력 중복 제거. 2건 이상일 때만
    //   요약("A · B +1")로서의 가치가 있어 표기.
    if (droppedItems.length > 1) {
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

/**
 * 탐험 스카우팅 "전투의 기척" 카드 — 해당 전투 한정 처치 보상(EXP/골드) 배율 보너스.
 * CombatEngine.handleVictory가 받는 passiveBonus 스키마(goldMult/expMult)에 합산한다 —
 * CombatEngine 시그니처는 그대로 유지(신규 파라미터 없음). 순수 함수.
 */
export const buildPassiveBonusWithScout = (stats: FullStats, deadEnemy: any) => {
    const scoutRewardBonus = deadEnemy?.scoutRewardBonus || 0;
    return {
        goldMult: (stats?.passiveGoldMult || 0) + scoutRewardBonus,
        expMult: (stats?.passiveExpMult || 0) + scoutRewardBonus,
    };
};

/**
 * 탐험 스카우팅 "정예의 흔적" 카드 — 승리 시 유물 발견 보장(고위험 베팅의 보상).
 * exploreActions.ts의 유물 3(4)선택 큐잉 인프라(SET_PENDING_RELICS)를 그대로 재사용한다.
 * deadEnemy.scoutGuaranteedRelic이 없거나, 유물 슬롯이 가득 찼거나 후보가 없으면 무동작.
 */
export const applyScoutGuaranteedRelic = (
    deadEnemy: any,
    updatedPlayer: Player,
    { dispatch, addLog, rng }: any,
) => {
    if (!deadEnemy?.scoutGuaranteedRelic) return;
    const ownedRelics = updatedPlayer.relics || [];
    const relicUnlocks = getPrestigeUnlocks(updatedPlayer.meta?.prestigeRank);
    if (ownedRelics.length >= relicUnlocks.maxRelics) return;
    const available = RELICS.filter((r: any) => !ownedRelics.some((pr: any) => pr.id === r.id));
    if (available.length === 0) return;

    const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, {
        owned: ownedRelics,
        rng,
    });
    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
    addLog('event', MSG.EXPLORE_RELIC_FOUND);
};
