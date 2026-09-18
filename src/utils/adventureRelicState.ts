import type { Player, Relic } from '../types/index.js';
import { RELICS } from '../data/relics.js';

// Save normalization must stay independent of the combat/stat calculation graph.
// maxHp는 구형 save에서 비어 있을 수 있다 — 아래 Number.isFinite 가드가 undefined/NaN을 같은 값으로 처리한다.
export const normalizeAdventureRelicBonuses = (value: unknown, maxHp: number | undefined): Player['adventureRelicBonuses'] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const candidate = value as Record<string, unknown>;
    const normalized: NonNullable<Player['adventureRelicBonuses']> = {};
    if (typeof candidate.killStackAtk === 'number'
        && Number.isFinite(candidate.killStackAtk) && candidate.killStackAtk > 0) {
        const cap = RELICS.find((relic) => relic.effect === 'kill_stack_atk')!.val.max;
        normalized.killStackAtk = Math.min(cap, candidate.killStackAtk);
    }
    const devour = candidate.devour as Record<string, unknown> | undefined;
    if (devour && (devour.phase === 'ready' || devour.phase === 'active')
        && typeof devour.amount === 'number' && Number.isSafeInteger(devour.amount) && devour.amount > 0
        && (devour.phase !== 'active' || (typeof maxHp === 'number' && Number.isFinite(maxHp) && devour.amount < maxHp))) {
        normalized.devour = { phase: devour.phase, amount: devour.amount };
    }
    return Object.keys(normalized).length ? normalized : undefined;
};

export const getAdventureRelicDescription = (relic: Relic): string | undefined => {
    if (relic.effect === 'kill_stack_atk' && Number.isFinite(relic.val?.perKill) && Number.isFinite(relic.val?.max)) {
        return `적을 처치할 때마다 공격력 ${Math.round(relic.val.perKill * 100)}% 증가, 원정 동안 최대 ${Math.round(relic.val.max * 100)}% 누적. 안전 귀환 시 해제`;
    }
    if (relic.effect === 'devour_hp' && Number.isFinite(relic.val)) {
        return `마지막으로 처치한 적 최대 생명의 ${Math.round(relic.val * 100)}%만큼 다음 전투 한 번의 기본 최대 생명과 현재 생명 증가. 누적되지 않으며 안전 귀환 시 해제`;
    }
    return relic.desc;
};
