import { BALANCE } from '../../data/constants';

type RewardLogEntry = string | { type?: string; text: string };

export const appendRewardLogs = (logs: any[], entries: RewardLogEntry[]) => {
    if (entries.length === 0) return logs;

    const createdAt = Date.now();
    const rewards = entries.map((entry, index) => ({
        id: `reward-${createdAt}-${index}-${Math.random()}`,
        type: typeof entry === 'string' ? 'success' : entry.type || 'success',
        text: typeof entry === 'string' ? entry : entry.text,
    }));

    return [...logs, ...rewards].slice(-BALANCE.LOG_MAX_SIZE);
};
