import { ITEMS } from '../data/items.js';
import { DB } from '../data/db.js';
import { BOSS_MONSTERS } from '../data/monsters.js';
import { getWeaponMagicSkills, isTwoHandWeapon, isShield, isWeapon } from './equipmentUtils.js';
import { DEFAULT_EXPLORE_STATE } from './explorationPacing.js';
import { TITLES, TITLE_PASSIVES } from '../data/titles.js';
import { getRunBuildProfile, getTraitSkill } from './runProfileUtils.js';
import { calcPerformanceScore, getDifficultyMults } from '../systems/DifficultyManager.js';

// --- 공유 유틸리티 (Shared Utilities) ---
/** 배열이 아닌 값을 빈 배열로 안전하게 변환 */
export const toArray = (v) => (Array.isArray(v) ? v : []);

/** 플레이어의 직업 스킬 목록을 반환 (패시브 제외 — 전투용 액티브 스킬만) */
export const getJobSkills = (player) => {
    const classSkills = toArray(DB.CLASSES[player?.job]?.skills).filter(s => !s.passive);
    const weaponSkills = getWeaponMagicSkills(player?.equip);
    const traitSkill = getTraitSkill(player);
    return [...classSkills, ...weaponSkills, ...(traitSkill ? [traitSkill] : [])];
};

/**
 * 현재 직업의 패시브 스킬 보너스 계산
 * @param {object} player
 * @returns {{ hp: number, mp: number, atk: number, def: number }}
 */
export const getPassiveSkillBonuses = (player) => {
    const cls = DB.CLASSES[player?.job];
    const bonus = { hp: 0, mp: 0, atk: 0, def: 0, lowHpAtkMult: 1 };
    if (!cls) return bonus;
    toArray(cls.skills).filter(s => s.passive).forEach(s => {
        if (s.effect === 'hp_up') bonus.hp += (s.val || 0);
        if (s.effect === 'mp_up') bonus.mp += (s.val || 0);
        if (s.effect === 'atk_up') bonus.atk += (s.val || 0);
        if (s.effect === 'def_up') bonus.def += (s.val || 0);
        // low_hp_atk: HP 30% 이하 시 ATK 배율 (무당 죽음의 직관)
        if (s.effect === 'low_hp_atk' && s.val) {
            const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 150);
            if (hpRatio < 0.3) bonus.lowHpAtkMult = Math.max(bonus.lowHpAtkMult, s.val);
        }
    });
    return bonus;
};

/** 티어 → 등급 자동 매핑 */
const TIER_TO_RARITY = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic', 5: 'legendary', 6: 'legendary' };

/** 아이템 등급 반환 (명시적 rarity 우선, 없으면 tier 기반 자동 매핑) */
export const getItemRarity = (item) => item?.rarity || TIER_TO_RARITY[item?.tier] || 'common';

