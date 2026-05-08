import { BALANCE } from './constants';

/**
 * premiumShop.js — 프리미엄 상점 아이템 정의
 * 에테르 크리스탈로 구매 가능한 아이템/서비스 목록
 */
export const PREMIUM_SHOP: any = {
    /** 인벤토리 확장 */
    invExpand: {
        id: 'inv_expand',
        name: '인벤토리 확장',
        desc: `인벤토리 슬롯 +${BALANCE.INV_EXPAND_AMOUNT}`,
        cost: BALANCE.INV_EXPAND_COST,
        category: 'utility',
        repeatable: true,
    },
    /** 합성 보호 (1회) */
    synthProtect: {
        id: 'synth_protect',
        name: '합성 보호권',
        desc: '합성 실패 시 재료 보존 (1회)',
        cost: BALANCE.SYNTHESIS_PROTECT_COST,
        category: 'utility',
        repeatable: true,
    },
    /** 즉시 부활 */
    revive: {
        id: 'revive',
        name: '즉시 부활',
        desc: '사망 시 HP/MP 50% 회복 후 즉시 부활',
        cost: BALANCE.REVIVE_COST,
        category: 'utility',
        repeatable: true,
    },
    /** 코스메틱 칭호 */
    cosmeticTitles: [
        { id: 'title_stargazer', name: '별을 보는 자', cost: 100, category: 'cosmetic' },
        { id: 'title_voidwalker', name: '공허를 걷는 자', cost: 100, category: 'cosmetic' },
        { id: 'title_aetherborn', name: '에테르의 아이', cost: 150, category: 'cosmetic' },
        { id: 'title_worldender', name: '세계의 끝', cost: 200, category: 'cosmetic' },
    ],
};

// cycle 285: PREMIUM_FREE_SOURCES export 제거 — src/ + tests/ consumer 0건이던 dead export.
//   Premium 무료 획득처 정보는 PremiumShop UI에 직접 inline로 표시하거나 별도 문서화.
