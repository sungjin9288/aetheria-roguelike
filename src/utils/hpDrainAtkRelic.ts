import { relicDict } from '../data/relics.js';
import type { Relic } from '../types/relic.js';

export interface HpDrainAtkRelicSelection {
    relic: Relic;
    id: string;
    label: string;
    atkBonus: number;
    hpCost: number;
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const invalid = (): never => {
    throw new Error('INVALID_HP_DRAIN_ATK_RELIC_VALUE');
};

const getFiniteNonNegativeNumber = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid();
    return value as number;
};

const makeSelection = (relic: Relic): HpDrainAtkRelicSelection => {
    const value = relic.val;
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    // 위 가드를 통과하면 relicDict는 value 그 자체를 돌려준다 (동일 참조).
    const dict = relicDict(relic);
    const atkBonus = getFiniteNonNegativeNumber(dict.atkBonus);
    const hpCost = getFiniteNonNegativeNumber(dict.hpCost);
    const id = typeof relic.id === 'string' ? relic.id : '';
    const label = typeof relic.name === 'string' && relic.name.length > 0
        ? relic.name
        : id || 'hp_drain_atk';
    return { relic, id, label, atkBonus, hpCost };
};

const stableTieKey = (selection: HpDrainAtkRelicSelection) => JSON.stringify([
    selection.id,
    selection.label,
    selection.hpCost,
]);

/**
 * Resolves the complete trade-off pair for hp_drain_atk.
 * Every matching snapshot is validated before the greatest attack bonus is chosen.
 */
export const resolveHpDrainAtkRelic = (
    relics: readonly Relic[] | undefined | null,
): HpDrainAtkRelicSelection | null => {
    const matches = (relics || []).filter((relic) => relic?.effect === 'hp_drain_atk')
        .map(makeSelection);
    if (matches.length === 0) return null;

    return matches.reduce((selected, candidate) => {
        if (candidate.atkBonus > selected.atkBonus) return candidate;
        if (candidate.atkBonus < selected.atkBonus) return selected;
        return compareText(stableTieKey(candidate), stableTieKey(selected)) < 0
            ? candidate
            : selected;
    });
};
