import { BALANCE } from '../data/constants';

/**
 * essenceLedger — 계승 정수(meta.essence)와 계승 rank의 단일 진실 원천.
 *
 * 2026-09 감사 G2: rank가 *잔여* 정수(`floor(meta.essence / 150)`)로 산출되어
 *   에테르 거울에서 정수를 쓸 때마다 영구 스탯 사다리가 뒤로 밀렸다. 500 정수 노드
 *   하나가 rank 3.3단계를 조용히 갉아먹는 숨은 비용이었고, 같은 식이
 *   CombatEngine.outcome.ts와 reducers/handlers/helpers.ts 두 곳에 복제돼 있었다.
 *
 * 계약:
 *   - `meta.essenceLifetime` = 지금까지 *번* 정수의 총합 (소비해도 줄지 않음).
 *   - rank = `max(meta.rank, floor(essenceLifetime / BALANCE.ESSENCE_PER_RANK))` — 단조.
 *     (기존 세이브의 rank가 더 높아도 절대 내려가지 않는다.)
 *   - 정수 소비(거울 구매)는 `essence`만 줄이고 `essenceLifetime`은 건드리지 않는다.
 *
 * 전부 순수 함수 — 입력 meta를 변이하지 않고 새 객체를 반환한다.
 */

export interface EssenceMeta {
    essence?: number;
    essenceLifetime?: number;
    rank?: number;
    bonusAtk?: number;
    bonusHp?: number;
    bonusMp?: number;
    [key: string]: any;
}

const toNonNegative = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
};

/** 전투 보상 정수량. enemy.exp와 획득 배율(프레스티지 rank × 거울 essence_flow)로 계산. */
export const getEssenceGainFromExp = (exp: unknown, essenceMult: unknown = 1): number => {
    const mult = Number.isFinite(Number(essenceMult)) ? Number(essenceMult) : 1;
    return Math.max(1, Math.floor(toNonNegative(exp) / BALANCE.ESSENCE_EXP_DIVISOR * mult));
};

/**
 * 누적 정수. `essenceLifetime`이 없는 구세이브(마이그레이션 전 스냅샷 등)에서는
 * 잔여 정수와 이미 도달한 rank 중 큰 쪽으로 추정 — rank가 내려가지 않게 하는 방어선.
 */
export const getEssenceLifetime = (meta: EssenceMeta | null | undefined): number => {
    const base = meta || {};
    const recorded = Number(base.essenceLifetime);
    if (Number.isFinite(recorded) && recorded >= 0) return Math.floor(recorded);
    return Math.max(
        Math.floor(toNonNegative(base.essence)),
        Math.floor(toNonNegative(base.rank)) * BALANCE.ESSENCE_PER_RANK,
    );
};

/** 누적 정수 → 계승 rank. 현재 rank 아래로는 절대 내려가지 않는다(단조). */
export const getRankFromLifetime = (lifetime: unknown, currentRank: unknown = 0): number => Math.max(
    Math.floor(toNonNegative(currentRank)),
    Math.floor(toNonNegative(lifetime) / BALANCE.ESSENCE_PER_RANK),
);

/** applyEssenceGain이 반환하는 meta — 원장 필드가 전부 확정(number)된 형태. */
export type SettledEssenceMeta = EssenceMeta & {
    essence: number;
    essenceLifetime: number;
    rank: number;
    bonusAtk: number;
    bonusHp: number;
    bonusMp: number;
};

export interface EssenceGrantResult {
    meta: SettledEssenceMeta;
    /** 실제 지급된 정수량 */
    gain: number;
    /** 이번 지급으로 오른 rank 단계 수 (0이면 승급 없음) */
    rankGain: number;
}

/**
 * applyEssenceGain — 정수 지급 + 누적 원장 갱신 + rank 승급(영구 스탯 가산)을 한 번에.
 * 전투 승리(CombatEngine.outcome) / 프로토콜·이벤트 보상(handlers/helpers) 양쪽이 이 함수만 쓴다.
 */
export const applyEssenceGain = (
    meta: EssenceMeta | null | undefined,
    gain: unknown,
): EssenceGrantResult => {
    const base = meta || {};
    const amount = Math.max(0, Math.floor(toNonNegative(gain)));
    const prevRank = Math.floor(toNonNegative(base.rank));
    const lifetime = getEssenceLifetime(base) + amount;
    const nextRank = getRankFromLifetime(lifetime, prevRank);
    const rankGain = nextRank - prevRank;

    return {
        meta: {
            ...base,
            essence: toNonNegative(base.essence) + amount,
            essenceLifetime: lifetime,
            rank: nextRank,
            bonusAtk: toNonNegative(base.bonusAtk) + rankGain * BALANCE.ESSENCE_RANK_ATK,
            bonusHp: toNonNegative(base.bonusHp) + rankGain * BALANCE.ESSENCE_RANK_HP,
            bonusMp: toNonNegative(base.bonusMp) + rankGain * BALANCE.ESSENCE_RANK_MP,
        },
        gain: amount,
        rankGain,
    };
};
