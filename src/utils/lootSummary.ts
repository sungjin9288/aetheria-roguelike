import { MSG } from '../data/messages';
import { findItemByName, getItemRarity } from './gameUtils';
import { EQUIPMENT_TYPES, resolveEquipmentBaseNameFromName } from './equipmentBaseIdentity';

/**
 * 전리품 이름 요약(2026-10 Wave 67) — 전투 결과 카드와 전투 정리 로그가 같은 판정을 읽는다.
 *
 * 전리품 목록(`PostCombatResult.items`)은 지급된 아이템마다 이름 하나다. 그대로 이어 붙이던 동안 같은 재료 두 개가
 * "벌레 껍질 · 벌레 껍질"로 보였다(원장 §67.6). 같은 이름은 처음 나온 자리에서 "이름 x개수"로 묶는다.
 */
export interface LootStack {
    name: string;
    count: number;
}

export const stackLootNames = (names: ReadonlyArray<string | null | undefined>): LootStack[] => {
    const stacks: LootStack[] = [];
    const byName = new Map<string, LootStack>();
    for (const name of names) {
        if (!name) continue;
        const existing = byName.get(name);
        if (existing) {
            existing.count += 1;
        } else {
            const stack = { name, count: 1 };
            byName.set(name, stack);
            stacks.push(stack);
        }
    }
    return stacks;
};

export const formatLootStacks = (names: ReadonlyArray<string | null | undefined>): string[] => (
    stackLootNames(names).map(({ name, count }) => MSG.LOOT_STACK(name, count))
);

/**
 * 앞의 `limit` 묶음만 이름으로 보이고, 나머지는 **아이템 개수**로 센다(묶음 수가 아니다 — 카드의 "전리품 N개"와 같은 단위).
 */
export const summarizeLoot = (names: ReadonlyArray<string | null | undefined>, limit = 2): { shown: string[]; restCount: number } => {
    const stacks = stackLootNames(names);
    return {
        shown: stacks.slice(0, limit).map(({ name, count }) => MSG.LOOT_STACK(name, count)),
        restCount: stacks.slice(limit).reduce((sum, stack) => sum + stack.count, 0),
    };
};

/** 결과 카드의 전리품 칸에 쓰는 등급(데이터의 `rarity` · 등급표에서 도출 — 모르는 이름은 `common`). */
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const LOOT_RARITIES: ReadonlySet<string> = new Set<LootRarity>(['common', 'uncommon', 'rare', 'epic', 'legendary']);

export interface LootChip {
    label: string;
    rarity: LootRarity;
}

/** 접두어가 붙은 장비 이름 → 바탕 장비(접두어는 등급을 바꾸지 않는다 — `applyItemPrefix`가 바탕을 펼친다). */
const findLootItem = (name: string) => {
    const exact = findItemByName(name);
    if (exact) return exact;
    for (const type of EQUIPMENT_TYPES) {
        const baseName = resolveEquipmentBaseNameFromName(type, name);
        if (baseName && baseName !== name) return findItemByName(baseName);
    }
    return undefined;
};

/** 이름 → 등급. 접두어 장비는 바탕 장비의 등급이고, 카탈로그에 없는 이름은 `common`이다 — 등급 색은 테두리 장식이라 틀린 색보다 무채색이 낫다. */
export const getLootRarity = (name: string): LootRarity => {
    const rarity = getItemRarity(findLootItem(name));
    return LOOT_RARITIES.has(rarity) ? (rarity as LootRarity) : 'common';
};

/**
 * 결과 카드의 전리품 칸(2026-11 디자인 고도화 A3) — 묶음마다 칸 하나, 등급은 테두리 색으로만 보인다.
 * 앞의 `limit` 묶음만 칸으로 그리고 나머지는 아이템 개수로 센다(`summarizeLoot`와 같은 단위).
 */
export const getLootChips = (names: ReadonlyArray<string | null | undefined>, limit = 4): { chips: LootChip[]; restCount: number } => {
    const stacks = stackLootNames(names);
    return {
        chips: stacks.slice(0, limit).map(({ name, count }) => ({ label: MSG.LOOT_STACK(name, count), rarity: getLootRarity(name) })),
        restCount: stacks.slice(limit).reduce((sum, stack) => sum + stack.count, 0),
    };
};
