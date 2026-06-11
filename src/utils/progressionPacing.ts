import { BALANCE, CONSTANTS } from '../data/constants.js';

const EARLY_QUEST_CLAIM_PACING_MAX_LEVEL = 10;
const POST_LEVEL_EXP_FILL_RATIO = 0.85;

export const getPacedQuestClaimExp = (player: any, rewardExp: any) => {
    const rawExp = Math.max(0, Math.floor(Number(rewardExp) || 0));
    const level = Math.max(1, Math.floor(Number(player?.level) || 1));

    if (rawExp <= 0 || level > EARLY_QUEST_CLAIM_PACING_MAX_LEVEL || level >= CONSTANTS.MAX_LEVEL) {
        return rawExp;
    }

    const currentExp = Math.max(0, Math.floor(Number(player?.exp) || 0));
    const nextExp = Math.max(1, Math.floor(Number(player?.nextExp) || CONSTANTS.START_NEXT_EXP));
    const postLevelNextExp = Math.min(
        Math.floor(nextExp * BALANCE.EXP_SCALE_RATE),
        BALANCE.EXP_LEVEL_HARD_CAP
    );
    const remainingToNext = Math.max(0, nextExp - currentExp);
    const maxSingleQuestExp = remainingToNext + Math.floor(postLevelNextExp * POST_LEVEL_EXP_FILL_RATIO);

    return Math.min(rawExp, Math.max(1, maxSingleQuestExp));
};