/** 아이템 인스턴스 생성 (고유 ID 부여) */
export const makeItem = (template) => ({
    ...template,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

/** 전체 DB 아이템 목록을 하나의 배열로 반환 */
export const getAllItems = () => [
    ...toArray(DB.ITEMS?.consumables),
    ...toArray(DB.ITEMS?.weapons),
    ...toArray(DB.ITEMS?.armors),
    ...toArray(DB.ITEMS?.materials)
];

/** 이름으로 아이템을 찾아 반환 */
export const findItemByName = (name) => getAllItems().find((i) => i.name === name);

/** 일일 프로토콜 진행으로 이번 액션에서 막 완료될 미션 목록 반환 */
export const getDailyProtocolCompletions = (player, type, amount = 1) => {
    const missions = toArray(player?.stats?.dailyProtocol?.missions);
    return missions.filter((mission) => (
        mission?.type === type
        && !mission.done
        && ((mission.progress || 0) + amount) >= mission.goal
    ));
};

/** 일일 프로토콜 보상 텍스트 포맷 */
export const formatDailyProtocolReward = (reward = {}) => {
    if (reward.essence) return `에센스 ${reward.essence}`;
    if (reward.item) return reward.item;
    if (reward.relicShard) return `유물 조각 ${reward.relicShard}`;
    return '보상';
};

/** 일반 보상 텍스트 배열 포맷 */
export const formatRewardParts = (reward = {}) => {
    const parts = [];
    if (reward.exp) parts.push(`EXP ${reward.exp}`);
    if (reward.gold) parts.push(`${reward.gold}G`);
    if (reward.item) parts.push(reward.item);
    if (reward.essence) parts.push(`에센스 ${reward.essence}`);
    if (reward.relicShard) parts.push(`유물 조각 ${reward.relicShard}`);
    return parts;
};

/** 칭호 메타데이터 조회 */
export const getTitleDefinition = (token) => TITLES.find((title) => title.id === token) || null;

/** 칭호 표시 이름 반환 (ID 또는 문자열 모두 지원) */
export const getTitleLabel = (token) => {
    if (!token) return '';
    return getTitleDefinition(token)?.name || String(token);
};

/** 칭호 색상 반환 */
export const getTitleColor = (token) => getTitleDefinition(token)?.color || 'text-cyber-purple';

/** 칭호 패시브 메타 조회 */
export const getTitlePassive = (token) => {
    if (!token) return null;
    return TITLE_PASSIVES[token] || null;
};

/** 칭호 패시브 표시 문구 */
export const getTitlePassiveLabel = (token) => {
    const passive = getTitlePassive(token);
    return passive?.label || '패시브 없음';
};

/**
 * 아이템/몬스터를 도감에 등록 (immutable — 새 player 반환)
 * @param {object} player
 * @param {'weapons'|'armors'|'shields'|'monsters'|'recipes'|'materials'} category
 * @param {string} name
 */
export const registerCodex = (player, category, name) => {
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
                [category]: { ...cat, [name]: { discovered: true, obtainedAt: Date.now() } },
            },
        },
    };
};

/**
 * loot 아이템 배열을 codex에 일괄 등록
 */
