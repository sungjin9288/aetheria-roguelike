import { BALANCE, CONSTANTS } from '../data/constants';
import { MSG } from '../data/messages';
import { MAPS } from '../data/maps';
import { findItemByName } from './gameUtils';
import { getGraveItems, type GraveEntry } from './graveUtils';
import { isEquipmentItem, resolveEquipmentBaseIdentity, resolveEquipmentBaseNameFromName } from './equipmentBaseIdentity';
import { getEffectiveMaxHp } from '../systems/vitals';
import type { DimensionGraveRef, GameEvent } from '../types/session';
import type { Item, Player } from '../types';

/**
 * 다른 차원의 묘비(2026-10 Wave 70, 소유자 결정 "이벤트식으로 발생 · 망령과 실제 전투 · 실제 플레이어 묘비만").
 *
 * 다른 플레이어가 죽으며 올린 공개 묘비 문서가 탐험 이벤트로 나타난다. 문서는 남이 쓴 데이터라 그대로 믿지 않는다 —
 * 이름은 길이를 자르고, 지역은 아는 지역일 때만 보이고, 유품은 **카탈로그에 있는 이름만** 남긴다. 승리 보상은 그 이름의
 * 카탈로그 아이템이라 문서에 적힌 아이템 수치(강화 · 위조된 능력치)는 들어오지 않는다.
 *
 * 하루에 만나는 묘비는 `BALANCE.DAILY_INVADE_LIMIT`개이고 같은 묘비는 그날 다시 나오지 않는다(`stats.lastInvadeDate` ·
 * `dailyInvadeCount` · `invadedGraveUids`). 풀이 비었거나 오늘 다 만났으면 후보가 없고, 탐험은 이 판정에 난수를 쓰지 않는다 —
 * 오프라인 · 다른 플레이어 묘비가 없는 동안 게임은 이 기능이 없던 때와 바이트 단위로 같다.
 */

export interface DimensionGraveCandidate {
    uid: string;
    playerName: string;
    level: number;
    place: string | null;
    /** 카탈로그에 있는 유품 이름(중복 없음, 문서 순서). */
    itemNames: string[];
}

/** 아이템 하나가 가리키는 카탈로그 이름 — 장비는 바탕 장비(접두어 · 위조 이름은 바탕으로), 그 밖은 이름 그대로. 모르면 null. */
export const resolveCatalogItemName = (item: Item | null | undefined): string | null => {
    if (!item || typeof item.name !== 'string' || !item.name) return null;
    if (isEquipmentItem(item)) {
        const base = resolveEquipmentBaseIdentity(item)?.name ?? resolveEquipmentBaseNameFromName(item.type, item.name);
        return base && findItemByName(base) ? base : null;
    }
    return findItemByName(item.name) ? item.name : null;
};

const clampLevel = (value: unknown): number => {
    const level = Math.floor(Number(value));
    return Number.isFinite(level) ? Math.min(CONSTANTS.MAX_LEVEL, Math.max(1, level)) : 1;
};

const cleanPlayerName = (value: unknown): string => {
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    return name ? Array.from(name).slice(0, BALANCE.DIMENSION_GRAVE_NAME_MAX).join('') : MSG.DIMENSION_GRAVE_UNKNOWN_NAME;
};

/** 공개 묘비 문서 하나를 후보로 — uid가 없거나 카탈로그 유품이 하나도 없으면 null. */
export const toDimensionGraveCandidate = (entry: GraveEntry | null | undefined): DimensionGraveCandidate | null => {
    if (!entry || typeof entry.uid !== 'string' || !entry.uid) return null;
    const itemNames = [...new Set(getGraveItems(entry).map(resolveCatalogItemName).filter((name): name is string => Boolean(name)))];
    if (itemNames.length === 0) return null;
    return {
        uid: entry.uid,
        playerName: cleanPlayerName(entry.playerName),
        level: clampLevel(entry.level),
        place: typeof entry.loc === 'string' && Object.prototype.hasOwnProperty.call(MAPS, entry.loc) ? entry.loc : null,
        itemNames,
    };
};

