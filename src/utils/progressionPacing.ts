import { CONSTANTS } from '../data/constants.js';
import { getLevelExpRequirement } from '../systems/expCurve.js';
import type { Player } from '../types/index.js';

const EARLY_QUEST_CLAIM_PACING_MAX_LEVEL = 10;
const POST_LEVEL_EXP_FILL_RATIO = 0.85;
const EARLY_COMBAT_EXP_PACING_MAX_LEVEL = 4;
const EARLY_COMBAT_EXP_RATIO = 0.6;

export const getPacedCombatExp = (player: Player | null | undefined, rewardExp: number) => {
    const rawExp = Math.max(0, Math.floor(Number(rewardExp) || 0));
    const level = Math.max(1, Math.floor(Number(player?.level) || 1));

    if (rawExp <= 0 || level > EARLY_COMBAT_EXP_PACING_MAX_LEVEL) {
        return rawExp;
    }

    return Math.max(1, Math.floor(rawExp * EARLY_COMBAT_EXP_RATIO));
};

export const getPacedQuestClaimExp = (player: Player | null | undefined, rewardExp: number) => {
    const rawExp = Math.max(0, Math.floor(Number(rewardExp) || 0));
    const level = Math.max(1, Math.floor(Number(player?.level) || 1));

    if (rawExp <= 0 || level > EARLY_QUEST_CLAIM_PACING_MAX_LEVEL || level >= CONSTANTS.MAX_LEVEL) {
        return rawExp;
    }

    const currentExp = Math.max(0, Math.floor(Number(player?.exp) || 0));
    const nextExp = Math.max(1, Math.floor(Number(player?.nextExp) || CONSTANTS.START_NEXT_EXP));
    const postLevelNextExp = getLevelExpRequirement(level + 1);
    const remainingToNext = Math.max(0, nextExp - currentExp);
    const maxSingleQuestExp = remainingToNext + Math.floor(postLevelNextExp * POST_LEVEL_EXP_FILL_RATIO);

    return Math.min(rawExp, Math.max(1, maxSingleQuestExp));
};
