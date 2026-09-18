import type { Item, Player } from '../types/index.js';
import { MAPS } from '../data/maps.js';

/**
 * 묘비(grave) 데이터 1건 — 로컬 세이브의 회수 대상과 공개 침공 대상 문서를 함께 표현한다.
 *
 * 구형 save에는 `item`(단수), 신형에는 `items[]`(복수)가 실린다(CLAUDE.md §8.2) —
 * `getGraveItems`가 양쪽 다 읽는다. `uid`/`guardPower`/`playerName`/`level`은 공개 침공
 * 대상 전용(useFirebaseSync가 Firestore에 업로드하는 문서 필드)이고, 로컬 회수용
 * 묘비에는 없다.
 */
export interface GraveEntry {
    loc?: string;
    gold?: number;
    item?: Item | null;
    items?: Item[];
    timestamp?: number;
    /** 공개 침공 대상 전용 — 묘비 주인의 세션 uid. */
    uid?: string;
    /** 공개 침공 대상 전용 — 침공 성공 확률 계산에 쓰는 수비력. */
    guardPower?: number;
    /** 공개 침공 대상 전용 — 표시용 플레이어 이름. */
    playerName?: string;
    /** 공개 침공 대상 전용 — 표시용 레벨. */
    level?: number;
}

type GraveInput = GraveEntry | GraveEntry[] | null | undefined;

