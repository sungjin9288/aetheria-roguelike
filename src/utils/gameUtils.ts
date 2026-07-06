import { ITEMS } from '../data/items.js';
import type { Item, Player } from "../types/index.js";
import { DB } from '../data/db.js';
import { BOSS_MONSTERS } from '../data/monsters.js';
import { getWeaponMagicSkills } from './equipmentUtils.js';
import { DEFAULT_EXPLORE_STATE } from './explorationPacing.js';
import { TITLES, TITLE_PASSIVES } from '../data/titles.js';
import { PREMIUM_SHOP } from '../data/premiumShop.js';
import { getRunBuildProfile, getTraitSkill } from './runProfileUtils.js';
import { calcPerformanceScore, getDifficultyMults } from '../systems/DifficultyManager.js';
import { AT } from '../reducers/actionTypes.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };

// --- 공유 유틸리티 (Shared Utilities) ---
/** 배열이 아닌 값을 빈 배열로 안전하게 변환 */
export const toArray = (v: any) => (Array.isArray(v) ? v : []);

/** 플레이어의 직업 스킬 목록을 반환 (패시브 제외 — 전투용 액티브 스킬만) */
export const getJobSkills = (player: Player) => {
    const classSkills = toArray(DB.CLASSES[player?.job as string]?.skills).filter((s: any) => !s.passive);
    // cycle 631: equip || {} 명시 — explicit default-elimination caller-side
    //   conversion. player.equip undefined인 경우 getWeaponMagicSkills 내부
    //   default {} 의존이었으나 cycle 631에서 default 제거.
    const weaponSkills = getWeaponMagicSkills(player?.equip || {});
    // cycle 613: stats 인자 명시 추가 — explicit default-elimination cascade.
    const traitSkill = getTraitSkill(player, {});
    return [...classSkills, ...weaponSkills, ...(traitSkill ? [traitSkill] : [])];
};

/**
 * 현재 직업의 패시브 스킬 보너스 계산
 * @param {object} player
 * @returns {{ hp: number, mp: number, atk: number, def: number }}
 */
export const getPassiveSkillBonuses = (player: Player) => {
    const cls = DB.CLASSES[player?.job as string];
    const bonus = { hp: 0, mp: 0, atk: 0, def: 0, crit: 0, goldMult: 0, expMult: 0, lowHpAtkMult: 1 };
    if (!cls) return bonus;
    toArray(cls.skills).filter((s: any) => s.passive).forEach((s: any) => {
        if (s.effect === 'hp_up')   bonus.hp   += (s.val || 0);
        if (s.effect === 'mp_up')   bonus.mp   += (s.val || 0);
        if (s.effect === 'atk_up')  bonus.atk  += (s.val || 0);
        if (s.effect === 'def_up')  bonus.def  += (s.val || 0);
        // crit_up: 크리티컬 확률 보너스 (도적/암살자/마법사 계열)
        if (s.effect === 'crit_up') bonus.crit += (s.val || 0);
        // gold_up: 골드 획득량 배율 보너스 (레인저/사냥꾼 계열)
        if (s.effect === 'gold_up') bonus.goldMult += (s.val || 0);
        // exp_up: 경험치 획득량 배율 보너스 (성직자/팔라딘 계열)
        if (s.effect === 'exp_up')  bonus.expMult  += (s.val || 0);
        // low_hp_atk: HP 30% 이하 시 ATK 배율 (무당 죽음의 직관)
        if (s.effect === 'low_hp_atk' && s.val) {
            const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 150);
            if (hpRatio < 0.3) bonus.lowHpAtkMult = Math.max(bonus.lowHpAtkMult, s.val);
        }
    });
    return bonus;
};

/** 티어 → 등급 자동 매핑 */
const TIER_TO_RARITY: any = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic', 5: 'legendary', 6: 'legendary' };

/** 아이템 등급 반환 (명시적 rarity 우선, 없으면 tier 기반 자동 매핑) */
export const getItemRarity = (item: Item | null | undefined) => item?.rarity || TIER_TO_RARITY[item?.tier ?? 0] || 'common';

