import { DB } from '../data/db';

/**
 * shopRotation.js — 날짜 시드 기반 결정론적 상점 생성
 * 매일 다른 추천 아이템, 주간 특별 아이템
 */

/**
 * 날짜 기반 시드 해시 (간단한 결정론적 RNG)
 */
const dateHash = (dateStr: any, salt: any = 0) => {
    let hash = salt;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

/**
 * 시드 기반 배열 셔플 (Fisher-Yates, deterministic)
 */
const seededShuffle = (arr: any, seed: any) => {
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
 * 일일 추천 아이템 3개 (10% 할인 — item.price에 이미 적용됨)
 * @param {number} playerLevel
 * @returns {{ items: Object[] }}
 *
 * cycle 355: discount 필드 제거 — ShopPanel은 dailyDeals.items만 read. 외부
 *   read 0건이던 dead 출력. 0.9 multiplier는 함수 내부에서 item.price에 이미
 *   적용 완료(originalPrice 보존), 별도 discount 비율 노출은 redundant.
 */
export const getDailyDeals = (playerLevel: any = 1) => {
    const today = getToday();
    const seed = dateHash(today, 42);

    // 플레이어 레벨에 맞는 티어 범위
    const maxTier = playerLevel < 10 ? 2 : playerLevel < 20 ? 3 : playerLevel < 35 ? 4 : 5;

    const allItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a: any) => a.type === 'armor'),
        ...(DB.ITEMS.consumables || []),
    ].filter((item: any) => (item.tier || 1) <= maxTier);

    // cycle 436: 일일 딜 마커 제거 — production read 0건이던 dead 출력
    //   (cycle 415 주간 특별 마커 정리 paired completion). cycle 355는 회귀
    //   가드로 보존했으나 그 가드 자체가 유일 read였음 (circular guard).
    const shuffled = seededShuffle(allItems, seed);
    const items = shuffled.slice(0, 3).map((item: any) => ({
        ...item,
        originalPrice: item.price,
        price: Math.floor(item.price * 0.9),
    }));

    return { items };
};

/**
 * 주간 특별 아이템 1개 (희귀+ 등급)
 * @param {number} playerLevel
 * @returns {Object|null}
 */
export const getWeeklySpecial = (playerLevel: any = 1) => {
    const weekKey = getWeekKey();
    const seed = dateHash(weekKey, 777);

    const maxTier = playerLevel < 15 ? 3 : playerLevel < 30 ? 4 : 5;

    const rareItems = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []).filter((a: any) => a.type === 'armor'),
    ].filter((item: any) => (item.tier || 1) >= 3 && (item.tier || 1) <= maxTier);

    if (rareItems.length === 0) return null;

    const shuffled = seededShuffle(rareItems, seed);
    const item = shuffled[0];
    // cycle 415: isWeeklySpecial 마커 제거 — src/, tests/ read 0건이던 dead 출력.
    //   originalPrice / price는 ShopPanel line-through 표시에 사용 보존.
    return {
        ...item,
        originalPrice: item.price,
        price: Math.floor(item.price * 0.85),
    };
};

