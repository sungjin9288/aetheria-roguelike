import { findItemByName, getJobSkills } from '../../utils/gameUtils';
import { getEquipmentComparison } from '../../utils/equipmentUtils';
import { MSG } from '../../data/messages';
import { AT } from '../../reducers/actionTypes';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { getRunBuildProfile } from '../../utils/runProfile';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { pickBossRewardRelics } from '../../utils/bossRelicReward';
import { EVENT_CHAINS } from '../../data/eventChains';
import { addItemByName } from '../../utils/inventoryUtils';
import { summarizeLoot } from '../../utils/lootSummary';
import type { FullStats, Item, Monster, Player } from '../../types/index.js';
import type { AddLog, GameActionDeps } from '../actionDeps';
import type { DimensionGraveRef, EventOutcome } from '../../types/session.js';

/**
 * 처치된 적 — 몬스터 인스턴스에 탐험 정찰 카드가 붙인 "이 전투 한정" 보너스가 함께 실린다
 * (scoutEvents/eventActions가 SET_ENEMY 직전에 덧붙인다).
 */
export type DefeatedEnemy = Monster & {
    /** 정찰 "전투의 기척" — 처치 보상(EXP/골드) 배율 가산. */
    scoutRewardBonus?: number;
    /** 정찰 "정예의 흔적" — 승리 시 유물 발견 보장. */
    scoutGuaranteedRelic?: boolean;
    /**
     * Wave 62 C19: 이야기 전투(체인 선택지 `combat`)의 출처 — 승리하면 `applyChainCombatVictory`가 그 선택지의 보상과
     * 체인 진행을 정산한다. 보상은 여기 싣지 않고 데이터(`EVENT_CHAINS`)에서 다시 읽는다.
     */
    chainCombat?: ChainCombatRef;
    /** Wave 70: 다른 차원의 묘비 망령 — 이기면 `applyDimensionGraveVictory`가 그 묘비의 유품(카탈로그 이름)을 준다. */
    dimensionGrave?: DimensionGraveRef;
};

/** 이야기 전투의 출처 — 체인 id · 단계 · 선택지 번호. */
export interface ChainCombatRef {
    chainId: string;
    step: number;
    choiceIndex: number;
}