const createGraveItem = (item: Item) => ({
    ...item,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

const sortGravesByLatest = (a: GraveEntry, b: GraveEntry) => (b?.timestamp || 0) - (a?.timestamp || 0);

// cycle 246: MAPS의 graveDropBonus 필드 dispatch — '영혼의 강' (lore: "묘비 아이템이 자주
//   발견됩니다") 등 graveDropBonus 정의 지역에서 묘비 보상 배율을 적용. 미정의 시 default 1.0.
const getGraveDropBonus = (loc: string | undefined): number => {
    if (!loc) return 1.0;
    const map = MAPS[loc];
    const bonus = map?.graveDropBonus;
    return typeof bonus === 'number' && bonus > 0 ? bonus : 1.0;
};

// cycle 609: random / now defaults 제거 — explicit default-elimination
//   pattern. CombatEngine.ts:1640 production caller에 Math.random / Date.now
//   명시 추가 후 1 production + 6 test caller 모두 3 args 명시.
export const buildGraveData = (player: Player, random: () => number, now: () => number): GraveEntry => {
    let droppedItems: Item[] = [];
    const tradableItems = Array.isArray(player?.inv)
        ? player.inv.filter((item: Item) => !item?.id?.startsWith('starter_'))
        : [];

    const dropBonus = getGraveDropBonus(player?.loc);

    if (tradableItems.length > 0) {
        const shuffled = [...tradableItems].sort(() => random() - 0.5);
        const baseDropCount = random() < 0.5 ? 1 : 2;
        // cycle 246: graveDropBonus가 dropCount에도 반영 (gold와 paired). cap에 inv length.
        const boostedDropCount = Math.max(baseDropCount, Math.ceil(baseDropCount * dropBonus));
        const dropCount = Math.min(shuffled.length, boostedDropCount);
        droppedItems = shuffled.slice(0, dropCount);
    }

    return {
        loc: player?.loc || '',
        gold: Math.floor((player?.gold || 0) / 2 * dropBonus),
        item: droppedItems[0] || null,
        items: droppedItems,
        timestamp: now()
    };
};

export const normalizeGraves = (grave: GraveInput): GraveEntry[] => {
    if (!grave) return [];

    const graves = Array.isArray(grave) ? grave : [grave];
    return graves
        .filter((entry): entry is GraveEntry => Boolean(entry && typeof entry === 'object' && entry.loc))
        .sort(sortGravesByLatest);
};

export const appendGrave = (grave: GraveInput, nextGrave: GraveInput): GraveEntry[] | null => {
    const merged = [...normalizeGraves(grave), ...normalizeGraves(nextGrave)];
    return merged.length > 0 ? merged.sort(sortGravesByLatest) : null;
};

/**
 * H5(a): 공개 묘비 목록에서 내 묘비를 제외한다.
 *
 * 묘비 문서는 세션 uid(engine state.uid)를 문서 id이자 `uid` 필드로 기록한다
 * (useFirebaseSync의 공개 묘비 업로드). 이전 화면 코드는 존재하지 않는 `player.uid`와
 * 비교해 필터가 항상 통과했고 자기 묘비가 침공 후보로 노출됐다.
 * 세션 uid를 모르는 상태(오프라인 · 인증 전)에서는 걸러낼 기준이 없으므로 그대로 둔다.
 */
export const excludeOwnGraves = (entries: GraveEntry[] | null | undefined, sessionUid?: string | null): GraveEntry[] => {
    const list = Array.isArray(entries) ? entries : [];
    if (!sessionUid) return list;
    return list.filter((entry) => entry?.uid !== sessionUid);
};

export const getGravesAtLoc = (grave: GraveInput, loc: string | undefined): GraveEntry[] => (
    normalizeGraves(grave).filter((entry) => entry.loc === loc)
);

export const removeGravesAtLoc = (grave: GraveInput, loc: string | undefined): GraveEntry[] | null => {
    const remaining = normalizeGraves(grave).filter((entry) => entry.loc !== loc);
    return remaining.length > 0 ? remaining : null;
};

export const getGraveItems = (grave: GraveEntry | null | undefined): Item[] => (
    Array.isArray(grave?.items)
        ? grave.items
        : grave?.item
            ? [grave.item]
            : []
);

interface GraveRecoveryGroup {
    loc: string | undefined;
    graves: GraveEntry[];
    gold: number;
    items: Item[];
    latestTimestamp: number;
}

export const getGraveRecoveryGroups = (grave: GraveInput, currentLoc: string | undefined) => {
    const groups = new Map<string | undefined, GraveRecoveryGroup>();

    normalizeGraves(grave).forEach((graveEntry) => {
        const existing = groups.get(graveEntry.loc) || {
            loc: graveEntry.loc,
            graves: [],
            gold: 0,
            items: [],
            latestTimestamp: 0,
        };

        existing.graves.push(graveEntry);
        existing.gold += Math.max(0, graveEntry.gold || 0);
        existing.items.push(...getGraveItems(graveEntry));
        existing.latestTimestamp = Math.max(existing.latestTimestamp, graveEntry.timestamp || 0);
        groups.set(graveEntry.loc, existing);
    });

    return [...groups.values()]
        .map((group) => ({
            ...group,
            count: group.graves.length,
            atCurrentLocation: group.loc === currentLoc,
        }))
        .sort((a, b) => (
            Number(b.atCurrentLocation) - Number(a.atCurrentLocation)
            || b.latestTimestamp - a.latestTimestamp
        ));
};

export const calcInvasionChance = (playerAtk: number, guardPower: number): number => {
    const atk = Math.max(1, playerAtk);
    const guard = Math.max(1, guardPower);
    return Math.min(0.9, atk / (atk + guard));
};

export const resolveInvasion = (targetGrave: GraveEntry, playerAtk: number) => {
    const chance = calcInvasionChance(playerAtk, targetGrave.guardPower || 10);
    const success = Math.random() < chance;
    // W11: 묘비 아이템 읽기는 언제나 getGraveItems 경유 — 구형 save의 단수 `item`도 흡수한다(§8-2).
    const items = getGraveItems(targetGrave);
    const reward = success && items.length > 0
        ? { ...items[Math.floor(Math.random() * items.length)], id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` }
        : null;
    return { success, reward, chance };
};

export const resolveGraveRecovery = (player: Player, grave: GraveInput) => {
    const graves = normalizeGraves(grave);
    const recoveredItems = graves
        .flatMap((entry) => getGraveItems(entry))
        .map((item) => createGraveItem(item));
    const goldGain = graves.reduce((total, entry) => total + Math.max(0, entry?.gold || 0), 0);
    const updatedPlayer: Player = {
        ...player,
        gold: (player?.gold || 0) + goldGain,
        inv: [...(player?.inv || []), ...recoveredItems],
        stats: {
            ...(player?.stats || {}),
            total_gold: (player?.stats?.total_gold || 0) + goldGain,
        }
    };
    const summary = [`유해 회수: ${goldGain}G 획득`];

    if (recoveredItems.length > 0) {
        summary.push(`${recoveredItems.map((item) => item.name).join(', ')} 획득`);
    }

    if (graves.length > 1) {
        summary.push(`${graves.length}구의 유해 정리`);
    }

    return {
        updatedPlayer,
        recoveredItems,
        logMsg: summary.join(', ')
    };
};
