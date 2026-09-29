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
 *   - `meta.essenceLifetime` = 지금까지 *번* 정수의 총합 (소비해도, 계승해도 줄지 않음).
 *   - `meta.essenceLadder` = rank를 매기는 사다리 원장. 획득마다 오르고, 계승 때만 남긴 단계만큼으로 줄어든다
 *     (2026-09 Wave 32). 없으면 `essenceLifetime`으로 읽는다.
 *   - rank = `max(meta.rank, floor(essenceLadder / BALANCE.ESSENCE_PER_RANK))` — 획득·소비에서 단조.
 *     (기존 세이브의 rank가 더 높아도 절대 내려가지 않는다.) 내려가는 경로는 계승(`carryEssenceLadderOnAscension`) 하나다.
 *   - 정수 소비(거울 구매)는 `essence`만 줄이고 `essenceLifetime`·`essenceLadder`는 건드리지 않는다.
 *
 * 전부 순수 함수 — 입력 meta를 변이하지 않고 새 객체를 반환한다.
 */

export interface EssenceMeta {
    essence?: number;
    essenceLifetime?: number;
    essenceLadder?: number;
    rank?: number;
    bonusAtk?: number;
    bonusHp?: number;
    bonusMp?: number;
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

/** 사다리 원장. 기록이 없는 세이브(Wave 32 이전)는 누적 정수를 그대로 사다리로 읽는다. */
export const getEssenceLadder = (meta: EssenceMeta | null | undefined): number => {
    const recorded = Number(meta?.essenceLadder);
    if (Number.isFinite(recorded) && recorded >= 0) return Math.floor(recorded);
    return getEssenceLifetime(meta);
};

/** 사다리 정수 → 계승 rank. 현재 rank 아래로는 절대 내려가지 않는다(단조). */
export const getRankFromLifetime = (lifetime: unknown, currentRank: unknown = 0): number => Math.max(
    Math.floor(toNonNegative(currentRank)),
    Math.floor(toNonNegative(lifetime) / BALANCE.ESSENCE_PER_RANK),
);

/** applyEssenceGain이 반환하는 meta — 원장 필드가 전부 확정(number)된 형태. */
export type SettledEssenceMeta = EssenceMeta & {
    essence: number;
    essenceLifetime: number;
    essenceLadder: number;
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
    const ladder = getEssenceLadder(base) + amount;
    const nextRank = getRankFromLifetime(ladder, prevRank);
    const rankGain = nextRank - prevRank;

    return {
        meta: {
            ...base,
            essence: toNonNegative(base.essence) + amount,
            essenceLifetime: lifetime,
            essenceLadder: ladder,
            rank: nextRank,
            bonusAtk: toNonNegative(base.bonusAtk) + rankGain * BALANCE.ESSENCE_RANK_ATK,
            bonusHp: toNonNegative(base.bonusHp) + rankGain * BALANCE.ESSENCE_RANK_HP,
            bonusMp: toNonNegative(base.bonusMp) + rankGain * BALANCE.ESSENCE_RANK_MP,
        },
        gain: amount,
        rankGain,
    };
};

export interface EssenceLadderCarry {
    meta: SettledEssenceMeta;
    /** 계승 직전 사다리 단계 */
    rankBefore: number;
    /** 다음 런으로 넘어간 단계 */
    rankKept: number;
}

/**
 * 계승 시 사다리 이월 — 단계의 `BALANCE.ESSENCE_LADDER_ASCEND_CARRY`만 남기고(내림), 내려놓은 단계의 영구 스탯을 뺀다.
 *
 * 2026-09 Wave 32 (소유자 결정): 사다리는 한 런에 800단계 안팎(공격력 +800 · 생명 +4,000)을 쌓았고 그것이 통째로
 *   넘어가 계승 런 48판 사망이 0이었다(원장 §31.4 · §32). 획득률을 낮추면 1회차가 23% 길어져서, 1회차를 그대로 두는
 *   유일한 지점인 계승에서 줄인다. 첫 죽음·프레스티지 보너스는 사다리 몫이 아니므로 그대로다(빼는 양은 단계 × 단계당 값).
 *   누적 정수·쓸 수 있는 정수는 건드리지 않는다. 사망 재시작은 이 함수를 부르지 않는다.
 */
export const carryEssenceLadderOnAscension = (meta: EssenceMeta | null | undefined): EssenceLadderCarry => {
    const base = meta || {};
    const rankBefore = Math.floor(toNonNegative(base.rank));
    const rankKept = Math.floor(rankBefore * BALANCE.ESSENCE_LADDER_ASCEND_CARRY);
    const dropped = rankBefore - rankKept;
    return {
        meta: {
            ...base,
            essence: toNonNegative(base.essence),
            essenceLifetime: getEssenceLifetime(base),
            essenceLadder: rankKept * BALANCE.ESSENCE_PER_RANK,
            rank: rankKept,
            bonusAtk: Math.max(0, toNonNegative(base.bonusAtk) - dropped * BALANCE.ESSENCE_RANK_ATK),
            bonusHp: Math.max(0, toNonNegative(base.bonusHp) - dropped * BALANCE.ESSENCE_RANK_HP),
            bonusMp: Math.max(0, toNonNegative(base.bonusMp) - dropped * BALANCE.ESSENCE_RANK_MP),
        },
        rankBefore,
        rankKept,
    };
};
