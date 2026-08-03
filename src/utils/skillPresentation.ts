import type { ClassSkill } from '../types/class.js';

const EFFECT_LABELS: Record<string, string> = {
    burn: '화상',
    bleed: '출혈',
    poison: '독',
    stun: '기절',
    freeze: '빙결',
    drain: '흡수',
    curse: '저주',
    fear: '공포',
    atk_up: '공격력 상승',
    def_up: '방어력 상승',
    all_up: '공격력과 방어력 상승',
    berserk: '광란',
    stealth: '은신',
};

export const formatSkillText = (text: unknown): string => String(text || '')
    .replace(/\bATK\s*\/\s*DEF\b/g, '공격력과 방어력')
    .replace(/\bATK\b/g, '공격력')
    .replace(/\bDEF\b/g, '방어력')
    .replace(/\bHP\b/g, '생명')
    .replace(/\bMP\b/g, '기력')
    .replace(/\bCRIT\b/g, '치명타')
    .replace(/데미지|대미지/g, '피해')
    .replace(/(\d+)→(\d+)턴/g, '$1턴에서 $2턴');

export const formatSkillPower = (mult?: number): string | null => (
    typeof mult === 'number' && mult > 0 ? `위력 ${Math.round(mult * 100)}%` : null
);

export const getSkillEffectLabel = (effect?: string): string | null => (
    effect ? EFFECT_LABELS[effect] || null : null
);

export const getSkillMetrics = (skill: ClassSkill): string[] => {
    const metrics = [skill.mp ? `기력 ${skill.mp}` : '기력 소모 없음'];
    const power = formatSkillPower(skill.mult);
    const effect = getSkillEffectLabel(skill.effect);

    if (power) metrics.push(power);
    if (effect) metrics.push(effect);
    return metrics;
};
