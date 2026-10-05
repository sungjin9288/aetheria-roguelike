import { DB } from '../data/db';
import type { GameMap } from '../types/index.js';

/**
 * shopRotation.js — 날짜 시드 기반 결정론적 상점 생성
 * 매일 다른 추천 아이템, 주간 특별 아이템
 */

/**
 * 날짜 기반 시드 해시 (간단한 결정론적 RNG)
 */
// cycle 524: salt default 0 제거 — 2 callsite (line 63 dateHash(today, 42) +
//   line 94 dateHash(weekKey, 777)) 모두 명시 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 21번째 batch (cycle 502-523).
const dateHash = (dateStr: string, salt: number): number => {
    let hash = salt;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

/**
 * 시드 기반 배열 셔플 (Fisher-Yates, deterministic)
 * 입력 배열의 요소 타입을 그대로 보존한다 — 소비자(getDailyDeals/getWeeklySpecial/
 * getCanonicalShopOffer → economyHandlers.ts)가 구체 Item으로 추론된다.
 */
const seededShuffle = <T>(arr: readonly T[], seed: number): T[] => {
    const result = [...arr];
    let s = seed;
    for (let i = result.length - 1; i > 0; i--) {
        s = ((s * 1103515245 + 12345) & 0x7fffffff);
        const j = s % (i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

/**
 * 오늘 날짜 문자열 (YYYY-MM-DD)
 */
const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 이번 주 월요일 날짜 문자열
 */
const getWeekKey = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};

export const getShopMaxTier = (location: string) => {
    const mapData: GameMap = DB.MAPS?.[location] || {};
    const mapLevel = typeof mapData.level === 'number' ? mapData.level : 1;
    const tierFromLevel = mapLevel < 10 ? 1 : mapLevel < 20 ? 2 : mapLevel < 30 ? 3 : mapLevel < 40 ? 4 : mapLevel < 50 ? 5 : 6;
    const safeBonus = mapData.type === 'safe' && mapLevel > 1 ? 1 : 0;
    const shopBonus = mapData.shopBonus ? 1 : 0;
    const derivedTier = Math.min(6, tierFromLevel + safeBonus + shopBonus);
    // 2026-10 Wave 62 C20: 지역이 선언한 판매 등급 상한(북부 요새 "판매 등급 3 상점")이 있으면 그 아래로 자른다 —
    //   레벨 규칙만 보던 동안 북부 요새는 5등급까지 팔았다. 상점 화면의 "판매 등급"과 구매 리듀서가 이 값을 읽는다.
    const declaredCap = getDeclaredShopTierCap(location);
    return declaredCap === null ? derivedTier : Math.min(derivedTier, declaredCap);
};

/** 지역 데이터가 선언한 판매 등급 상한(`shopMaxTier`) — 없으면 null. `getShopMaxTier`가 레벨 규칙 위에 건다. */
function getDeclaredShopTierCap(location: string): number | null {
    const cap = DB.MAPS?.[location]?.shopMaxTier;
    return typeof cap === 'number' && Number.isFinite(cap) ? cap : null;
}

/** 이 상점의 구매 가격 배율 — 지역 데이터(`shopPriceMult`, 황금 왕국 "물가가 높지만")가 정본이고 없으면 1이다(Wave 62 C20). */
export const getShopPriceMult = (location: string): number => {
    const mult = DB.MAPS?.[location]?.shopPriceMult;
    return typeof mult === 'number' && Number.isFinite(mult) && mult > 0 ? mult : 1;
};

/**
 * 이 상점에서 사는 값 — 상점 화면(`ShopPanel`)과 구매 리듀서(`getCanonicalShopOffer` → `BUY_SHOP_ITEM`)가 같이 읽는다.
 * 재고 · 오늘의 할인 · 주간 특별 상품 모두 이 값을 거친다. 판매가(`getSellPrice`)는 바뀌지 않는다 — 산 물건은 기본가로 저장된다.
 */
export const getShopBuyPrice = (location: string, basePrice: number): number => {
    const mult = getShopPriceMult(location);
    return mult === 1 ? basePrice : Math.round(basePrice * mult);
};

/**
 * 이 상점이 파는 등급인가 — 재고 · 오늘의 할인 · 주간 특별 상품이 모두 이 상점의 판매 등급(`getShopMaxTier`, 상점 머리말의
 * "판매 등급 N") 안에서 나온다. 2026-10 Wave 63 (원장 §63.8): 선언한 상한이 있는 상점(북부 요새, Wave 62 C20)만 거르던 동안
 * 판매 등급 1인 시작의 마을이 Lv25 플레이어에게 4등급 할인 · 주간 특별 상품을 팔았다 — 상점 하나에 두 규칙이었다.
 */
const passesShopTier = (location: string, item: { tier?: number }) => (item.tier || 1) <= getShopMaxTier(location);

// 병합(2026-09): 03e8b88에서 "파일 내부 전용"이라 export를 내렸으나, Codex가 추가한
//   contentReachability / equipmentEconomyAudit / equipmentBaseIdentity가 이 카탈로그를
//   단일 원천으로 참조한다 — 외부 소비자가 생겼으므로 export를 되살린다.
export const getShopCatalog = (location: string) => {
    const maxTier = getShopMaxTier(location);
    return [
        ...(DB.ITEMS.consumables || []),
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []),
    ].filter((item) => (item.tier || 1) <= maxTier);
};

/**
 * 일일 추천 아이템 3개 (10% 할인 — item.price에 이미 적용됨)
 * @param {number} playerLevel
 * @returns {{ items: Object[] }}
 *
 * cycle 355: discount 필드 제거 — ShopPanel은 dailyDeals.items만 read. 외부
 *   read 0건이던 dead 출력. 0.9 multiplier는 함수 내부에서 item.price에 이미
 *   적용 완료(originalPrice 보존), 별도 discount 비율 노출은 redundant.
 */
// cycle 524: playerLevel default 1 제거 — 1 callsite (ShopPanel.tsx:161
//   getDailyDeals(player.level || 1)) 명시 전달 + || 1 number 보장이라
//   default 도달 불가.
const buildDailyDealOffers = (playerLevel: number, location: string) => {
    const today = getToday();
    const seed = dateHash(today, 42);

    // 플레이어 레벨에 맞는 티어 범위
    const maxTier = playerLevel < 10 ? 2 : playerLevel < 20 ? 3 : playerLevel < 35 ? 4 : 5;

    const allItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a) => a.type === 'armor'),
        ...(DB.ITEMS.consumables || []),
    ].filter((item) => (item.tier || 1) <= maxTier && passesShopTier(location, item));

    // cycle 436: 일일 딜 마커 제거 — production read 0건이던 dead 출력
    //   (cycle 415 주간 특별 마커 정리 paired completion). cycle 355는 회귀
    //   가드로 보존했으나 그 가드 자체가 유일 read였음 (circular guard).
    const shuffled = seededShuffle(allItems, seed);
    // 2026-10 Wave 62 C20: 값은 상점 가격 규칙(`getShopBuyPrice`)을 거친다 — 정가(취소선)와 할인가 모두 이 상점의 값이다.
    //   제안은 기본 아이템(`item`)을 그대로 들고 다녀 구매 리듀서가 기본가로 저장한다(판매가 불변).
    return shuffled.slice(0, 3).map((item) => ({
        item,
        listPrice: getShopBuyPrice(location, item.price ?? 0),
        price: getShopBuyPrice(location, Math.floor((item.price ?? 0) * 0.9)),
    }));
};

