/**
 * bagRecipes — 제작소에서 만드는 가방 단계 (2026-09 Wave 33, 소유자 결정 "가방을 제작요소로").
 *
 * 가방은 **이번 런에만** 유효하다: 단계(`player.bagTier`)는 영구 상태(`pickPermanentPlayerState`)가 아니므로
 * 사망 재시작·계승에서 0으로 돌아간다(가방 내용물도 그때 비워진다). 크리스털 영구 확장(`maxInv`)과는 더해진다.
 * 단계는 순서대로만 만들고, 단계 사이의 속도는 골드(150 → 9,000)가 정한다. 재료는 **넓은 레벨대에서 계속 나오는 것**만
 * 쓴다(각 재료가 나오는 지역 5~12곳, Lv1~68) — 한 구간에서만 나오는 재료를 쓰던 동안 그 구간을 지나친 런은 다음 단계에서
 * 영영 막혔다(순서 제작이라 뒤 단계 전부가 막힌다). 재료는 쌓이지 않고 한 개가 한 칸이라 단계당 3~4칸으로 둔다.
 * 희귀 재료(오리할콘, 드롭률 0.15~0.3)는 마지막 단계에 1개만 쓴다 — 4·5단계가 각각 쓰던 동안 드라이버 64런 중 5단계 0.
 * 5단계 × 3칸 = 기본 20칸 → 35칸. Wave 31 감사에서 전리품 굴림의 54%가 가방 가득으로 막혔다(원장 §31.4 · §33).
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
        inputs: [{ name: '멧돼지 가죽', qty: 3 }, { name: '자연의 결정', qty: 1 }],
        desc: '들짐승 가죽을 겹쳐 꿰매고 자연의 결정으로 여민 첫 배낭',
    },
    {
        tier: 2,
        name: '광부의 배낭',
        slots: 3,
        gold: 600,
        inputs: [{ name: '철광석', qty: 3 }, { name: '마나 결정', qty: 1 }],
        desc: '철 테를 두르고 마나 결정으로 무게를 덜어 낸 광부용 배낭',
    },
    {
        tier: 3,
        name: '마력 주머니',
        slots: 3,
        gold: 1500,
        inputs: [{ name: '마나 결정', qty: 2 }, { name: '빛의 결정', qty: 1 }],
        desc: '결정의 빛으로 안쪽 공간을 넓힌 마법 주머니',
    },
    {
        tier: 4,
        name: '그림자 원정 가방',
        slots: 3,
        gold: 4000,
        inputs: [{ name: '어둠의 정수', qty: 2 }, { name: '빛의 결정', qty: 1 }],
        desc: '어둠의 정수로 무두질하고 빛의 결정으로 봉한 원정 가방',
    },
    {
        tier: 5,
        name: '오리할콘 수납함',
        slots: 3,
        gold: 9000,
        inputs: [{ name: '오리할콘', qty: 1 }, { name: '어둠의 정수', qty: 2 }],
        desc: '오리할콘 뼈대에 어둠의 정수로 칸막이를 새긴 원정용 수납함',
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
