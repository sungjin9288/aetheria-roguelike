import type { Monster, Player } from '../types/index.js';

type ForecastTone = 'pressure' | 'advantage' | 'reward' | 'steady';

export interface CombatForecast {
    intent: string;
    response: string;
    window: string;
    tone: ForecastTone;
}

interface CombatForecastInput {
    player: Player;
    enemy?: Monster | null;
    stats?: any;
    selectedSkill?: any;
    skillCooldown?: number;
    enemyTelegraph?: any;
    combatConsumables?: any[];
    primarySignatureDrop?: any;
}

const STATUS_LABELS: Record<string, string> = {
    poison: '독',
    burn: '화상',
    bleed: '출혈',
    freeze: '빙결',
    stun: '기절',
    curse: '저주',
    fear: '공포',
    blind: '실명',
};

const DEFENSIVE_EFFECTS = new Set(['def_up', 'counter', 'stealth', 'hp_regen', 'all_up']);

const clampRatio = (value: number) => Math.max(0, Math.min(1, value));

const hasItemType = (items: any[], type: string) => items.some((item: any) => item?.type === type);

const getStatusLabel = (status: any) => {
    if (!status) return null;
    return STATUS_LABELS[String(status)] || String(status);
};

const getSkillShortName = (skill: any) => {
    if (!skill?.name) return '스킬';
    return String(skill.name).replace(/\s+/g, '');
};

export const getCombatForecast = ({
    player,
    enemy,
    stats,
    selectedSkill,
    skillCooldown = 0,
    enemyTelegraph,
    combatConsumables = [],
    primarySignatureDrop,
}: CombatForecastInput): CombatForecast | null => {
    if (!enemy) return null;

    const playerMaxHp = Math.max(1, stats?.maxHp || player.maxHp || 1);
    const enemyMaxHp = Math.max(1, enemy.maxHp || enemy.hp || 1);
    const playerHpRatio = clampRatio((player.hp || 0) / playerMaxHp);
    const enemyHpRatio = clampRatio((enemy.hp || 0) / enemyMaxHp);
    const skillCost = selectedSkill?.mp || 0;
    const hasHpItem = hasItemType(combatConsumables, 'hp');
    const hasCureItem = hasItemType(combatConsumables, 'cure');
    const canUseSkill = Boolean(selectedSkill && skillCooldown <= 0 && (player.mp || 0) >= skillCost);
    const skillName = getSkillShortName(selectedSkill);
    const skillHitsWeakness = Boolean(canUseSkill && selectedSkill?.type && enemy.weakness && selectedSkill.type === enemy.weakness);
    const skillIsDefensive = Boolean(canUseSkill && (selectedSkill?.type === 'buff' || DEFENSIVE_EFFECTS.has(selectedSkill?.effect)));
    const statusThreat = getStatusLabel(enemy.pattern?.statusEffect || enemy.statusOnHit);
    const telegraphType = enemyTelegraph?.type || 'normal';

    let intent = enemyTelegraph?.label || '일반 공격 예상';
    if (statusThreat && telegraphType !== 'stunned') {
        intent = `${intent} · ${statusThreat}`;
    }

    let response = '기본 공격';
    if (telegraphType === 'stunned') {
        response = '공격 집중';
    } else if (playerHpRatio <= 0.35 && hasHpItem) {
        response = 'HP 아이템';
    } else if (playerHpRatio <= 0.35 && canUseSkill && selectedSkill?.effect === 'drain') {
        response = `${skillName} 회복`;
    } else if (playerHpRatio <= 0.35) {
        response = '도주 판단';
    } else if (telegraphType === 'phase2_imminent' && hasHpItem) {
        response = '회복 후 전환';
    } else if (telegraphType === 'phase2_imminent' && canUseSkill) {
        response = `${skillName} 단축`;
    } else if (telegraphType === 'heavy' && skillIsDefensive) {
        response = `${skillName} 방어`;
    } else if (telegraphType === 'heavy' && hasHpItem) {
        response = '회복 여지';
    } else if (telegraphType === 'guard') {
        response = '스킬 보류';
    } else if (skillHitsWeakness) {
        response = `${skillName} 약점`;
    } else if (canUseSkill && enemyHpRatio <= 0.35) {
        response = `${skillName} 마무리`;
    } else if (canUseSkill && selectedSkill?.effect === 'stun') {
        response = `${skillName} 차단`;
    } else if (selectedSkill && skillCooldown > 0) {
        response = 'CD 대기';
    } else if (selectedSkill && (player.mp || 0) < skillCost) {
        response = 'MP 절약';
    }

    let window = '안정 교전';
    if (enemyHpRatio <= 0.25) {
        window = '마무리권';
    } else if (playerHpRatio <= 0.35) {
        window = hasHpItem ? '회복 우선' : '탈출 검토';
    } else if (telegraphType === 'phase2_imminent') {
        window = '전환 직전';
    } else if (primarySignatureDrop) {
        window = '전설 보상';
    } else if (statusThreat && !hasCureItem) {
        window = `${statusThreat} 위험`;
    } else if (skillHitsWeakness) {
        window = '약점 타이밍';
    } else if (enemy.isBoss) {
        window = '장기전';
    }

    let tone: ForecastTone = 'steady';
    if (playerHpRatio <= 0.35 || telegraphType === 'heavy' || telegraphType === 'phase2_imminent') {
        tone = 'pressure';
    } else if (telegraphType === 'stunned' || enemyHpRatio <= 0.25 || skillHitsWeakness) {
        tone = 'advantage';
    } else if (primarySignatureDrop) {
        tone = 'reward';
    }

    return { intent, response, window, tone };
};