export const registerLootToCodex = (player, lootItems) => {
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

/** 골드 획득을 누적 통계와 함께 반영 */
export const grantGold = (player, amount = 0) => {
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
export const getActiveQuestEntries = (player) => (
    toArray(player?.quests)
        .map((questState) => {
            const quest = questState?.isBounty
                ? questState
                : DB.QUESTS.find((entry) => entry.id === questState?.id);
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
export const getAchievementCurrentValue = (achievement, player) => {
    const stats = player?.stats || {};
    const target = achievement?.target;
    if (target === 'level') return player?.level || 0;
    if (target === 'prestige') return player?.meta?.prestigeRank || 0;
    if (target === 'synths') return stats?.syntheses || 0;
    if (target === 'discoveries') return Object.keys(stats?.visitedMaps || {}).length;
    if (target === 'relicCount') return (player?.relics || []).length + (stats?.relicCount || 0);
    return stats?.[target] || 0;
};

/** 업적 달성 여부 */
export const isAchievementUnlocked = (achievement, player) => (
    getAchievementCurrentValue(achievement, player) >= (achievement?.goal || 0)
);

// Milestone Utility
export const checkMilestones = (killRegistry, lastKillName) => {
    const rewards = [];
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
export const migrateData = (rawData) => {
    if (!rawData) return null;
    // Deep clone to avoid mutating the Firestore snapshot directly
    const savedData = JSON.parse(JSON.stringify(rawData));

    // Target the specific player object if clear structure exists
    // If savedData IS the player (old flat format?), use it.
    // But in this app, usually savedData matches App state structure.
    let target = savedData.player || savedData;

    // Version Limit
    if (!savedData.version || savedData.version < 2.7) {
        savedData.version = 2.7;

        target.mp = target.mp ?? 50;
        target.maxMp = target.maxMp ?? 50;
        target.history = target.history || [];
        target.archivedHistory = target.archivedHistory || []; // Ensure archivedHistory exists

        // New stats for v3.1
        target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0 };
        target.stats.killRegistry = target.stats.killRegistry || {};
        target.stats.bossKills = target.stats.bossKills || 0;
        target.stats.rests = target.stats.rests || 0;
    }

    // Ensure equip is object not string (Old version compatibility)
    target.equip = target.equip || {};
    if (typeof target.equip?.weapon === 'string') {
        target.equip.weapon = ITEMS.weapons.find(w => w.name === target.equip.weapon) || ITEMS.weapons[0];
    }
    if (typeof target.equip?.armor === 'string') {
        target.equip.armor = ITEMS.armors.find(a => a.name === target.equip.armor) || ITEMS.armors[0];
    }
    if (typeof target.equip?.offhand === 'string') {
        const shield = ITEMS.armors.find(a => a.type === 'shield' && a.name === target.equip.offhand);
        const weapon = ITEMS.weapons.find(w => w.name === target.equip.offhand);
        target.equip.offhand = shield || weapon || null;
    }
    if (!target.equip.weapon || !isWeapon(target.equip.weapon)) {
        target.equip.weapon = ITEMS.weapons[0];
    }
    if (!target.equip.armor || target.equip.armor.type !== 'armor') {
        target.equip.armor = ITEMS.armors.find(a => a.type === 'armor') || ITEMS.armors[0];
    }
    if (target.equip.offhand && !isShield(target.equip.offhand) && !isWeapon(target.equip.offhand)) {
        target.equip.offhand = null;
    }
    if (isTwoHandWeapon(target.equip.weapon)) {
        target.equip.offhand = null;
    }

    // Modern runtime fields (safe defaults for older saves)
    target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
    target.tempBuff.atk = target.tempBuff.atk || 0;
    target.tempBuff.def = target.tempBuff.def || 0;
    target.tempBuff.turn = target.tempBuff.turn || 0;
    target.status = Array.isArray(target.status) ? target.status : [];
    target.skillLoadout = target.skillLoadout || { selected: 0, cooldowns: {} };
    target.skillLoadout.selected = Number.isInteger(target.skillLoadout.selected) ? target.skillLoadout.selected : 0;
    target.skillLoadout.cooldowns = target.skillLoadout.cooldowns || {};
    target.meta = target.meta || { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 };
    target.meta.essence = target.meta.essence || 0;
    target.meta.rank = target.meta.rank || 0;
    target.meta.bonusAtk = target.meta.bonusAtk || 0;
    target.meta.bonusHp = target.meta.bonusHp || 0;
    target.meta.bonusMp = target.meta.bonusMp || 0;
    target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0 };
    target.stats.rests = target.stats.rests || 0;
    target.stats.bountyDate = target.stats.bountyDate || null;
    target.stats.bountyIssued = Boolean(target.stats.bountyIssued);
    target.stats.bountiesCompleted = target.stats.bountiesCompleted || 0;
    target.stats.claimedAchievements = Array.isArray(target.stats.claimedAchievements) ? target.stats.claimedAchievements : [];
    target.stats.visitedMaps = Array.isArray(target.stats.visitedMaps) ? target.stats.visitedMaps : [];
    target.stats.exploreState = { ...DEFAULT_EXPLORE_STATE, ...(target.stats.exploreState || {}) };
    if (target.loc && !target.stats.visitedMaps.includes(target.loc)) {
        target.stats.visitedMaps.push(target.loc);
    }

    if (!Array.isArray(savedData.quickSlots)) {
        savedData.quickSlots = [null, null, null];
    } else {
        savedData.quickSlots = savedData.quickSlots.slice(0, 3);
        while (savedData.quickSlots.length < 3) savedData.quickSlots.push(null);
    }
    savedData.onboardingDismissed = Boolean(savedData.onboardingDismissed);

    // v4.0 — 신규 필드 기본값 (기존 세이브 호환)
    target.relics = Array.isArray(target.relics) ? target.relics : [];
    target.titles = Array.isArray(target.titles) ? target.titles : [];
    target.activeTitle = target.activeTitle || null;
    target.combatFlags = {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: Boolean(target.combatFlags?.voidHeartUsed),
        voidHeartArmed: Boolean(target.combatFlags?.voidHeartArmed),
    };
    target.meta.prestigeRank    = target.meta.prestigeRank    || 0;
    target.meta.totalPrestigeAtk = target.meta.totalPrestigeAtk || 0;
    target.meta.totalPrestigeHp  = target.meta.totalPrestigeHp  || 0;
    target.meta.totalPrestigeMp  = target.meta.totalPrestigeMp  || 0;
    target.stats.relicCount      = target.stats.relicCount      || 0;
    target.stats.comboCount      = target.stats.comboCount      || 0;
    target.stats.crafts          = target.stats.crafts          || 0;
    target.stats.discoveries     = target.stats.discoveries     || 0;
    target.stats.buildWins       = target.stats.buildWins && typeof target.stats.buildWins === 'object' ? target.stats.buildWins : {};
    target.stats.abyssFloor      = target.stats.abyssFloor      || 0;
    target.stats.demonKingSlain  = target.stats.demonKingSlain  || 0;
    target.stats.dailyProtocol   = target.stats.dailyProtocol   || null;
    // pendingRelics는 런타임 전용 — 저장 불필요, 로드 시 null로 초기화
    savedData.pendingRelics = null;

    // v4.1 — 도감(Codex) + 프리미엄 재화
    if (!target.stats.codex) {
        target.stats.codex = { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} };
        // 기존 인벤토리에서 codex 부트스트랩
        for (const item of toArray(target.inv)) {
            const cat = item.type === 'weapon' ? 'weapons'
                : item.type === 'armor' ? 'armors'
                : item.type === 'shield' ? 'shields'
                : item.type === 'mat' ? 'materials' : null;
            if (cat && item.name) {
                target.stats.codex[cat][item.name] = { discovered: true, obtainedAt: Date.now() };
            }
        }
        // 기존 장비에서도 부트스트랩
        for (const slot of ['weapon', 'armor', 'offhand']) {
            const eq = target.equip?.[slot];
            if (eq?.name) {
                const cat = eq.type === 'weapon' ? 'weapons'
                    : eq.type === 'armor' ? 'armors'
                    : eq.type === 'shield' ? 'shields' : null;
                if (cat) target.stats.codex[cat][eq.name] = { discovered: true, obtainedAt: Date.now() };
            }
        }
        // killRegistry에서 몬스터 codex 부트스트랩
        for (const [name, kills] of Object.entries(target.stats.killRegistry || {})) {
            if (kills > 0) {
                target.stats.codex.monsters[name] = { discovered: true, kills };
            }
        }
    }
    target.premiumCurrency = target.premiumCurrency || 0;
    target.stats.codexClaimed = Array.isArray(target.stats.codexClaimed) ? target.stats.codexClaimed : [];

    // v4.2 — 시즌 패스
    if (!target.seasonPass) {
        target.seasonPass = { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    }

    // v4.3 — 강화, 주간 미션, 챌린지, 스킬 분기, 묘비 침략
    if (!target.weeklyProtocol) {
        target.weeklyProtocol = { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
    }
    target.skillChoices = target.skillChoices && typeof target.skillChoices === 'object' ? target.skillChoices : {};
    target.challengeModifiers = Array.isArray(target.challengeModifiers) ? target.challengeModifiers : [];
    target.stats.dailyInvadeCount = target.stats.dailyInvadeCount || 0;
    target.stats.lastInvadeDate   = target.stats.lastInvadeDate   || null;
    // 인벤 아이템에 enhance 기본값 보장
    if (Array.isArray(target.inv)) {
        target.inv = target.inv.map((item) => item ? { ...item, enhance: item.enhance || 0 } : item);
    }

    // v5.0 — 진 엔딩, 이벤트 체인, 시너지
    if (!target.eventChainProgress || typeof target.eventChainProgress !== 'object') {
        target.eventChainProgress = {};
    }
    // 구역 보스 처치 기록 (런별 리셋)
    target.stats.areaBossDefeated = target.stats.areaBossDefeated || {};
    // combatFlags 신규 필드 — 다중 부활 카운터
    if (target.combatFlags) {
        target.combatFlags.deathSaveUsedCount = target.combatFlags.deathSaveUsedCount || 0;
    }
    // Kill Streak 필드 마이그레이션
    if (typeof target.killStreak !== 'number') {
        target.killStreak = 0;
    }
    // 진 엔딩 파편 카운터
    target.meta.trueEndingFragments = target.meta.trueEndingFragments || 0;

    // 발견 체인 완료 기록
    target.stats.discoveryChains = Array.isArray(target.stats.discoveryChains) ? target.stats.discoveryChains : [];

    // 접두사 마이그레이션 — prefixed 플래그가 있지만 prefixName 누락된 아이템 보강
    const fixPrefixedItem = (item) => {
        if (!item || !item.prefixed) return item;
        if (!item.prefixName && item.name) {
            // 이름에서 접두사 추출 시도 (첫 번째 공백 기준)
            const parts = item.name.split(' ');
            if (parts.length > 1) {
                item.prefixName = parts[0];
            }
        }
        return item;
    };
    if (Array.isArray(target.inv)) {
        target.inv = target.inv.map(fixPrefixedItem);
    }
    if (target.equip) {
        target.equip.weapon = fixPrefixedItem(target.equip.weapon);
        target.equip.armor = fixPrefixedItem(target.equip.armor);
        target.equip.offhand = fixPrefixedItem(target.equip.offhand);
    }

    return savedData;
};

/**
 * 달성 칭호 체크 — 현재 player 상태를 기반으로 새로 획득한 칭호 ID 배열 반환
 * @param {object} player
 * @returns {string[]} 새로 해금된 칭호 ID 목록
 */
export const checkTitles = (player) => {
    const existing = new Set(player.titles || []);
    return TITLES.filter(t => {
        if (existing.has(t.id)) return false;
        const { type, val } = t.cond;
        if (type === 'kills')          return (player.stats?.kills         || 0) >= val;
        if (type === 'bossKills')      return (player.stats?.bossKills     || 0) >= val;
        if (type === 'level')          return player.level >= val;
        if (type === 'deaths')         return (player.stats?.deaths        || 0) >= val;
        if (type === 'total_gold')     return (player.stats?.total_gold    || 0) >= val;
        if (type === 'rests')          return (player.stats?.rests         || 0) >= val;
        if (type === 'relicCount')     return (player.stats?.relicCount    || 0) >= val;
        if (type === 'prestige')       return (player.meta?.prestigeRank   || 0) >= val;
        if (type === 'abyssFloor')     return (player.stats?.abyssFloor    || 0) >= val;
        if (type === 'bountyDone')     return (player.stats?.bountiesCompleted || 0) >= val;
        if (type === 'crafts')         return (player.stats?.crafts        || 0) >= val;
        if (type === 'demonKingSlain') return (player.stats?.demonKingSlain || 0) >= val;
        if (type === 'noDeathWin')     return (player.stats?.demonKingSlain || 0) >= val && (player.stats?.deaths || 0) === 0;
        return false;
    }).map(t => t.id);
};

/**
 * 타이틀 획득 로그를 처리하는 함수를 생성합니다.
 * useCombatActions, useGameActions, useInventoryActions에서 동일하게 쓰이는 패턴을 통합합니다.
 * @param {Function} dispatch - Redux dispatch
 * @param {Function} addLog - 로그 출력 함수
 * @returns {Function} (updatedPlayer) => void
 */
export const makeEmitTitles = (dispatch, addLog) => (updatedPlayer) => {
    const newTitles = checkTitles(updatedPlayer);
    if (newTitles.length > 0) {
        dispatch({ type: 'UNLOCK_TITLES', payload: newTitles });
        newTitles.forEach((id) => addLog('system', `🏆 칭호 획득: [${getTitleLabel(id)}]`));
    }
};

/**
 * 런 종료 요약(RunSummary) 데이터를 생성 (#1 — 중복 코드 제거)
 * useCombatActions의 전투 패배 / 도주 실패 사망 두 경로에서 공통으로 사용.
 * @param {object} player - 최종 플레이어 상태
 * @param {string} loc - 사망 위치 (player.loc).
 */
export const buildRunSummary = (player, loc) => {
    const buildProfile = getRunBuildProfile(player, { maxHp: player.maxHp });
    const recentBattles = (player.stats?.recentBattles || []).slice(-20);

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
        buildTags:    buildProfile.tags.map((tag) => tag.name).slice(0, 4),
        difficultyLabel: getDifficultyMults(calcPerformanceScore(player)).label,
        recentWinRate: recentBattles.length > 0
            ? Math.round((recentBattles.filter((battle) => battle.result === 'win').length / recentBattles.length) * 100)
            : null,
    };
};
