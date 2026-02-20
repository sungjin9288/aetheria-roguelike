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
    COMBAT_ENEMY_HIT: (name, dmg) => `${name}이(가) ${dmg} 피해를 가했습니다.`,
    COMBAT_ENEMY_HEAVY_HIT: (name, dmg) => `${name}의 강타! ${dmg} 피해를 입었습니다.`,
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

    // --- 마일스톤 (Milestone) ---
    MILESTONE_KILLS_10: (name) => `🥉 [${name}] 사냥꾼 칭호 획득! (10마리 처치)`,
    MILESTONE_KILLS_50: (name) => `🥈 [${name}] 학살자 칭호 획득! (50마리 처치)`,
    MILESTONE_KILLS_100: (name) => `🥇 [${name}] 지배자 칭호 획득! (100마리 처치)`,
    MILESTONE_BOSS_FIRST: (name) => `👑 [${name}] 최초 처치!`,
    MILESTONE_BOSS_5: (name) => `👑 [${name}] 숙련자 (5회 처치)`,
};