/** 전투 요약 로그가 쓰는 전리품 힌트 (장비 업그레이드 / 성향 공명 공통 모양). */
export interface LootHint {
    name: string | undefined;
    summary: string;
}

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
export const getLootUpgradeHint = (player: Player, lootItems: Item[]): LootHint | null => {
    const equipmentDrops = (lootItems || []).filter((item) => ['weapon', 'armor', 'shield'].includes(String(item?.type)));
    if (!equipmentDrops.length) return null;

    // cycle 352: bestHint score 출력 dead 정리 — name / summary만 외부 read.
    //   score는 함수 내부 비교용으로만 사용 → 외부 노출 strip.
    let bestHint: LootHint | null = null;
    let bestScore = -Infinity;
    equipmentDrops.forEach((item) => {
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
export interface CombatDigestOptions {
    addLog: AddLog;
    enemyName: string | undefined;
    droppedItems: Array<string | undefined>;
    upgradeHint: LootHint | null;
    traitHint: LootHint | null;
    bossRewardHint: string | null;
    bossClearBonus: number;
    /**
     * body가 읽지 않는 필드(slice 20에서 destructure 제거). 호출부의 8-props 명시 전달을
     * tests/cycle-500-599.test.js(cycle 591)가 고정하고 있어 타입에서도 받아만 둔다.
     */
    victoryResult?: unknown;
}

export const addCombatDigestLogs = ({
    addLog, enemyName,
    droppedItems, upgradeHint, traitHint,
    bossRewardHint, bossClearBonus,
}: CombatDigestOptions) => {
    // slice 20: 경험/골드 파트 제거 — 바로 위 MSG.VICTORY 로그
    //   ("승리했습니다. 경험 +N · 골드 +N")와 동일 수치가 2회 출력되던 중복. digest는 처치 + 전리품 요약
    //   + 후속 힌트 anchor 역할만 담당.
    const summaryParts = [
        MSG.COMBAT_DIGEST_KILL(enemyName!),
    ];
    // slice 24: 전리품 1건은 LOOT_GET 개별 로그("전리품: X")가 이미 표시하므로
    //   digest에선 생략 — 동일 아이템명 2회 출력 중복 제거. 2건 이상일 때만
    //   요약("A · B +1")로서의 가치가 있어 표기. Wave 67: 같은 전리품은 "A x2"로 묶는다(카드와 같은 판정).
    if (droppedItems.length > 1) {
        const loot = summarizeLoot(droppedItems);
        const lootText = `${loot.shown.join(' · ')}${loot.restCount > 0 ? ` +${loot.restCount}` : ''}`;
        summaryParts.push(MSG.COMBAT_DIGEST_LOOT(lootText));
    }
    addLog('system', MSG.COMBAT_DIGEST(summaryParts.join(' · ')));
    if (bossRewardHint) {
        addLog('info', MSG.COMBAT_DIGEST_BOSS_REWARD(bossClearBonus, bossRewardHint));
        return;
    }
    if (upgradeHint) {
        addLog('info', MSG.COMBAT_DIGEST_EQUIP_UPGRADE(upgradeHint.name!, upgradeHint.summary));
        return;
    }
    if (traitHint) {
        addLog('info', MSG.COMBAT_DIGEST_TRAIT_HINT(traitHint.name!, traitHint.summary));
    }
};

/**
 * 탐험 스카우팅 "전투의 기척" 카드 — 해당 전투 한정 처치 보상(EXP/골드) 배율 보너스.
 * CombatEngine.handleVictory가 받는 passiveBonus 스키마(goldMult/expMult)에 합산한다 —
 * CombatEngine 시그니처는 그대로 유지(신규 파라미터 없음). 순수 함수.
 */
export const buildPassiveBonusWithScout = (stats: FullStats, deadEnemy: DefeatedEnemy) => {
    const scoutRewardBonus = deadEnemy?.scoutRewardBonus || 0;
    return {
        goldMult: (stats?.passiveGoldMult || 0) + scoutRewardBonus,
        expMult: (stats?.passiveExpMult || 0) + scoutRewardBonus,
        // 2026-10 Wave 56: 켜진 조합(절멸자 · 공허의 용 처치 누적) — 넘기지 않던 동안 누적 보너스가 0이었다.
        activeSynergies: stats?.activeSynergies || [],
    };
};

/**
 * 탐험 스카우팅 "정예의 흔적" 카드 — 승리 시 유물 발견 보장(고위험 베팅의 보상).
 * exploreActions.ts의 유물 3(4)선택 큐잉 인프라(SET_PENDING_RELICS)를 그대로 재사용한다.
 * deadEnemy.scoutGuaranteedRelic이 없거나 후보가 없으면(전부 보유) 무동작.
 * Wave 62 C4: 유물 칸이 가득 차도 제안한다 — 카드가 "승리 시 유물"을 약속했다. 선택 화면이 교체 · 넘기기를 보이고
 *   (보스 보상 · 체인 보상과 같은 흐름), 유물 수는 상한을 넘지 않는다(`ADD_RELIC`이 거부, `REPLACE_RELIC`은 수를 유지).
 */
export const applyScoutGuaranteedRelic = (
    deadEnemy: DefeatedEnemy,
    updatedPlayer: Player,
    { dispatch, addLog, rng }: Pick<GameActionDeps, 'dispatch' | 'addLog'> & { rng: () => number },
) => {
    if (!deadEnemy?.scoutGuaranteedRelic) return;
    const ownedRelics = updatedPlayer.relics || [];
    const relicUnlocks = getPrestigeUnlocks(updatedPlayer.meta?.prestigeRank);
    const atCapacity = ownedRelics.length >= relicUnlocks.maxRelics;
    const available = RELICS.filter((r) => !ownedRelics.some((pr) => pr.id === r.id));
    if (available.length === 0) return;

    // Wave 4 O2: 현재 빌드 아키타입을 추첨에 넘겨 빌드가 실제로 굴리는 effect를 더 자주 보여 준다.
    //   승리 직후라 장비/유물은 최신 상태 — 파생 stats 없이 player만으로 판정해도 같은 결론이 나온다.
    const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, {
        owned: ownedRelics,
        rng,
        buildId: getRunBuildProfile(updatedPlayer, null).primary.id,
    });
    if (candidates.length === 0) return;
    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
    addLog('event', atCapacity ? MSG.SCOUT_RELIC_REPLACE_OFFER : MSG.EXPLORE_RELIC_FOUND);
};

/**
 * 이야기 전투 승리 정산(Wave 62 C19) — 체인 선택지 `combat`으로 열린 전투에서 이기면 그 선택지의 보상을 주고 체인을 한 단계
 * 진행한다. 보상 · 승리 로그는 데이터(`EVENT_CHAINS`)에서 읽는다. 체인이 이미 그 단계를 지났으면(중복 정산) 아무것도 하지 않는다.
 * 지거나 물러나면 이 함수는 불리지 않고 단계는 그대로 남는다 — 같은 자리를 탐험하면 다시 마주친다.
 */
export const applyChainCombatVictory = (
    deadEnemy: DefeatedEnemy,
    updatedPlayer: Player,
    { dispatch, addLog }: Pick<GameActionDeps, 'dispatch' | 'addLog'>,
) => {
    const ref = deadEnemy?.chainCombat;
    if (!ref) return;
    const chain = EVENT_CHAINS.find((entry) => entry.id === ref.chainId);
    const outcome: EventOutcome | undefined = chain?.steps.find((entry) => entry.step === ref.step)?.event.outcomes[ref.choiceIndex];
    if (!outcome || outcome.type !== 'chain_advance') return;
    if ((updatedPlayer.eventChainProgress?.[ref.chainId] ?? 0) !== ref.step) return;
    const reward = outcome.reward;
    const itemName = reward && (reward.type === 'legendary_item' || reward.type === 'item') && reward.name && findItemByName(reward.name)
        ? reward.name
        : null;
    dispatch({
        type: AT.SET_PLAYER,
        payload: (p: Player) => {
            const progress = p.eventChainProgress || {};
            if ((progress[ref.chainId] ?? 0) !== ref.step) return p;
            const rewarded = itemName ? addItemByName(p, itemName) : p;
            return { ...rewarded, eventChainProgress: { ...progress, [ref.chainId]: ref.step + 1 } };
        },
    });
    if (outcome.log) addLog('success', outcome.log);
    if (itemName) addLog('success', MSG.LOOT_GET(itemName));
};

/**
 * 다른 차원의 묘비 승리 정산(2026-10 Wave 70) — 망령을 이기면 그 묘비의 유품을 준다. 유품은 카탈로그 이름으로 다시 만든
 * 아이템이라 다른 플레이어 문서의 수치(강화 · 위조된 능력치)는 들어오지 않는다. 보상이라 가방 상한을 보지 않는다(보상 소실 금지).
 * 지거나 물러나면 이 함수는 불리지 않는다.
 */
export const applyDimensionGraveVictory = (
    deadEnemy: DefeatedEnemy,
    { dispatch, addLog }: Pick<GameActionDeps, 'dispatch' | 'addLog'>,
) => {
    const ref = deadEnemy?.dimensionGrave;
    if (!ref || typeof ref.itemName !== 'string' || !findItemByName(ref.itemName)) return;
    dispatch({ type: AT.SET_PLAYER, payload: (p: Player) => addItemByName(p, ref.itemName) });
    addLog('success', MSG.DIMENSION_GRAVE_VICTORY(ref.playerName, ref.itemName));
};

/**
 * 보스 처치 유물 보상(Wave 59) — 유물 드랍을 약속한 보스(`mechanics.relicReward`)는 처치 때 유물 선택을 1번 보장한다.
 * 정찰 보장 유물과 달리 유물 칸이 가득 차도 제안한다(선택 화면이 교체 · 넘기기를 보인다). 후보가 없으면(전부 보유) 무동작.
 */
export const applyBossRelicReward = (
    deadEnemy: DefeatedEnemy,
    updatedPlayer: Player,
    { dispatch, addLog, rng }: Pick<GameActionDeps, 'dispatch' | 'addLog'> & { rng: () => number },
) => {
    if (!deadEnemy?.isBoss || !deadEnemy.mechanics?.relicReward) return;
    const relicUnlocks = getPrestigeUnlocks(updatedPlayer.meta?.prestigeRank);
    const candidates = pickBossRewardRelics(updatedPlayer, deadEnemy, relicUnlocks.relicChoices, rng);
    if (candidates.length === 0) return;
    dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
    addLog('event', MSG.BOSS_RELIC_REWARD(deadEnemy.baseName || deadEnemy.name || ''));
};
