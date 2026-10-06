import { MSG } from '../data/messages';

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