/** 아이템 인스턴스 생성 (고유 ID 부여) */
export const makeItem = (template: Item | null | undefined): Item => ({
    ...template,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

/** 전체 DB 아이템 목록을 하나의 배열로 반환 */
// cycle 293: export 제거 — findItemByName 내부 1회만 사용, 외부 consumer 0건.
const getAllItems = () => [
    ...toArray(DB.ITEMS?.consumables),
    ...toArray(DB.ITEMS?.weapons),
    ...toArray(DB.ITEMS?.armors),
    ...toArray(DB.ITEMS?.materials)
];

/** 이름으로 아이템을 찾아 반환 */
export const findItemByName = (name: any) => getAllItems().find((i: any) => i.name === name);

/**
 * 일일 프로토콜 진행으로 이번 액션에서 막 완료될 미션 목록 반환
 *
 * cycle 504: amount default 1 제거 — 3 wrapper (emitDailyProtocolLogs)가 모두
 *   자체 amount default를 가지지만 wrapper의 외부 호출자 5건 모두 amount 명시
 *   전달. cascade로 wrapper / leaf default 모두 도달 불가.
 */
export const getDailyProtocolCompletions = (player: Player, type: any, amount: any) => {
    const missions = toArray(player?.stats?.dailyProtocol?.missions);
    return missions.filter((mission: any) => (
        mission?.type === type
        && !mission.done
        && ((mission.progress || 0) + amount) >= mission.goal
    ));
};

/** 일일 프로토콜 보상 텍스트 포맷 */
// cycle 556: reward default {} 제거 — 3 callers (useInventoryActions/_shared/
//   useCombatActions) 모두 mission.reward 명시 전달이라 default 도달 불가.
//   gameUtils.ts 같은 모듈 batch (cycle 502-555 default 청소 50번째).
export const formatDailyProtocolReward = (reward: any) => {
    if (reward.essence) return `에센스 ${reward.essence}`;
    if (reward.item) return reward.item;
    if (reward.relicShard) return `유물 조각 ${reward.relicShard}`;
    return '보상';
};

/** 일반 보상 텍스트 배열 포맷
 *
 *  cycle 407: essence / relicShard 분기 제거 — 호출 사이트
 *  (AchievementPanel / QuestTab / QuestBoardPanel)는 quest/achievement
 *  reward만 전달. quests.ts/achievements에 essence/relicShard 0건이라 unreachable.
 *  daily protocol mission reward는 formatDailyProtocolReward로 별도 처리.
 */
// cycle 556: reward default {} 제거 — 3 callers (QuestBoardPanel/QuestTab/
//   AchievementPanel) 모두 reward 명시 전달이라 default 도달 불가.
export const formatRewardParts = (reward: any) => {
    const parts: any[] = [];
    if (reward.exp) parts.push(`EXP ${reward.exp}`);
    if (reward.gold) parts.push(`${reward.gold}G`);
    if (reward.item) parts.push(reward.item);
    return parts;
};

/** 칭호 메타데이터 조회 */
export const getTitleDefinition = (token: any) => TITLES.find((title: any) => title.id === token) || null;

/** 칭호 표시 이름 반환 (ID 또는 문자열 모두 지원) */
export const getTitleLabel = (token: any) => {
    if (!token) return '';
    return getTitleDefinition(token)?.name || String(token);
};

/** 칭호 색상 반환 */
export const getTitleColor = (token: any) => getTitleDefinition(token)?.color || 'text-cyber-purple';

/** 칭호 패시브 메타 조회 */
export const getTitlePassive = (token: any) => {
    if (!token) return null;
    return TITLE_PASSIVES[token] || null;
};

/** 칭호 패시브 표시 문구 */
export const getTitlePassiveLabel = (token: any) => {
    const passive = getTitlePassive(token);
    return passive?.label || '패시브 없음';
};

/**
 * 아이템/몬스터를 도감에 등록 (immutable — 새 player 반환)
 * @param {object} player
 * @param {'weapons'|'armors'|'shields'|'monsters'|'recipes'|'materials'} category
 * @param {string} name
 */
export const registerCodex = (player: Player, category: any, name: any) => {
    if (!name || !category) return player;
    const codex = player.stats?.codex || {};
    const cat = codex[category] || {};
    if (cat[name]) return player; // 이미 등록됨
    return {
        ...player,
        stats: {
            ...player.stats,
            codex: {
                ...codex,
                // cycle 438: timestamp 출력 dead 제거 — production read 0건.
                //   codex consumer는 `codex[cat][name]` truthy check 또는 Object.keys
                //   count만 사용. discovered 필드만 의미 있음.
                [category]: { ...cat, [name]: { discovered: true } },
            },
        },
    };
};

/**
 * cycle 193: 신규 codex 등록 수 카운트 — SEASON_XP.codexDiscover dispatch 신호용.
 *   registerCodex/registerLootToCodex 호출 전후 codex 카테고리 사이즈 비교로 카운트.
 */
const countCodexEntries = (player: Player) => {
    const codex: any = player.stats?.codex || {};
    let total = 0;
    for (const cat of Object.values(codex)) {
        if (cat && typeof cat === 'object') total += Object.keys(cat as any).length;
    }
    return total;
};

/**
 * loot 아이템 배열을 codex에 일괄 등록
 * @returns updated player (caller가 prev player와 countCodexEntries 비교로 신규 수 판정).
 */
export const registerLootToCodex = (player: Player, lootItems: any) => {
    let p = player;
    for (const item of lootItems) {
        const cat = item.type === 'weapon' ? 'weapons'
            : item.type === 'armor' ? 'armors'
            : item.type === 'shield' ? 'shields'
            : item.type === 'mat' ? 'materials' : null;
        if (cat) p = registerCodex(p, cat, item.name);
    }
    return p;
};

/**
 * cycle 193: 신규 codex 등록 수 헬퍼 — 호출 전후 비교용.
 *   SEASON_XP.codexDiscover 적용 시 caller 패턴: const before = countNewCodexEntries(player);
 *   ... registerLootToCodex 등 호출 후 ... const newCount = countNewCodexEntries(updated) - before;
 *   if (newCount > 0) dispatch ADD_SEASON_XP * newCount.
 */
export const countNewCodexEntries = (player: Player) => countCodexEntries(player);

/**
 * 골드 획득을 누적 통계와 함께 반영
 *
 * cycle 505: amount default 0 제거 — 9+ callsite 모두 amount 명시 전달이라
 *   default 도달 불가. body의 `if (!amount) return player` defensive guard는
 *   caller가 0을 넘기는 케이스에서 활성이라 보존.
 */
export const grantGold = (player: Player, amount: any) => {
    if (!amount) return player;
    const stats = player.stats || {};
    return {
        ...player,
        gold: (player.gold || 0) + amount,
        stats: {
            ...stats,
            total_gold: (stats.total_gold || 0) + Math.max(0, amount),
        }
    };
};

/** 플레이어의 활성 퀘스트를 화면 렌더링용으로 정규화 */
export const getActiveQuestEntries = (player: Player) => (
    toArray(player?.quests)
        .map((questState: any) => {
            const quest = questState?.isBounty
                ? questState
                : DB.QUESTS.find((entry: any) => entry.id === questState?.id);
            if (!quest) return null;

            const progress = questState?.progress || 0;
            return {
                id: questState.id,
                quest,
                progress,
                isBounty: Boolean(questState?.isBounty),
                isComplete: progress >= (quest.goal || 0),
            };
        })
        .filter(Boolean)
);

/** 업적 진행값 계산 */
export const getAchievementCurrentValue = (achievement: any, player: Player) => {
    const stats = player?.stats || {};
    const target = achievement?.target;
    if (target === 'level') return player?.level || 0;
    if (target === 'prestige') return player?.meta?.prestigeRank || 0;
    if (target === 'synths') return stats?.syntheses || 0;
    if (target === 'discoveries') return Object.keys(stats?.visitedMaps || {}).length;
    // cycle 95: 휘발성 killStreak는 매번 0으로 리셋되므로 max-ever 누적 카운터를 읽음.
    if (target === 'maxKillStreak') return stats?.maxKillStreak || 0;
    // cycle 101: stats.relicCount 단일 source of truth — ADD_RELIC handler가
    // player.relics에 push와 stats.relicCount++ 둘 다 수행하므로, relics.length를
    // 추가로 더하면 현재 런의 relic이 double count됨. 이전엔 ach_relic_5("유물 5개")
    // 가 실제로 3개에서 풀리던 부풀림 회귀를 fix. checkTitles('relicCount')와도 정합.
    if (target === 'relicCount') return stats?.relicCount || 0;
    // cycle 102: 발견 체인(BALANCE.DISCOVERY_CHAINS) 완료 카운트 — exploreUtils
    // checkDiscoveryChains가 stats.discoveryChains 배열에 완료 ID push.
    if (target === 'discoveryChains') return Array.isArray(stats?.discoveryChains) ? stats.discoveryChains.length : 0;
    if (target === 'signaturesDiscovered') return countDiscoveredSignatures(player);
    if (target === 'signatureSetsCompleted') return countCompletedSignatureSets(player);
    return stats?.[target] || 0;
};

const RESOLVE_BUCKET_BY_TYPE: any = Object.freeze({
    weapon: 'weapons',
    shield: 'shields',
    armor: 'armors',
});

const SIGNATURE_REGISTRY_ENTRIES: Record<string, any> = signatureRegistryData?.entries || {};
const SIGNATURE_SETS_MAP = signatureSetsData?.sets || {};

const isSignatureDiscovered = (itemName: any, player: Player) => {
    const codex = player?.stats?.codex;
    if (!codex) return false;
    const all = [
        ...(DB.ITEMS?.weapons || []),
        ...(DB.ITEMS?.armors || []),
    ];
    const item = all.find((entry: any) => entry?.name === itemName);
    if (!item) return false;
    const bucket = RESOLVE_BUCKET_BY_TYPE[item.type ?? ''];
    if (!bucket) return false;
    return Boolean(codex[bucket]?.[itemName]);
};

// cycle 75: export — checkTitles / questProgress의 signature_collect 핸들러가
// codex.{weapons,armors,shields} 합집합 크기로 근사하던 것을 정확한
// SIGNATURE_REGISTRY 교집합 카운트로 교체할 수 있도록 노출.
export const countDiscoveredSignatures = (player: Player) => {
    let count = 0;
    for (const name of Object.keys(SIGNATURE_REGISTRY_ENTRIES)) {
        if (isSignatureDiscovered(name, player)) count += 1;
    }
    return count;
};

const countCompletedSignatureSets = (player: Player) => {
    let count = 0;
    for (const setDef of Object.values(SIGNATURE_SETS_MAP) as any[]) {
        const members = setDef?.members || [];
        if (members.length === 0) continue;
        const allFound = members.every((name: any) => isSignatureDiscovered(name, player));
        if (allFound) count += 1;
    }
    return count;
};

/** 업적 달성 여부 */
export const isAchievementUnlocked = (achievement: any, player: Player) => (
    getAchievementCurrentValue(achievement, player) >= (achievement?.goal || 0)
);

// Milestone Utility
export const checkMilestones = (killRegistry: any, lastKillName: any) => {
    const rewards: any[] = [];
    const count = killRegistry[lastKillName] || 0;

    // 1. Monster Count Milestones
    if (count === 10) rewards.push({ type: 'gold', val: 100, msg: `🥉 [${lastKillName}] 사냥꾼 (10마리 처치)` });
    if (count === 50) rewards.push({ type: 'item', val: '하급 체력 물약', msg: `🥈 [${lastKillName}] 학살자 (50마리 처치)` });
    if (count === 100) rewards.push({ type: 'item', val: '강철 롱소드', msg: `🥇 [${lastKillName}] 지배자 (100마리 처치)` });

    // 2. Boss Milestones
    // Simple check: if name is in a boss list (manual for now, or based on stats)
    // Let's assume high EXP (>200) monsters are bosses for simplicity in this MVP logic or use manual list
    const bosses = BOSS_MONSTERS;
    if (bosses.includes(lastKillName)) {
        if (count === 1) rewards.push({ type: 'title', val: `[${lastKillName}] 처치자`, msg: `👑 [${lastKillName}] 최초 처치!` });
        if (count === 5) rewards.push({ type: 'gold', val: 5000, msg: `👑 [${lastKillName}] 숙련자 (5회 처치)` });
    }

    return rewards;
};

// Data Migration Utility
export { migrateData } from './dataMigration.js';

/**
 * 달성 칭호 체크 — 현재 player 상태를 기반으로 새로 획득한 칭호 ID 배열 반환
 * @param {object} player
 * @returns {string[]} 새로 해금된 칭호 ID 목록
 */
export const checkTitles = (player: Player) => {
    const existing = new Set(player.titles || []);
    return TITLES.filter((t: any) => {
        if (existing.has(t.id)) return false;
        const { type, val } = t.cond;
        if (type === 'kills')          return (player.stats?.kills         || 0) >= val;
        if (type === 'bossKills')      return (player.stats?.bossKills     || 0) >= val;
        if (type === 'level')          return (player.level ?? 0) >= val;
        if (type === 'deaths')         return (player.stats?.deaths        || 0) >= val;
        if (type === 'total_gold')     return (player.stats?.total_gold    || 0) >= val;
        if (type === 'rests')          return (player.stats?.rests         || 0) >= val;
        if (type === 'relicCount')     return (player.stats?.relicCount    || 0) >= val;
        if (type === 'prestige')       return (player.meta?.prestigeRank   || 0) >= val;
        // cycle 199: 'prestigeRank' cond.type — cycle 197에서 PRESTIGE_TITLES 10종을 정식 등록할
        //   때 도입. ASCEND가 직접 newTitle을 grant하지만 checkTitles에도 fallback handler를 추가해
        //   복구 케이스(저장 손실 / 마이그레이션 등) 보호.
        if (type === 'prestigeRank')   return (player.meta?.prestigeRank   || 0) >= val;
        // cycle 201: 'seasonTier' cond.type — cycle 175에서 시즌 패스 보상 칭호 3종(시즌
        //   선구자 / 정복자 / 마스터)을 정식 등록할 때 도입. CLAIM_SEASON_REWARD가 직접 grant하지만
        //   checkTitles에도 fallback handler를 추가해 복구 케이스(저장 손실 / migration 등) 보호.
        //   cycle 199 'prestigeRank' 회귀와 동일 패턴.
        if (type === 'seasonTier')     return ((player as any).seasonPass?.tier || 0) >= val;
        // cycle 260: 'questReward' cond.type — cycle 209 quest reward title grant 후 잔존
        //   누락. claimQuestReward가 직접 grant하지만 checkTitles에 fallback 없어 저장 손실 시
        //   영구 복구 불가하던 회귀. stats.claimedQuestIds 영구 ledger와 매칭. cycle 199 / 201
        //   동일 lens. val = quest id (152/153/154/201/202).
        if (type === 'questReward') {
            const claimedIds = (player.stats as any)?.claimedQuestIds;
            return Array.isArray(claimedIds) && claimedIds.includes(val);
        }
        // cycle 262: 'cosmetic' cond.type — cycle 185 cosmetic 4종 ('별을 보는 자' 등) 정식
        //   등록 후 잔존 누락. purchaseCosmeticTitle이 직접 grant하지만 checkTitles에 fallback
        //   없어 player.titles 손실 시 premium 구매 자산 silent loss. cycle 199/201/260 동일 lens.
        //   매핑: PREMIUM_SHOP.cosmeticTitles[i].name === title.id (Korean) ↔ i.id (영문) ↔ stats.cosmeticTitles 영문 ID.
        if (type === 'cosmetic') {
            const ownedEnglishIds = Array.isArray((player.stats as any)?.cosmeticTitles)
                ? (player.stats as any).cosmeticTitles
                : [];
            if (ownedEnglishIds.length === 0) return false;
            const cosmeticDef = (PREMIUM_SHOP as any)?.cosmeticTitles?.find(
                (c: any) => c?.name === t.id
            );
            return Boolean(cosmeticDef && ownedEnglishIds.includes(cosmeticDef.id));
        }
        if (type === 'abyssFloor')     return (player.stats?.abyssFloor    || 0) >= val;
        if (type === 'abyssRecord')    return (player.stats?.abyssRecord   || 0) >= val;
        if (type === 'bountyDone')     return (player.stats?.bountiesCompleted || 0) >= val;
        if (type === 'crafts')         return (player.stats?.crafts        || 0) >= val;
        // cycle 85: 합성(synthesis) 카운터 — alchemist 칭호용. cycle 82에서 INITIAL_STATE에
        // syntheses:0 declarative하게 추가했고, achievement target='synths'와 동일한 필드를 읽음.
        if (type === 'synths')         return ((player.stats as any)?.syntheses || 0) >= val;
        // cycle 95: 최대 연속 처치 — berserker 칭호용. combatVictory에서 max-ever를 누적.
        if (type === 'maxKillStreak') return ((player.stats as any)?.maxKillStreak || 0) >= val;
        // cycle 103: 발견 체인 — chain_master 칭호용. exploreUtils.checkDiscoveryChains에서
        // stats.discoveryChains 배열에 완료 ID push. cycle 102 achievement target과 동일 source.
        if (type === 'discoveryChains') {
            const chains = (player.stats as any)?.discoveryChains;
            return Array.isArray(chains) && chains.length >= val;
        }
        if (type === 'demonKingSlain') return (player.stats?.demonKingSlain || 0) >= val;
        if (type === 'noDeathWin')     return (player.stats?.demonKingSlain || 0) >= val && (player.stats?.deaths || 0) === 0;
        if (type === 'explores')       return ((player.stats as any)?.explores || 0) >= val;
        // cycle 83: 'discoveries' 시맨틱 통일 — visitedMaps.length(맵 발견 수)로 교체.
        // cartographer("지도 제작자") 칭호가 stats.discoveries(이벤트 카운터)만으로 풀리던
        // 회귀 수정. achievement(target='discoveries') 정합성 기준선과 일치시킴.
        if (type === 'discoveries')    return ((player.stats as any)?.visitedMaps || []).length >= val;
        // cycle 77: 도주 카운터 기반 칭호 (cautious_explorer / survivor_instinct).
        if (type === 'escapes')        return ((player.stats as any)?.escapes || 0) >= val;
        if (type === 'signaturesDiscovered') {
            // cycle 75: codex 합집합 크기 근사 → SIGNATURE_REGISTRY 교집합 정확 카운트로 교체.
            // 기존 근사는 일반 weapon/armor/shield까지 포함되어 칭호가 의도보다 일찍 풀렸음.
            return countDiscoveredSignatures(player) >= val;
        }
        return false;
    }).map((t: any) => t.id);
};

/**
 * 타이틀 획득 로그를 처리하는 함수를 생성합니다.
 * useCombatActions, useGameActions, useInventoryActions에서 동일하게 쓰이는 패턴을 통합합니다.
 * @param {Function} dispatch - Redux dispatch
 * @param {Function} addLog - 로그 출력 함수
 * @returns {Function} (updatedPlayer: any) => void
 */
export const makeEmitTitles = (dispatch: any, addLog: any) => (updatedPlayer: any) => {
    const newTitles = checkTitles(updatedPlayer);
    if (newTitles.length > 0) {
        dispatch({ type: AT.UNLOCK_TITLES, payload: newTitles });
        newTitles.forEach((id: any) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
    }
};

/**
 * 런 종료 요약(RunSummary) 데이터를 생성 (#1 — 중복 코드 제거)
 * useCombatActions의 전투 패배 / 도주 실패 사망 두 경로에서 공통으로 사용.
 * @param {object} player - 최종 플레이어 상태
 * @param {string} loc - 사망 위치 (player.loc).
 */
export const buildRunSummary = (player: Player, loc: any) => {
    const buildProfile = getRunBuildProfile(player, { maxHp: player.maxHp });
    const recentBattles = (player.stats?.recentBattles || []).slice(-20);

    // 이 런에서 획득한 signature — inventory + equip 합산, 중복 제거
    const signatureSet = new Set();
    const collectSignature = (item: any) => {
        if (item?.name && SIGNATURE_REGISTRY_ENTRIES[item.name]) signatureSet.add(item.name);
    };
    (player?.inv || []).forEach(collectSignature);
    collectSignature(player?.equip?.weapon);
    collectSignature(player?.equip?.armor);
    collectSignature(player?.equip?.offhand);
    const signatureNames = [...signatureSet];

    return {
        level:        player.level,
        job:          player.job || '모험가',
        kills:        player.stats?.kills || 0,
        bossKills:    player.stats?.bossKills || 0,
        relicsFound:  player.relics?.length || 0,
        activeTitle:  player.activeTitle || null,
        loc:          loc || player.loc || '???',
        prestigeRank: player.meta?.prestigeRank || 0,
        totalGold:    player.stats?.total_gold || 0,
        primaryBuild: buildProfile.primary.name,
        // cycle 344: buildTags 필드 제거 — RunSummaryCard / runShareText / outcomeAnalysis
        //   어디에서도 summary.buildTags read 0건이던 dead output.
        difficultyLabel: getDifficultyMults(calcPerformanceScore(player)).label,
        recentWinRate: recentBattles.length > 0
            ? Math.round((recentBattles.filter((battle: any) => battle.result === 'win').length / recentBattles.length) * 100)
            : null,
        signaturesAcquired: signatureNames.length,
        signatureNames,
        // cycle 78: 도주 누적 카운트 — RunSummary가 cycle 74의 stats.escapes를
        // reflection 단계에서 노출. RunShareText는 cycle 65 phase 4의
        // primaryBuild/difficulty 라인 다음에 자연스럽게 한 라인 추가 가능.
        escapes: (player.stats as any)?.escapes || 0,
        // cycle 84: 맵 발견 수 — cycle 83에서 'discoveries' 시맨틱을 visitedMaps.length로
        // 통일한 후속 작업. reflection/share 단계에 탐험 폭 자랑 라인을 silence-over-noise
        // 패턴으로 노출.
        discoveries: ((player.stats as any)?.visitedMaps || []).length,
        // cycle 96: 최대 연속 처치 — cycle 95에서 누적된 stats.maxKillStreak를 reflection
        // 으로 노출. berserker 칭호와 같은 데이터 소스.
        maxKillStreak: (player.stats as any)?.maxKillStreak || 0,
    };
};
