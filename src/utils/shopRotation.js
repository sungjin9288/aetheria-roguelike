import { DB } from '../data/db';

/**
 * shopRotation.js — 날짜 시드 기반 결정론적 상점 생성
 * 매일 다른 추천 아이템, 주간 특별 아이템
 */

/**
 * 날짜 기반 시드 해시 (간단한 결정론적 RNG)
 */
const dateHash = (dateStr, salt = 0) => {
    let hash = salt;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

/**
 * 시드 기반 배열 셔플 (Fisher-Yates, deterministic)
 */
const seededShuffle = (arr, seed) => {
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

/**
 * 일일 추천 아이템 3개 (10% 할인)
 * @param {number} playerLevel
 * @returns {{ items: Object[], discount: number }}
 */
export const getDailyDeals = (playerLevel = 1) => {
    const today = getToday();
    const seed = dateHash(today, 42);

    // 플레이어 레벨에 맞는 티어 범위
    const maxTier = playerLevel < 10 ? 2 : playerLevel < 20 ? 3 : playerLevel < 35 ? 4 : 5;

    const allItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a) => a.type === 'armor'),
        ...(DB.ITEMS.consumables || []),
    ].filter((item) => (item.tier || 1) <= maxTier);

    const shuffled = seededShuffle(allItems, seed);
    const items = shuffled.slice(0, 3).map((item) => ({
        ...item,
        originalPrice: item.price,
        price: Math.floor(item.price * 0.9),
        isDailyDeal: true,
    }));

    return { items, discount: 0.1 };
};

/**
 * 주간 특별 아이템 1개 (희귀+ 등급)
 * @param {number} playerLevel
 * @returns {Object|null}
 */
export const getWeeklySpecial = (playerLevel = 1) => {
    const weekKey = getWeekKey();
    const seed = dateHash(weekKey, 777);

    const maxTier = playerLevel < 15 ? 3 : playerLevel < 30 ? 4 : 5;

    const rareItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a) => a.type === 'armor'),
    ].filter((item) => (item.tier || 1) >= 3 && (item.tier || 1) <= maxTier);

    if (rareItems.length === 0) return null;

    const shuffled = seededShuffle(rareItems, seed);
    const item = shuffled[0];
    return {
        ...item,
        originalPrice: item.price,
        price: Math.floor(item.price * 0.85),
        isWeeklySpecial: true,
    };
};

/**
 * 소재 상점 (레벨 기반 소재 판매)
 * @param {number} playerLevel
 * @returns {Object[]}
 */
export const getMaterialShop = (playerLevel = 1) => {
    const today = getToday();
    const seed = dateHash(today, 123);

    const materials = (DB.ITEMS.materials || []).filter((m) => {
        if (playerLevel < 10) return m.price <= 50;
        if (playerLevel < 20) return m.price <= 200;
        if (playerLevel < 35) return m.price <= 600;
        return true;
    });

    const shuffled = seededShuffle(materials, seed);
    // 레벨에 따라 5~8개 소재 판매
    const count = Math.min(materials.length, playerLevel < 10 ? 5 : playerLevel < 25 ? 6 : 8);
    return shuffled.slice(0, count).map((mat) => ({
        ...mat,
        price: Math.floor(mat.price * 2.5), // 소재 상점은 마크업
        isMaterialShop: true,
    }));
};
