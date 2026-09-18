/**
 * 30단계 시즌 여정 데이터.
 * 일반 플레이 보상은 free에, 이전 premium 저장의 추가 보상은 premium에 보존한다.
 * 과금 인프라가 없는 현재 UI는 free 여정을 기본 진행으로 표시한다.
 *
 * 2026-09 Wave 12 D2 — 시즌은 **데이터**다. 예전에는 `'S1'` 문자열이 6파일 7곳에
 * 박혀 있었고 회전 메커니즘이 0건이라, 상한(30티어 = 6,000 XP)에 닿는 순간 탭이
 * 영구히 죽었다. 이제 시즌은 레지스트리(`SEASON_REGISTRY`)의 항목이고,
 * 보상 테이블은 시즌 서수에서 도출된다(`getSeasonRewards`). 시즌 1의 보상은
 * `SEASON_REWARDS` 그대로다 — 배율이 정확히 1이므로 값이 한 개도 바뀌지 않는다.
 */

import { BALANCE } from './constants';

export interface SeasonReward {
    gold?: number;
    premiumCurrency?: number;
    item?: string;
    title?: string;
}

export interface SeasonRewardRow {
    tier: number;
    free: SeasonReward;
    premium: SeasonReward;
}

/** 시즌 패스 XP 소스 */
export const SEASON_XP = {
    explore: 10,
    kill: 5,
    bossKill: 50,
    craft: 15,
    questComplete: 30,
    synthesize: 20,
    codexDiscover: 8,
} as const;

/** 티어당 필요 XP */
export const SEASON_TIER_XP = 200;

/** 시즌 패스 보상 테이블 (30티어) */
export const SEASON_REWARDS: SeasonRewardRow[] = [
    // 티어 1~10: 기본 보상
    { tier: 1,  free: { gold: 500 },               premium: { gold: 1000 } },
    { tier: 2,  free: { item: '중급 체력 물약' },    premium: { item: '상급 체력 물약' } },
    { tier: 3,  free: { gold: 800 },               premium: { premiumCurrency: 5 } },
    { tier: 4,  free: { item: '해독제' },           premium: { item: '분노의 물약' } },
    { tier: 5,  free: { gold: 1000 },              premium: { premiumCurrency: 10, gold: 1000 } },
    { tier: 6,  free: { item: '중급 마나 물약' },    premium: { item: '상급 마나 물약' } },
    { tier: 7,  free: { gold: 1200 },              premium: { gold: 2000 } },
    { tier: 8,  free: { item: '수호의 물약' },      premium: { item: '영웅의 물약' } },
    { tier: 9,  free: { gold: 1500 },              premium: { premiumCurrency: 10 } },
    { tier: 10, free: { gold: 2000, title: '시즌 선구자' }, premium: { premiumCurrency: 15 } },

    // 티어 11~20: 중급 보상
    { tier: 11, free: { gold: 2000 },              premium: { gold: 3000 } },
    { tier: 12, free: { item: '상급 체력 물약' },   premium: { item: '엘릭서' } },
    { tier: 13, free: { gold: 2500 },              premium: { premiumCurrency: 10 } },
    { tier: 14, free: { item: '상급 마나 물약' },   premium: { item: '영웅의 물약' } },
    { tier: 15, free: { gold: 3000 },              premium: { premiumCurrency: 20, gold: 3000 } },
    { tier: 16, free: { gold: 3000 },              premium: { gold: 5000 } },
    { tier: 17, free: { item: '분노의 물약' },     premium: { premiumCurrency: 10 } },
    { tier: 18, free: { gold: 3500 },              premium: { gold: 5000 } },
    { tier: 19, free: { item: '영웅의 물약' },     premium: { premiumCurrency: 15 } },
    { tier: 20, free: { gold: 5000, title: '시즌 정복자' }, premium: { premiumCurrency: 25 } },

    // 티어 21~30: 고급 보상
    { tier: 21, free: { gold: 5000 },              premium: { gold: 8000 } },
    { tier: 22, free: { item: '엘릭서' },          premium: { premiumCurrency: 15 } },
    { tier: 23, free: { gold: 5000 },              premium: { gold: 8000 } },
    { tier: 24, free: { item: '영웅의 물약' },     premium: { premiumCurrency: 15 } },
    { tier: 25, free: { gold: 8000 },              premium: { premiumCurrency: 30, gold: 10000 } },
    { tier: 26, free: { gold: 8000 },              premium: { gold: 12000 } },
    { tier: 27, free: { item: '엘릭서' },          premium: { premiumCurrency: 20 } },
    { tier: 28, free: { gold: 10000 },             premium: { gold: 15000 } },
    { tier: 29, free: { item: '엘릭서' },          premium: { premiumCurrency: 25 } },
    { tier: 30, free: { gold: 15000, title: '시즌 마스터' }, premium: { premiumCurrency: 50 } },
];

// cycle 287: INITIAL_SEASON_PASS dead export 제거 — consumer 0건. INITIAL_STATE.player.seasonPass는
//   gameReducer.ts:52에 inline 정의되어 있어 이 const는 dead duplicate.

// ── 시즌 레지스트리 (2026-09 Wave 12 D2) ──────────────────────────────────────