/** 오늘 만난 묘비 — 날짜가 바뀌면 빈 기록이다. */
export const getDimensionGraveDay = (stats: Player['stats'], today: string) => {
    const sameDay = stats?.lastInvadeDate === today;
    return {
        met: sameDay && Array.isArray(stats?.invadedGraveUids) ? stats.invadedGraveUids : [],
        count: sameDay ? Math.max(0, Number(stats?.dailyInvadeCount) || 0) : 0,
    };
};

/**
 * 이번 탐험에 나올 수 있는 묘비 — 내 묘비 · 오늘 만난 묘비 · 유품 없는 묘비를 빼고, 오늘 한도를 다 썼으면 빈 목록.
 * 이 함수는 난수를 쓰지 않는다(빈 목록이면 탐험이 이 기능의 난수를 하나도 쓰지 않는다).
 */
export const selectDimensionGraveCandidates = (
    pool: readonly GraveEntry[] | null | undefined,
    player: Player,
    sessionUid: string | null | undefined,
    today: string,
): DimensionGraveCandidate[] => {
    if (!Array.isArray(pool) || pool.length === 0) return [];
    const { met, count } = getDimensionGraveDay(player?.stats, today);
    if (count >= BALANCE.DAILY_INVADE_LIMIT) return [];
    const seen = new Set<string>(met);
    if (sessionUid) seen.add(sessionUid);
    const candidates: DimensionGraveCandidate[] = [];
    for (const entry of pool) {
        const candidate = toDimensionGraveCandidate(entry);
        if (!candidate || seen.has(candidate.uid)) continue;
        seen.add(candidate.uid);
        candidates.push(candidate);
    }
    return candidates;
};

/** 후보 중 하나와 그 묘비의 유품 하나를 고른다(후보가 있을 때만 부른다 — 난수 2회). */
export const pickDimensionGrave = (candidates: readonly DimensionGraveCandidate[], rng: () => number): DimensionGraveRef => {
    const candidate = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    const itemName = candidate.itemNames[Math.min(candidate.itemNames.length - 1, Math.floor(rng() * candidate.itemNames.length))];
    return {
        uid: candidate.uid,
        playerName: candidate.playerName,
        level: candidate.level,
        place: candidate.place,
        itemName,
    };
};

/** 묘비를 만났다 — 오늘 만난 수와 uid를 남긴다(같은 uid는 한 번). */
export const markDimensionGraveMet = (stats: Player['stats'], uid: string, today: string): NonNullable<Player['stats']> => {
    const { met, count } = getDimensionGraveDay(stats, today);
    const base = stats || {};
    if (met.includes(uid)) return base;
    return { ...base, lastInvadeDate: today, dailyInvadeCount: count + 1, invadedGraveUids: [...met, uid] };
};

/** "기도"의 실제 회복량 — 실효 최대 생명의 비율, 모자란 생명까지만. */
export const getDimensionGravePrayerHeal = (player: Player): number => {
    const max = getEffectiveMaxHp(player);
    const planned = Math.floor(max * BALANCE.DIMENSION_GRAVE_PRAYER_HEAL_RATIO);
    return Math.max(0, Math.min(planned, max - Math.max(0, Number(player?.hp) || 0)));
};

export const buildDimensionGraveEvent = (ref: DimensionGraveRef): GameEvent => ({
    title: MSG.DIMENSION_GRAVE_TITLE,
    isDimensionGrave: true,
    dimensionGrave: ref,
    desc: MSG.DIMENSION_GRAVE_DESC(ref.playerName, ref.level, ref.place ?? MSG.DIMENSION_GRAVE_UNKNOWN_PLACE, ref.itemName),
    choices: [MSG.DIMENSION_GRAVE_CHOICE_INVADE, MSG.DIMENSION_GRAVE_CHOICE_PRAY, MSG.DIMENSION_GRAVE_CHOICE_LEAVE],
    outcomes: [
        { choiceIndex: 0, graveEffect: 'invade' },
        { choiceIndex: 1, graveEffect: 'pray' },
        { choiceIndex: 2, graveEffect: 'leave' },
    ],
});