export const getDailyDeals = (playerLevel: number, location: string) => {
    const items = buildDailyDealOffers(playerLevel, location).map(({ item, listPrice, price }) => ({
        ...item,
        originalPrice: listPrice,
        price,
    }));

    return { items };
};

/**
 * 주간 특별 아이템 1개 (희귀+ 등급)
 * @param {number} playerLevel
 * @returns {Object|null}
 */
// cycle 524: playerLevel default 1 제거 — 1 callsite (ShopPanel.tsx:162
//   getWeeklySpecial(player.level || 1)) 명시 전달 + || 1 number 보장이라
//   default 도달 불가.
const buildWeeklySpecialOffer = (playerLevel: number, location: string) => {
    const weekKey = getWeekKey();
    const seed = dateHash(weekKey, 777);

    const maxTier = playerLevel < 15 ? 3 : playerLevel < 30 ? 4 : 5;

    const rareItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a) => a.type === 'armor'),
    ].filter((item) => (item.tier || 1) >= 3 && (item.tier || 1) <= maxTier && passesShopTier(location, item));

    if (rareItems.length === 0) return null;

    const shuffled = seededShuffle(rareItems, seed);
    const item = shuffled[0];
    return {
        item,
        listPrice: getShopBuyPrice(location, item.price ?? 0),
        price: getShopBuyPrice(location, Math.floor((item.price ?? 0) * 0.85)),
    };
};

export const getWeeklySpecial = (playerLevel: number, location: string) => {
    const offer = buildWeeklySpecialOffer(playerLevel, location);
    if (!offer) return null;
    // cycle 415: isWeeklySpecial 마커 제거 — src/, tests/ read 0건이던 dead 출력.
    //   originalPrice / price는 ShopPanel line-through 표시에 사용 보존.
    return {
        ...offer.item,
        originalPrice: offer.listPrice,
        price: offer.price,
    };
};

export const getCanonicalShopOffer = (
    source: string,
    itemName: string,
    playerLevel: number,
    location: string,
) => {
    // 산 물건은 기본 아이템 그대로(기본가) 저장된다 — 할인 · 상점 할증은 낸 값에만 있다(판매가 불변).
    if (source === 'daily') {
        const deal = buildDailyDealOffers(playerLevel, location).find((offer) => offer.item.name === itemName);
        if (!deal) return null;
        return { item: { ...deal.item, price: deal.item.price ?? 0 }, price: deal.price };
    }
    if (source === 'weekly') {
        const special = buildWeeklySpecialOffer(playerLevel, location);
        if (!special || special.item.name !== itemName) return null;
        return { item: { ...special.item, price: special.item.price ?? 0 }, price: special.price };
    }
    if (source !== 'stock') return null;

    const item = getShopCatalog(location).find((entry) => entry.name === itemName);
    return item ? { item, price: getShopBuyPrice(location, item.price || 0) } : null;
};
