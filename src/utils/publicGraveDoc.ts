import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { findItemByName } from './gameUtils';
import { clampPublicGraveGold, getGraveItems, normalizeGraves, type GraveInput } from './graveUtils';
import { resolveCatalogItemName } from './dimensionGrave';
import type { Item, Player } from '../types';

/** 공개 묘비 문서의 유품 한 칸 — 카탈로그 이름과 그 카탈로그 종류뿐이다. */
export interface PublicGraveItem {
    name: string;
    type: Item['type'];
}

/** 사망 때 올리는 공개 묘비 문서(서버 시각 `createdAt`은 쓰는 쪽이 붙인다 — `platform/publicGraveFirestore`). */
export interface PublicGraveDoc {
    playerName: string;
    level: number;
    loc: string;
    items: PublicGraveItem[];
    gold: number;
    guardPower: number;
    uid: string;
}

/**
 * 유품은 카탈로그 이름과 종류만 올린다 — 읽는 쪽(`toDimensionGraveCandidate`)이 문서의 아이템 수치를 믿지 않고 카탈로그 이름만
 * 남기므로 그 밖의 값은 올릴 이유가 없다. 문자열만 담으니 Firestore 직렬화가 실패할 수 없다(`undefined` 필드 하나면 `setDoc`이
 * 동기로 던지고, 사망 화면 이펙트의 `.catch`는 그것을 잡지 못한다). 모르는 아이템은 빼고 아는 것만 상한까지 담는다.
 */
export const toPublicGraveItems = (items: readonly Item[]): PublicGraveItem[] => items.flatMap((item) => {
    const name = resolveCatalogItemName(item);
    const type = name ? findItemByName(name)?.type : undefined;
    return name && type ? [{ name, type }] : [];
}).slice(0, BALANCE.DIMENSION_GRAVE_UPLOAD_ITEM_LIMIT);

/**
 * 공개 묘비 문서(Wave 70 — 다른 차원의 묘비의 원천). 회수용 로컬 묘비(`player.grave`)는 건드리지 않는다:
 * `gold`의 rules 상한 클램프(`clampPublicGraveGold`, Wave 15 G2)는 이 문서에만 건다 — 로컬에 걸면 플레이어 자기 골드가 사라진다.
 * `guardPower`는 rules가 필수 키로 요구해 남긴다(읽는 곳이 없다).
 */
export const buildPublicGraveDoc = (player: Player, grave: GraveInput, uid: string): PublicGraveDoc => {
    const graveEntries = normalizeGraves(grave);
    return {
        playerName: player.name || MSG.DIMENSION_GRAVE_UNKNOWN_NAME,
        level: player.level || 1,
        loc: player.loc || MSG.DIMENSION_GRAVE_UNKNOWN_PLACE,
        items: toPublicGraveItems(graveEntries.flatMap((entry) => getGraveItems(entry))),
        gold: clampPublicGraveGold(graveEntries.reduce((sum, entry) => sum + (entry?.gold || 0), 0)),
        guardPower: player.atk || 0,
        uid,
    };
};
