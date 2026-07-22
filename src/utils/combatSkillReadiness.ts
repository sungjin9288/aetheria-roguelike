import { BALANCE } from '../data/constants';
import type { ClassSkill, Player } from '../types/index.js';

export type CombatSkillReadinessState = 'missing' | 'cooldown' | 'energy' | 'ready';

interface CombatSkillReadinessInput {
    player: Player;
    selectedSkill?: ClassSkill | null;
    skillCooldown?: number;
}

export const getCombatSkillReadiness = ({
    player,
    selectedSkill,
    skillCooldown = 0,
}: CombatSkillReadinessInput) => {
    if (!selectedSkill) {
        return {
            state: 'missing' as const,
            canUse: false,
            cost: 0,
            detailLabel: '준비한 기술 없음',
            buttonLabel: '기술 없음',
        };
    }

    const cost = selectedSkill.mp || BALANCE.SKILL_MP_COST;
    const currentEnergy = Math.max(0, player.mp || 0);

    if (skillCooldown > 0) {
        return {
            state: 'cooldown' as const,
            canUse: false,
            cost,
            detailLabel: `기력 ${cost} · ${skillCooldown}턴 후`,
            buttonLabel: '재사용 대기',
        };
    }

    if (currentEnergy < cost) {
        return {
            state: 'energy' as const,
            canUse: false,
            cost,
            detailLabel: `필요 기력 ${cost} · 현재 ${currentEnergy}`,
            buttonLabel: '기력 부족',
        };
    }

    return {
        state: 'ready' as const,
        canUse: true,
        cost,
        detailLabel: `기력 ${cost} · 사용 가능`,
        buttonLabel: '기술',
    };
};
