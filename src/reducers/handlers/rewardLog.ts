import { BALANCE } from '../../data/constants';

export const appendRewardLogs = (logs: any[], texts: string[]) => {
    if (texts.length === 0) return logs;

    const createdAt = Date.now();
    const rewards = texts.map((text, index) => ({
        id: `reward-${createdAt}-${index}-${Math.random()}`,
        type: 'success',
        text,
    }));

    return [...logs, ...rewards].slice(-BALANCE.LOG_MAX_SIZE);
};
