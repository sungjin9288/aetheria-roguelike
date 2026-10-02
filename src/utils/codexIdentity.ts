import type { Item } from '../types/item.js';
import type { CodexCategory } from '../types/player.js';
import { resolveEquipmentBaseIdentity, resolveEquipmentBaseNameFromName } from './equipmentBaseIdentity.js';

/**
 * 도감의 장비 항목은 바탕 장비 하나다 — 접두어 사본(날카로운 강철 롱소드 · 무거운 강철 롱소드 …)은 같은 항목이다.
 * 2026-10 Wave 61: 접두어 이름을 따로 등록하던 동안 같은 장비의 사본 여섯으로 "무기 수집가 I"이 열렸고, 정작 바탕
 * 장비는 미발견으로 남았으며 무기 수가 전체(n/117)를 넘었다(원장 §61 A8).
 */
const EQUIPMENT_CATEGORY_TYPE = { weapons: 'weapon', armors: 'armor', shields: 'shield' } as const;
type EquipmentCodexCategory = keyof typeof EQUIPMENT_CATEGORY_TYPE;

const isEquipmentCodexCategory = (category: CodexCategory | string): category is EquipmentCodexCategory => (
    Object.prototype.hasOwnProperty.call(EQUIPMENT_CATEGORY_TYPE, category)
);

/** 이 아이템이 도감에 등록되는 이름 — 장비는 바탕 이름, 그 밖은 이름 그대로. */
export const getCodexEntryName = (category: CodexCategory, item: Item): string | undefined => {
    if (!isEquipmentCodexCategory(category) || typeof item?.name !== 'string') return item?.name;
    return resolveEquipmentBaseIdentity(item)?.name
        ?? resolveEquipmentBaseNameFromName(EQUIPMENT_CATEGORY_TYPE[category], item.name)
        ?? item.name;
};

/** 예전 기록의 접두어 장비 키를 바탕 이름으로 합친다(같은 키는 한 번). 장비가 아닌 분류와 모르는 이름은 그대로다. */
export const normalizeCodexEquipmentKeys = <T extends Record<string, unknown>>(codex: T): T => {
    let changed = false;
    const next: Record<string, unknown> = { ...codex };
    for (const category of Object.keys(EQUIPMENT_CATEGORY_TYPE) as EquipmentCodexCategory[]) {
        const entries = codex[category];
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
        const merged: Record<string, unknown> = {};
        for (const [name, entry] of Object.entries(entries)) {
            const base = resolveEquipmentBaseNameFromName(EQUIPMENT_CATEGORY_TYPE[category], name) ?? name;
            if (base !== name) changed = true;
            if (!(base in merged)) merged[base] = entry;
        }
        next[category] = merged;
    }
    return (changed ? next : codex) as T;
};
