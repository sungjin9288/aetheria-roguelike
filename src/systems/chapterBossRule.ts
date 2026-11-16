import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import {
    CHAPTER_BOSS_RULES,
    CHAPTER_BOSS_RULE_TEXT,
    isChapterRuleBossName,
    type ChapterBossRuleDef,
    type ChapterBossRuleId,
} from '../data/chapterBossRules.js';
import type { Monster } from '../types/index.js';

/**
 * 장 보스 규칙 판정(2026-11 B5). 규칙은 `data/chapterBossRules.ts`가 선언하고, 엔진 · 기록 줄 · 도전 카드 · 전투 칩 · 도감은
 * 이 파일만 읽는다. 판정은 적 인스턴스(종 · 보스 여부 · `ruleItemUses`)만 보고 난수를 쓰지 않는다 — 규칙이 막는 판정도
 * 원래 쓰던 난수는 그대로 쓴 뒤 결과만 바꾼다(규칙이 있든 없든 같은 수의 난수를 쓴다, 계약이 잡는다).
 * 규칙은 그 보스와의 전투에만 있다 — 적 인스턴스가 끝나면 함께 끝나고 세이브에 따로 남지 않는다.
 */

export interface ActiveChapterRule extends ChapterBossRuleDef {
    readonly text: string;
}

type RuleTarget = Pick<Monster, 'name' | 'baseName' | 'isBoss'> | null | undefined;

const toActive = (def: ChapterBossRuleDef): ActiveChapterRule => ({ ...def, text: CHAPTER_BOSS_RULE_TEXT[def.rule] });

/** 보스 이름(종)으로 규칙을 찾는다 — 도감 · 도전 카드처럼 아직 적 인스턴스가 없는 곳이 쓴다. */
export const getChapterRuleForBossName = (name: string | null | undefined): ActiveChapterRule | null => (
    name && isChapterRuleBossName(name) ? toActive(CHAPTER_BOSS_RULES[name]) : null
);

/** 이 적과의 전투에 걸린 규칙 — 보스로 나온 장 보스 종일 때만. */
export const getChapterBossRule = (enemy: RuleTarget): ActiveChapterRule | null => {
    if (!enemy?.isBoss) return null;
    return getChapterRuleForBossName(enemy.baseName || enemy.name);
};

export const hasChapterRule = (enemy: RuleTarget, rule: ChapterBossRuleId): boolean => (
    getChapterBossRule(enemy)?.rule === rule
);

// ── 엔진 판정 ────────────────────────────────────────────────────────────────

/** 기술의 기력 소모(얼어붙은 마력: 두 배). */
export const getRuleSkillMpCost = (baseCost: number, enemy: RuleTarget): number => (
    hasChapterRule(enemy, 'skill_mp_double') ? Math.ceil(baseCost * BALANCE.CHAPTER_RULE_SKILL_MP_MULT) : baseCost
);

/** 기술의 재사용 대기(과부하 회로: 두 배 — 줄이는 효과를 뺀 뒤의 값에 곱한다). */
export const getRuleSkillCooldown = (cooldown: number, enemy: RuleTarget): number => (
    hasChapterRule(enemy, 'cooldown_double') ? cooldown * BALANCE.CHAPTER_RULE_COOLDOWN_MULT : cooldown
);

/** 기술로 건 강화의 지속 턴(열기의 장막: 절반, 올림 — 최소 1턴). */
export const getRuleBuffTurns = (turns: number, enemy: RuleTarget): number => (
    hasChapterRule(enemy, 'buff_halved') ? Math.max(1, Math.ceil(turns * BALANCE.CHAPTER_RULE_BUFF_TURN_MULT)) : turns
);

/** 원소 배율(물든 뿌리: 약점 배율이 1을 넘지 않는다 — 저항 배율은 그대로). */
export const getRuleElementMultiplier = (mult: number, enemy: RuleTarget): number => (
    hasChapterRule(enemy, 'weakness_sealed') && mult > 1 ? 1 : mult
);

export const isRuleCritSealed = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'crit_sealed');
export const isRuleDotSealed = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'dot_sealed');
export const isRuleEvasionSealed = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'evasion_sealed');
export const isRuleLifestealSealed = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'lifesteal_sealed');
export const isRuleEscapeSealed = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'escape_sealed');
export const isRuleResistPierced = (enemy: RuleTarget): boolean => hasChapterRule(enemy, 'resist_pierced');

/** 이번 소모품을 막는가(꺼지지 않는 불: 이미 한도만큼 썼다). */
export const isRuleItemSealed = (enemy: (RuleTarget & Pick<Monster, 'ruleItemUses'>) | null | undefined): boolean => (
    hasChapterRule(enemy, 'potion_once') && (enemy?.ruleItemUses || 0) >= BALANCE.CHAPTER_RULE_ITEM_LIMIT
);

/** 소모품을 쓴 뒤 센다 — 규칙이 없으면 같은 참조. */
export const countRuleItemUse = <T extends Monster>(enemy: T): T => (
    hasChapterRule(enemy, 'potion_once') ? { ...enemy, ruleItemUses: (enemy.ruleItemUses || 0) + 1 } : enemy
);

// ── 문구 ─────────────────────────────────────────────────────────────────────

/** 나타날 때 · 도전 카드에 붙는 줄. */
export const getChapterRuleLine = (rule: ActiveChapterRule | null): string | null => (
    rule ? MSG.CHAPTER_RULE_LINE(rule.name, rule.text) : null
);

/** 이 적이 나타날 때 전투 기록에 붙는 규칙 줄 — 위협 줄(`getAppearThreatLine`) 다음 줄이다. */
export const getAppearRuleLine = (enemy: RuleTarget): string | null => getChapterRuleLine(getChapterBossRule(enemy));

/** 전투 화면 칩. */
export const getChapterRuleChip = (enemy: RuleTarget): string | null => {
    const rule = getChapterBossRule(enemy);
    return rule ? MSG.CHAPTER_RULE_CHIP(rule.name, rule.text) : null;
};

/** 규칙이 행동을 막았을 때의 기록 줄. */
export const getChapterRuleBlockedLog = (enemy: RuleTarget): string | null => {
    const rule = getChapterBossRule(enemy);
    return rule ? MSG.CHAPTER_RULE_BLOCKED(rule.name, rule.text) : null;
};
