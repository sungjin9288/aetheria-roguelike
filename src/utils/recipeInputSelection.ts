/**
 * recipeInputSelection.ts — 제작 재료로 가방의 어느 사본을 쓰는가 (2026-10 Wave 62, 원장 §61.4 C8).
 *
 * 소유자 결정 "강화 안 된 사본 먼저": 같은 이름의 사본이 여럿이면
 *   1. 강화 수치(+N)가 낮은 사본 → 2. 접두어가 없는 사본 → 3. 가방 앞쪽(먼저 들어온) 사본
 * 순서로 고른다. 이름이 같은 첫 사본을 쓰던 동안 제작법 r3(화염의 지팡이)가 +5 나무지팡이를 먹고 +0을 남겼다.
 *
 * 제작 훅(`useInventoryActions.economy`)이 보내는 재료 id와 리듀서(`CRAFT_RECIPE` · `CRAFT_BAG`)가 대조하는 기대 id가
 * 이 모듈 하나에서 나온다 — 둘이 갈라지면 리듀서가 요청을 동일 참조로 버린다. 제작 화면도 같은 선택으로 쓰일 사본의
 * +N을 보여 준다. 순수 함수이고 난수를 쓰지 않는다.
 */
import type { Item } from '../types/index.js';

/** 제작법 · 가방 단계가 공유하는 재료 목록 모양. */
export interface RecipeInputsLike {
    inputs?: readonly { name?: string; qty?: number }[];
}

/** 강화(+N)가 붙을 수 있는 장비 종류 — 강화 규칙(`getEnhanceAvailability`)과 같은 집합. */
const ENHANCEABLE_TYPES: readonly string[] = ['weapon', 'armor', 'shield'];

const enhanceLevelOf = (item: Item): number => {
    const level = Number(item.enhance);
    return Number.isFinite(level) && level > 0 ? level : 0;
};

export const isEnhanceableRecipeInput = (item: Item): boolean => ENHANCEABLE_TYPES.includes(String(item.type));

interface Candidate {
    item: Item;
    order: number;
}

/** 낮은 강화 → 접두어 없음 → 가방 앞쪽. */
const compareCandidates = (left: Candidate, right: Candidate): number => (
    enhanceLevelOf(left.item) - enhanceLevelOf(right.item)
    || Number(Boolean(left.item.prefixed)) - Number(Boolean(right.item.prefixed))
    || left.order - right.order
);

/** 재료 한 줄의 선택 결과 — `items`는 쓰일 사본(우선순위 순), `enough`는 필요 수량을 다 채웠는가. */
export interface RecipeInputSelection {
    name: string;
    required: number;
    items: Item[];
    enough: boolean;
}

/**
 * 재료 줄마다 쓰일 사본을 고른다. 한 사본은 한 줄에만 쓰인다(앞 줄이 먼저 가져간다).
 * 모자란 줄을 만나면 그 줄까지 고른 결과를 돌려주고 멈춘다 — 이전 선택기의 "모자라면 거기서 멈춤"과 같다.
 */
export const selectRecipeInputs = (
    inventory: readonly Item[] | null | undefined,
    recipe: RecipeInputsLike | null | undefined,
): RecipeInputSelection[] => {
    const available: Candidate[] = (inventory || [])
        .map((item, order) => ({ item, order }))
        .filter((entry) => Boolean(entry.item));
    const selections: RecipeInputSelection[] = [];
    for (const input of recipe?.inputs || []) {
        const name = input.name || '';
        const required = Math.max(0, Number(input.qty) || 0);
        const chosen = available
            .filter((entry) => entry.item.name === name)
            .sort(compareCandidates)
            .slice(0, required);
        const chosenSet = new Set(chosen);
        for (let index = available.length - 1; index >= 0; index -= 1) {
            if (chosenSet.has(available[index])) available.splice(index, 1);
        }
        const enough = chosen.length >= required;
        selections.push({ name, required, items: chosen.map((entry) => entry.item), enough });
        if (!enough) break;
    }
    return selections;
};

/** 제작 요청 · 리듀서 대조에 쓰는 재료 id 목록(선택 순서 그대로). id 없는 사본은 자리를 차지하되 id를 보태지 않는다. */
export const getRecipeInputIds = (
    inventory: readonly Item[] | null | undefined,
    recipe: RecipeInputsLike | null | undefined,
): string[] => selectRecipeInputs(inventory, recipe)
    .flatMap((selection) => selection.items)
    .flatMap((item) => (item.id ? [item.id] : []));

/**
 * 제작 화면 표시용 — 같은 이름의 사본 중 강화된 것이 있는 장비 재료 줄에 한해, 쓰일 사본의 강화 수치 목록.
 * 강화된 사본이 없으면(모두 +0) 어느 사본이 쓰여도 같으므로 표시하지 않는다.
 */
export const getRecipeInputEnhanceUsage = (
    inventory: readonly Item[] | null | undefined,
    recipe: RecipeInputsLike | null | undefined,
): Record<string, number[]> => {
    const owned = inventory || [];
    const usage: Record<string, number[]> = {};
    for (const selection of selectRecipeInputs(owned, recipe)) {
        const enhanceableCopies = owned.filter((item) => item?.name === selection.name && isEnhanceableRecipeInput(item));
        if (!enhanceableCopies.some((item) => enhanceLevelOf(item) > 0)) continue;
        const levels = selection.items.filter(isEnhanceableRecipeInput).map(enhanceLevelOf);
        if (levels.length > 0) usage[selection.name] = levels;
    }
    return usage;
};
