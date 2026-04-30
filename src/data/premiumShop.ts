import { BALANCE } from './constants';

/**
 * premiumShop.js — 프리미엄 상점 아이템 정의
 * 에테르 크리스탈로 구매 가능한 아이템/서비스 목록
 */
export const PREMIUM_SHOP = {
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

/**
 * 프리미엄 재화 무료 획득처 요약
 * - 도감 마일스톤: 10~25개씩
 * - 첫 보스 처치: 10~30개
 * - 프레스티지 보상: 회차당 20~50개
 * - 업적 보상: 일부 업적에 포함
 */
export const PREMIUM_FREE_SOURCES = [
    { source: '도감 마일스톤', amount: '10~25', desc: '카테고리별 수집 목표 달성' },
    { source: '첫 보스 처치', amount: '10~30', desc: '각 보스 최초 처치 보상' },
    { source: '프레스티지', amount: '20~50', desc: '환생 시 축적 보상' },
    { source: '업적 달성', amount: '5~20', desc: '특정 업적 보상에 포함' },
];
