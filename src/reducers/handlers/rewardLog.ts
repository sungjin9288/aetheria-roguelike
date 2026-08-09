import { BALANCE } from '../../data/constants';

type RewardLogEntry = string | { type?: string; text: string };

type RewardLogEntropy = {
    now?: number;
    seed?: number;
};

export const appendRewardLogs = (
    logs: any[],
    entries: RewardLogEntry[],
    entropy?: RewardLogEntropy,
) => {
    if (entries.length === 0) return logs;

    const createdAt = Number.isFinite(entropy?.now) ? entropy!.now as number : Date.now();
    const seed = Number.isFinite(entropy?.seed) ? entropy!.seed as number : Math.random();
    const rewards = entries.map((entry, index) => ({
        id: `reward-${createdAt}-${seed}-${index}`,
        type: typeof entry === 'string' ? 'success' : entry.type || 'success',
        text: typeof entry === 'string' ? entry : entry.text,
    }));

    return [...logs, ...rewards].slice(-BALANCE.LOG_MAX_SIZE);
};
