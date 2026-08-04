/**
 * 30단계 시즌 여정 데이터.
 * 일반 플레이 보상은 free에, 이전 premium 저장의 추가 보상은 premium에 보존한다.
 * 과금 인프라가 없는 현재 UI는 free 여정을 기본 진행으로 표시한다.
 */

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