/** 한 시즌의 정의 — 식별자 · 서수 · 숫자 보상 배율. */
export interface SeasonDef {
    readonly id: string;
    readonly ordinal: number;
    readonly rewardScale: number;
}

/**
 * 명시적으로 정의된 시즌 목록. 여기 없는 서수는 `SEASON_ID_PREFIX + ordinal`로
 * 파생된다 — 레지스트리를 다 쓴다고 사다리가 끊기면 안 되기 때문이다(그것이 정확히
 * 이 트랙이 고치는 결함이다). 시즌마다 다른 식별자를 쓰고 싶으면 이 표에 추가한다.
 */
export const SEASON_REGISTRY = [
    { id: 'S1', ordinal: 1 },
    { id: 'S2', ordinal: 2 },
    { id: 'S3', ordinal: 3 },
    { id: 'S4', ordinal: 4 },
    { id: 'S5', ordinal: 5 },
    { id: 'S6', ordinal: 6 },
] as const;

/** 파생 시즌 식별자 접두사 (`S7`, `S8` …). */
export const SEASON_ID_PREFIX = 'S';

/** 첫 시즌 — 세이브 기본값과 마이그레이션 폴백이 참조하는 단일 원천. */
export const FIRST_SEASON = SEASON_REGISTRY[0];

const clampOrdinal = (ordinal: number): number => (
    Number.isFinite(ordinal) ? Math.max(1, Math.floor(ordinal)) : FIRST_SEASON.ordinal
);

/**
 * 시즌 식별자에서 서수를 읽는다. 구세이브(`'S1'`)와 파생 식별자(`'S7'`) 둘 다
 * 같은 규칙으로 읽히고, 모양이 다르면 `null`(호출부가 1로 폴백)이다.
 */
export const parseSeasonOrdinal = (seasonId?: string | null): number | null => {
    if (typeof seasonId !== 'string') return null;
    const registered = SEASON_REGISTRY.find((season) => season.id === seasonId);
    if (registered) return registered.ordinal;
    const match = seasonId.match(/^S(\d+)$/i);
    if (!match) return null;
    const ordinal = Number(match[1]);
    return Number.isInteger(ordinal) && ordinal >= 1 ? ordinal : null;
};

/**
 * 시즌 서수 → 숫자 보상 배율. 시즌 1은 정확히 1이고(= 기존 보상 보존),
 * 이후는 `BALANCE.SEASON_REWARD_SCALE_PER_SEASON`의 거듭제곱을
 * `BALANCE.SEASON_REWARD_SCALE_MAX`에서 자른다. 소수 둘째 자리로 반올림해
 * 부동소수 잔재가 표시/골든에 새지 않게 한다.
 */
export const getSeasonRewardScale = (ordinal: number): number => {
    const safeOrdinal = clampOrdinal(ordinal);
    const raw = BALANCE.SEASON_REWARD_SCALE_PER_SEASON ** (safeOrdinal - 1);
    return Math.round(Math.min(BALANCE.SEASON_REWARD_SCALE_MAX, raw) * 100) / 100;
};

/** 시즌 서수 → 시즌 정의. 레지스트리에 없으면 접두사 + 서수로 파생한다. */
export const getSeasonDef = (ordinal: number): SeasonDef => {
    const safeOrdinal = clampOrdinal(ordinal);
    const registered = SEASON_REGISTRY.find((season) => season.ordinal === safeOrdinal);
    return {
        id: registered ? registered.id : `${SEASON_ID_PREFIX}${safeOrdinal}`,
        ordinal: safeOrdinal,
        rewardScale: getSeasonRewardScale(safeOrdinal),
    };
};

/** 숫자 보상만 배율을 먹는다 — 아이템/칭호는 시즌이 바뀌어도 같은 것을 가리킨다. */
const scaleSeasonReward = (reward: SeasonReward, scale: number): SeasonReward => ({
    ...reward,
    ...(reward.gold !== undefined ? { gold: Math.round(reward.gold * scale) } : {}),
    ...(reward.premiumCurrency !== undefined
        ? { premiumCurrency: Math.round(reward.premiumCurrency * scale) }
        : {}),
});

const scaledRewardCache = new Map<number, readonly SeasonRewardRow[]>();

/**
 * 시즌 서수 → 그 시즌의 30티어 보상 테이블.
 * 배율이 1인 시즌(= 시즌 1)은 `SEASON_REWARDS` 자체를 그대로 돌려준다 —
 * "시즌 1의 보상은 한 값도 바뀌지 않는다"가 참조 동일성으로 증명된다.
 */
export const getSeasonRewards = (ordinal: number): readonly SeasonRewardRow[] => {
    const scale = getSeasonRewardScale(ordinal);
    if (scale === 1) return SEASON_REWARDS;
    const cached = scaledRewardCache.get(scale);
    if (cached) return cached;
    const scaled: readonly SeasonRewardRow[] = SEASON_REWARDS.map((row) => ({
        tier: row.tier,
        free: scaleSeasonReward(row.free, scale),
        premium: scaleSeasonReward(row.premium, scale),
    }));
    scaledRewardCache.set(scale, scaled);
    return scaled;
};
