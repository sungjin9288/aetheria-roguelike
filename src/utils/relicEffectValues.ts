import type { Relic } from '../types/relic.js';

const normalizeRelicTotal = (value: number) => Number(value.toFixed(12));

export const getAdditiveNumericRelicValue = (
    relics: readonly Relic[],
    effect: string,
): number => {
    let total = 0;

    for (const relic of relics) {
        if (relic.effect !== effect) continue;
        if (typeof relic.val !== 'number' || !Number.isFinite(relic.val) || relic.val < 0) {
            throw new Error('INVALID_RELIC_EFFECT_VALUE');
        }
        total += relic.val;
        if (!Number.isFinite(total)) throw new Error('INVALID_RELIC_EFFECT_VALUE');
    }

    return normalizeRelicTotal(total);
};
