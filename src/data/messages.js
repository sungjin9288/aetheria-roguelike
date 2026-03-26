import { DB } from '../data/db';

/**
 * messages.js — 게임 내 모든 메시지를 한국어로 통합 관리합니다.
 * CombatEngine, hooks 등에서 참조하세요.
 */
export const MSG = {
    // --- 전투 (Combat) ---
    COMBAT_ATTACK: (name, dmg, tags = []) =>
        `${name}에게 ${dmg} 피해를 입혔습니다.${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ATTACK_DETAIL: (name, dmg, cur, max, tags = []) =>
        `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`,
    COMBAT_ENEMY_HIT: (name, dmg) => {
        const variants = [
            `${name}이(가) ${dmg} 피해를 가했습니다.`,
            `${name}의 공격! ${dmg} 피해를 받았습니다.`,
            `${name}에게 가격당했습니다. (${dmg})`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_HEAVY_HIT: (name, dmg) => {
        const variants = [
            `${name}의 강타! ${dmg} 피해를 입었습니다.`,
            `${name}이(가) 맹렬하게 공격합니다! ${dmg} 피해!`,
            `강력한 일격! ${name}의 공격에 ${dmg} 피해를 받았습니다.`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    },
    COMBAT_ENEMY_GUARD: (name) => `${name}이(가) 방어 자세를 취했습니다.`,
    COMBAT_ENEMY_STUNNED: (name) => `${name}이(가) 기절하여 턴을 잃습니다.`,
    COMBAT_CRIT: '치명타!',
    COMBAT_WEAKNESS: '속성 약점 적중!',
    COMBAT_RESIST: '적이 속성을 저항했습니다.',

    // --- 스킬 (Skill) ---
    SKILL_USE: (skillName, dmg, name, cur, max) =>
        `[${skillName}]: ${name}에게 ${dmg} 피해! (${cur}/${max})`,
    SKILL_BUFF_ACTIVE: (name, turns) => `[${name}] 버프 활성화 (${turns} 턴)`,
    SKILL_STATUS_BONUS: (effect, dmg) => `[${effect}] 추가 피해 +${dmg}`,
    SKILL_NO_MP: 'MP가 부족합니다.',
    SKILL_ON_COOLDOWN: (name, turns) => `[${name}] 쿨타임: ${turns} 턴`,
    SKILL_NONE: '사용 가능한 스킬이 없습니다.',

    // --- 탈출 (Escape) ---
    ESCAPE_SUCCESS: '성공적으로 탈출했습니다!',
    ESCAPE_FAIL: '탈출 실패!',
    ESCAPE_FAIL_DMG: (name, dmg) => `${name}이(가) 뒤쫓아 ${dmg} 피해를 입혔습니다.`,

    // --- 전투 결과 (Victory / Defeat) ---
    VICTORY: (exp, gold) => `승리! EXP +${exp}, Gold +${gold}`,
    LOOT_GET: (name) => `전리품: ${name}`,
    LOOT_PREFIX: (name) => `접두사 부여: [${name}]`,
    LEGACY_ESSENCE: (n) => `레거시 에센스 +${n}`,
    LEGACY_RANK: (n) => `레거시 랭크 ${n} 달성!`,
    LEVEL_UP: (lv) => `레벨 업! Lv.${lv}`,
    BUFF_EXPIRED: '버프 효과가 만료되었습니다.',
    DEFEAT: '전투에서 패배했습니다. 레거시 보너스는 유지됩니다.',

    // --- 상태이상 (Status Effects) ---
    STATUS_DOT: (effect, dmg) => {
        const label = effect === 'poison' ? '중독' : effect === 'burn' ? '화상' : effect;
        return `[${label}] 상태이상 피해 ${dmg}`;
    },

    // --- 마일스톤 (Milestone) ---
    MILESTONE_KILLS_10: (name) => `🥉 [${name}] 사냥꾼 칭호 획득! (10마리 처치)`,
    MILESTONE_KILLS_50: (name) => `🥈 [${name}] 학살자 칭호 획득! (50마리 처치)`,
    MILESTONE_KILLS_100: (name) => `🥇 [${name}] 지배자 칭호 획득! (100마리 처치)`,
    MILESTONE_BOSS_FIRST: (name) => `👑 [${name}] 최초 처치!`,
    MILESTONE_BOSS_5: (name) => `👑 [${name}] 숙련자 (5회 처치)`,

    // --- 등급 (Rarity) ---
    RARITY_LABEL: { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' },

    // --- 도감 (Codex) ---
    CODEX_DISCOVER: (name) => `📖 도감 등록: ${name}`,
    CODEX_MILESTONE: (label) => `🏆 도감 마일스톤 달성: ${label}`,
    CODEX_PROGRESS: (found, total) => `도감 진행: ${found}/${total}`,

    // --- 합성 (Synthesis) ---
    SYNTHESIS_SUCCESS: (name) => `✨ 합성 성공! [${name}] 획득!`,
    SYNTHESIS_FAIL: '합성 실패... 일부 재료가 소실되었습니다.',
    SYNTHESIS_PROTECTED: '합성 보호 활성화 — 재료가 보존되었습니다.',
    SYNTHESIS_NOT_ENOUGH: '합성에 필요한 재료가 부족합니다.',
    SYNTHESIS_NOT_ENOUGH_GOLD: '합성에 필요한 골드가 부족합니다.',

    // --- 프리미엄 (Premium) ---
    PREMIUM_PURCHASE: (name, cost) => `${name} 구매 완료 (${cost} 크리스탈)`,
    PREMIUM_NOT_ENOUGH: '에테르 크리스탈이 부족합니다.',
    PREMIUM_INV_EXPAND: (size) => `인벤토리 확장! (최대 ${size}칸)`,

    // --- 강화 (Enhancement) ---
    ENHANCE_SUCCESS: (name, lv) => `✨ [${name}] +${lv} 강화 성공!`,
    ENHANCE_FAIL: (name, lv) => `💔 [${name}] +${lv} 강화 실패. 등급 유지.`,
    ENHANCE_MAX_LEVEL: '이미 최고 강화 등급입니다 (+10).',
    ENHANCE_NO_GOLD: (cost) => `강화 비용이 부족합니다. (필요: ${cost}G)`,
    ENHANCE_NOT_EQUIP: '강화는 장비 아이템에만 가능합니다.',

    // --- 주간 미션 (Weekly Mission) ---
    WEEKLY_MISSION_COMPLETE: (label) => `🗓 주간 미션 완료: ${label}`,
    WEEKLY_MISSION_CLAIM: (gold, crystals) => `주간 보상 수령: +${gold}G${crystals ? ` +${crystals}💎` : ''}`,
    WEEKLY_MISSION_RESET: '주간 미션이 초기화되었습니다.',

    // --- 챌린지 런 (Challenge Run) ---
    CHALLENGE_START: (labels) => `⚔ 챌린지 런 시작: ${labels.join(', ')}`,
    CHALLENGE_COMPLETE: '🏆 챌린지 런 클리어!',

    // --- 진 엔딩 (True Ending) ---
    TRUE_BOSS_UNLOCK: '세계의 근원이 흔들립니다... 숨겨진 문이 열렸습니다!',
    TRUE_BOSS_APPEAR: '원시의 신이 강림했습니다. 이것이 진짜 끝입니다.',
    TRUE_BOSS_PHASE3: '원초적 혼돈이 세계를 집어삼킵니다!',
    PRIMAL_SHARD_DROP: (count) => `원시의 파편 획득! (${count}/3)`,
    PRIMAL_SHARD_HINT: (count) => `원시의 파편 ${count}/3개. 마왕을 쓰러뜨리면 진실이 드러납니다.`,

    // --- 심연 마일스톤 (Abyss Milestone) ---
    ABYSS_MILESTONE: (floor) => `🌀 심연 ${floor}층 마일스톤 달성!`,
    ABYSS_BOSS_APPEAR: (name) => `💀 심연 보스 출현: ${name}`,

    // --- 묘비 침략 (Grave Invasion) ---
    INVADE_SUCCESS: (name, item) => `⚔ ${name}의 묘비 침략 성공! [${item}] 획득.`,
    INVADE_FAIL: (name) => `⚔ ${name}의 묘비 침략 실패. 아무것도 얻지 못했습니다.`,
    INVADE_LIMIT: '오늘의 침략 횟수를 모두 사용했습니다. (5회/일)',
    INVADE_NO_ITEMS: '묘비에 침략할 아이템이 없습니다.',

    // --- 신규 직업 스킬 (Sprint 16) ---
    SKILL_EXTRA_TURN: (name) => `[${name}] 시간이 흘러갑니다 — 추가 행동 획득!`,
    SKILL_RESET_COOLDOWNS: (name) => `[${name}] 모든 쿨타임이 초기화되었습니다!`,
    SKILL_CURSE_AMPLIFY: (name) => `[${name}] 저주가 강화되어 피해가 증폭됩니다!`,

    // --- 누락 보완 키 ---
    REST_FULL: '체력과 마나를 완전히 회복했습니다.',
    REST_PARTIAL: (hp, mp) => `체력 ${hp}, 마나 ${mp} 회복했습니다.`,
    INVENTORY_FULL: '인벤토리가 가득 찼습니다. 아이템을 정리해 주세요.',
    BOSS_ENCOUNTER: (name) => `[ 보스 ] ${name}이(가) 나타났습니다!`,
    SAFE_ZONE_ARRIVE: '안전한 곳에 도착했습니다. 상점과 휴식을 이용할 수 있습니다.',
    AREA_BOSS_ENCOUNTER: (name) => `[ 구역 보스 ] ${name}이(가) 행로를 가로막습니다!`,
    MOVE_BLOCKED_COMBAT: '전투 중에는 이동할 수 없습니다.',
    MOVE_BLOCKED_EVENT: '이벤트 진행 중에는 이동할 수 없습니다.',

    // --- 발견 체인 (Discovery Chain) ---
    DISCOVERY_CHAIN_TRIGGER: (label) => `🔍 [발견 체인] ${label} — 숨겨진 단서를 발견했습니다!`,
    DISCOVERY_CHAIN_COMPLETE: (label, reward) => `🏆 [발견 체인 완료] ${label}! 보상: ${reward}`,

    // --- 챌린지 보상 ---
    CHALLENGE_REWARD_BONUS: (mult) => `⚔ 챌린지 보상 ${Math.round(mult * 100)}% 적용!`,

    // --- 스킬 교체 ---
    SKILL_SWAP: (oldName, newName) => `스킬 교체: [${oldName}] → [${newName}]`,
    SKILL_SWAP_COST: (gold) => `스킬 교체 비용: ${gold}G`,

    // --- 직업/클래스 ---
    CLASS_TIER_0: '기본',
    CLASS_TIER_1: '1차 전직',
    CLASS_TIER_2: '2차 전직',
    CLASS_TIER_3: '최종 전직',
    CLASS_STAT_HP: 'HP',
    CLASS_STAT_MP: 'MP',
    CLASS_STAT_ATK: 'ATK',
    CLASS_REQ_LEVEL: (lv) => `Lv.${lv} 이상`,
    CLASS_TREE_TITLE: '전직 계통도',
    CLASS_CURRENT: '현재 직업',
    CLASS_AVAILABLE: '전직 가능',
    CLASS_LOCKED: '잠김',

    // --- 도감 ---
    CODEX_NEW_ENTRY: (name) => `새로운 도감 항목 발견: ${name}`,
    CODEX_DISCOVERED: '발견',
    CODEX_UNDISCOVERED: '미발견',
    CODEX_PROGRESS: (n, total) => `${n}/${total} 발견`,
    MONSTER_WEAKNESS: '약점',
    MONSTER_RESISTANCE: '내성',
    MONSTER_KILL_COUNT: (n) => `처치 ${n}회`,
    EQUIP_STAT_COMPARE: '스탯 비교',
    EQUIP_EQUIPPED: '장착 중',
};
