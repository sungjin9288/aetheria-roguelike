/**
 * bagRecipes — 제작소에서 만드는 가방 단계 (2026-09 Wave 33, 소유자 결정 "가방을 제작요소로").
 *
 * 가방은 **이번 런에만** 유효하다: 단계(`player.bagTier`)는 영구 상태(`pickPermanentPlayerState`)가 아니므로
 * 사망 재시작·계승에서 0으로 돌아간다(가방 내용물도 그때 비워진다). 크리스털 영구 확장(`maxInv`)과는 더해진다.
 * 단계는 순서대로만 만든다 — 다음 단계 재료는 그 단계가 열리는 구간(Lv1 · 8 · 12 · 22 · 28)의 지역에서 나온다.
 * 5단계 × 3칸 = 기본 20칸 → 35칸. Wave 31 감사에서 전리품 굴림의 54%가 가방 가득으로 막혔다(원장 §31.4).
 *
 * 상한을 읽는 곳은 전부 `utils/inventoryCapacity.getInventoryCapacity`를 거친다 — `maxInv`를 직접 읽지 말 것.
 */

/** 가방 한 단계의 제작법. `inputs`는 제작소 레시피(`ItemRecipeDef.inputs`)와 같은 모양이다. */
export interface BagRecipeDef {
    tier: number;
    name: string;
    slots: number;
    gold: number;
    inputs: readonly { name: string; qty: number }[];
    desc: string;
}

export const BAG_RECIPES: readonly BagRecipeDef[] = Object.freeze([
    {
        tier: 1,
        name: '가죽 배낭',
        slots: 3,
        gold: 150,
        inputs: [{ name: '멧돼지 가죽', qty: 4 }, { name: '벌레 껍질', qty: 2 }],
        desc: '고요한 숲의 가죽을 겹쳐 꿰맨 첫 배낭',
    },
    {
        tier: 2,
        name: '광부의 배낭',
        slots: 3,
        gold: 600,
        inputs: [{ name: '철광석', qty: 5 }, { name: '박쥐 날개', qty: 3 }],
        desc: '철 테를 두르고 박쥐 날개막으로 방수한 광부용 배낭',
    },
    {
        tier: 3,
        name: '수정 주머니',
        slots: 3,
        gold: 1500,
        inputs: [{ name: '수정 파편', qty: 4 }, { name: '트롤의 피', qty: 2 }],
        desc: '수정 조각으로 공간을 넓힌 마법 주머니',
    },
    {
        tier: 4,
        name: '설원 가죽 가방',
        slots: 3,
        gold: 4000,
        inputs: [{ name: '서리 늑대 가죽', qty: 3 }, { name: '거인의 뼈', qty: 2 }],
        desc: '거인의 뼈대로 모양을 잡은 두툼한 설원 가방',
    },
    {
        tier: 5,
        name: '기계식 수납함',
        slots: 3,
        gold: 9000,
        inputs: [{ name: '기계 코어', qty: 2 }, { name: '오리할콘', qty: 1 }],
        desc: '기계 코어로 칸막이를 여닫는 원정용 수납함',
    },
]);

/** 이번 런의 가방 단계(0 = 기본 가방). 비정상 값은 0, 최대 단계를 넘으면 최대 단계로 읽는다. */
export const getBagTier = (bagTier: unknown): number => {
    const tier = Number(bagTier);
    if (!Number.isSafeInteger(tier) || tier <= 0) return 0;
    return Math.min(tier, BAG_RECIPES.length);
};

/** 이번 런의 가방 단계가 더해 주는 칸 수. */
export const getBagSlotBonus = (bagTier: unknown): number => BAG_RECIPES
    .slice(0, getBagTier(bagTier))
    .reduce((total, recipe) => total + recipe.slots, 0);

/** 다음에 만들 수 있는 가방 단계(모두 만들었으면 null). */
export const getNextBagRecipe = (bagTier: unknown): BagRecipeDef | null => BAG_RECIPES[getBagTier(bagTier)] || null;
