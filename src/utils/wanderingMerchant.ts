import { BALANCE, CONSTANTS } from '../data/constants.js';
import { DB } from '../data/db.js';
import { MSG } from '../data/messages.js';
import { getNextBagRecipe } from '../data/bagRecipes.js';
import { isSignatureItem } from '../data/signatureItems.js';
import type { GameMap, Item, Player, WanderingMerchantOffer, WanderingMerchantVisit } from '../types/index.js';
import { createSeededRandom, type RandomSource } from './seededRandom.js';
import { getShopMaxTier } from './shopRotation.js';

/**
 * 떠돌이 행상인 (2026-10 Wave 75, 소유자 결정 "가방은 현행 유지, 대신 낮은 확률의 이벤트로 행상인 — 물품은 늘 바뀌고 가끔 희귀한
 * 재료 · 장비, 판매도 가능").
 *
 * 만남과 재고는 **탐험 난수(`actionRng`)를 쓰지 않는다** — 탐험 수 · 지역의 해시가 정한다. 그래서 행상인을 만나지 않는 탐험은
 * 난수 소비가 기능 이전과 같고(오프라인 게임 · 시드 고정값 · 증빙의 난수열이 밀리지 않는다), 다시 불러와도 같은 자리에서 같은
 * 행상인이 나온다(재굴림 불가). 재고는 만날 때 `player.merchantVisit`에 실려 구매 리듀서가 그 값으로 검증한다.
 */

const UINT32 = 4294967296;

/** FNV-1a 32비트 — 같은 열쇠는 언제나 같은 값이다. */
const hashKey = (key: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
};

const exploreCount = (player: Player | null | undefined): number => Math.max(0, Math.floor(Number(player?.stats?.explores) || 0));

/** 행상인을 만날 수 있는 지역 — 사냥감이 있는 비안전지대. */
export const canMeetMerchantIn = (mapData: GameMap | null | undefined): boolean => Boolean(
    mapData && mapData.type !== 'safe' && Array.isArray(mapData.monsters) && mapData.monsters.length > 0,
);

/** 이번 탐험의 만남 판정값(0 이상 1 미만) — 탐험 수 · 지역의 함수다. */
export const getMerchantRoll = (player: Player | null | undefined, loc: string): number => (
    hashKey(`merchant:${exploreCount(player)}:${loc}`) / UINT32
);

/** 이번 탐험에 행상인을 만나는가. 난수 원천을 받지 않는다 — 판정이 탐험 난수열을 건드리지 않는다는 것이 계약이다. */
export const shouldMeetMerchant = (player: Player | null | undefined, mapData: GameMap | null | undefined, loc: string): boolean => (
    canMeetMerchantIn(mapData) && getMerchantRoll(player, loc) < BALANCE.WANDERING_MERCHANT_CHANCE
);

const isEquipment = (item: Item): boolean => item.type === 'weapon' || item.type === 'armor' || item.type === 'shield';
const usableBy = (item: Item, job: string | undefined): boolean => (
    !Array.isArray(item.jobs) || item.jobs.length === 0 || (job !== undefined && item.jobs.includes(job))
);
const pick = <T>(pool: readonly T[], rng: RandomSource): T | null => (pool.length ? pool[Math.floor(rng() * pool.length)] ?? null : null);

/**
 * 이 직업이 쓸 수 있는 한 등급의 상점 장비(전설 각인 제외, 가격 있는 것) — 행상인 재고와 지역 토벌 의뢰 보상(Wave 80)이 같이 읽는다.
 */
export const getJobGearPool = (job: string | undefined, gearTier: number): Item[] => [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter((item) => (
    isEquipment(item) && (Number(item.tier) || 1) === gearTier && usableBy(item, job) && !isSignatureItem(item)
    && (Number(item.price) || 0) > 0
));

/** 이 레벨에서 착용할 수 있는 가장 높은 장비 등급(`BALANCE.TIER_REQ_LEVEL` — 착용 판정 `canEquip`과 같은 표). */
export const getUsableGearTier = (level: number | undefined): number => {
    const current = Math.max(1, Number(level) || 1);
    let usable = 1;
    for (const [tier, reqLevel] of Object.entries(BALANCE.TIER_REQ_LEVEL)) {
        if (current >= reqLevel) usable = Math.max(usable, Number(tier));
    }
    return usable;
};

const RARE_MATERIAL_NAME = CONSTANTS.ENHANCE_MATERIAL_NAME;

/** 이 등급까지의 제작 장비에 들어가는 재료와 다음 가방 단계의 재료 — 행상인의 재료는 지금 쓸 데가 있는 것만 판다. */
const getUsefulMaterials = (maxTier: number, player: Player): Item[] => {
    const equipmentTier = new Map<string, number>(
        [...DB.ITEMS.weapons, ...DB.ITEMS.armors].map((item) => [String(item.name), Number(item.tier) || 1]),
    );
    const names = new Set<string>();
    for (const recipe of DB.ITEMS.recipes || []) {
        const outputTier = equipmentTier.get(String(recipe.name));
        if (outputTier === undefined || outputTier > maxTier) continue;
        for (const input of recipe.inputs || []) if (input.name) names.add(input.name);
    }
    for (const input of getNextBagRecipe(player.bagTier)?.inputs || []) names.add(input.name);
    names.delete(RARE_MATERIAL_NAME);
    return DB.ITEMS.materials.filter((item) => names.has(String(item.name)) && (Number(item.price) || 0) > 0);
};

const offer = (item: Item, price: number, rare: boolean): WanderingMerchantOffer => ({
    name: String(item.name),
    price: Math.max(1, Math.ceil(price)),
    rare,
    sold: false,
});

/**
 * 이번 만남의 재고 — 소모품 둘 · 쓸 데 있는 재료 하나 · 장비 하나(지역 등급과 착용 가능 등급 중 낮은 쪽, 이 직업용), 그리고
 * `WANDERING_MERCHANT_RARE_CHANCE`로 희귀 한 칸(강화 재료 또는 착용 가능한 최고 등급의 강한 장비). 탐험 수 · 지역마다 다르다.
 */
export const buildMerchantStock = (player: Player, loc: string): WanderingMerchantOffer[] => {
    const rng = createSeededRandom(hashKey(`merchant-stock:${exploreCount(player)}:${loc}`));
    const tier = getShopMaxTier(loc);
    const mult = BALANCE.WANDERING_MERCHANT_PRICE_MULT;
    const rareMult = BALANCE.WANDERING_MERCHANT_RARE_PRICE_MULT;
    const stock: WanderingMerchantOffer[] = [];
    const taken = new Set<string>();
    const add = (item: Item | null, price: number, rare: boolean) => {
        if (!item || taken.has(String(item.name))) return;
        taken.add(String(item.name));
        stock.push(offer(item, price, rare));
    };

    const mapLevel = typeof DB.MAPS[loc]?.level === 'number' ? Number(DB.MAPS[loc]?.level) : (player.level || 1);
    const consumableCap = Math.max(
        BALANCE.WANDERING_MERCHANT_CONSUMABLE_PRICE_FLOOR,
        mapLevel * BALANCE.WANDERING_MERCHANT_CONSUMABLE_PRICE_PER_LEVEL,
    );
    const consumables = DB.ITEMS.consumables.filter((item) => (Number(item.price) || 0) > 0 && (Number(item.price) || 0) <= consumableCap);
    for (let index = 0; index < 2; index += 1) {
        const item = pick(consumables.filter((entry) => !taken.has(String(entry.name))), rng);
        add(item, (Number(item?.price) || 0) * mult, false);
    }
    const material = pick(getUsefulMaterials(tier, player), rng);
    add(material, (Number(material?.price) || 0) * mult, false);

    const gearPool = (gearTier: number) => getJobGearPool(player.job, gearTier);
    // 장비는 지금 착용할 수 있는 등급만 판다 — 지역 상점 등급은 착용 레벨보다 앞서 간다(Lv35 지역의 4등급은 Lv45 필요).
    const usableTier = getUsableGearTier(player.level);
    const gear = pick(gearPool(Math.min(tier, usableTier)), rng);
    add(gear, (Number(gear?.price) || 0) * mult, false);

    if (rng() < BALANCE.WANDERING_MERCHANT_RARE_CHANCE) {
        // 희귀 장비: 착용할 수 있는 가장 높은 등급에서 위력 상위 1/4(이 직업용) — 이 지역이 팔지 않는 등급일 수도 있다.
        const rarePool = gearPool(usableTier).filter((item) => !taken.has(String(item.name)))
            .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0) || String(a.name).localeCompare(String(b.name)));
        const rareGear = pick(rarePool.slice(0, Math.max(1, Math.ceil(rarePool.length / 4))), rng);
        const wantsGear = rng() < 0.5;
        if (wantsGear && rareGear) {
            add(rareGear, (Number(rareGear.price) || 0) * rareMult, true);
        } else {
            const enhance = DB.ITEMS.materials.find((item) => item.name === RARE_MATERIAL_NAME) || null;
            add(enhance, Math.max((Number(enhance?.price) || 0) * rareMult, mapLevel * BALANCE.WANDERING_MERCHANT_RARE_MATERIAL_PRICE_PER_LEVEL), true);
        }
    }
    return stock;
};

/** 행상인 만남 이벤트 — 선택지는 사고팔기 / 지나친다. 재고는 `player.merchantVisit`가 든다. */
export const buildMerchantEvent = (stock: readonly WanderingMerchantOffer[]) => ({
    isWanderingMerchant: true,
    merchantStock: { count: stock.length, rare: stock.filter((entry) => entry.rare).length },
    title: MSG.MERCHANT_TITLE,
    desc: MSG.MERCHANT_DESC(stock.length, stock.some((entry) => entry.rare)),
    choices: [MSG.MERCHANT_CHOICE_BROWSE, MSG.MERCHANT_CHOICE_PASS],
    outcomes: [],
});

export const startMerchantVisit = (player: Player, loc: string, stock: WanderingMerchantOffer[]): Player => ({
    ...player,
    merchantVisit: { loc, stock },
});

/** 지금 유효한 만남 — 만난 그 지역에 있을 때만이다(떠나면 행상인도 없다). */
export const getActiveMerchantVisit = (player: Player | null | undefined): WanderingMerchantVisit | null => {
    const visit = player?.merchantVisit;
    if (!visit || !Array.isArray(visit.stock) || !player?.loc || visit.loc !== player.loc) return null;
    return visit;
};

/** 같은 이름의 카탈로그 아이템(소모품 · 재료 · 장비). */
const findCatalogItem = (name: string): Item | null => (
    [...DB.ITEMS.consumables, ...DB.ITEMS.materials, ...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => item.name === name) || null
);

/** 구매 검증 — 지금 만남의 팔리지 않은 칸이어야 한다. 산 물건은 카탈로그 아이템 그대로다(판매가는 기본가 기준). */
export const getMerchantOffer = (player: Player | null | undefined, itemName: string) => {
    const entry = getActiveMerchantVisit(player)?.stock.find((slot) => slot.name === itemName && !slot.sold);
    const item = entry ? findCatalogItem(entry.name) : null;
    return entry && item ? { item: { ...item, price: item.price ?? 0 }, price: entry.price, rare: entry.rare } : null;
};

export const markMerchantOfferSold = (player: Player, itemName: string): Player => {
    const visit = player.merchantVisit;
    if (!visit) return player;
    let marked = false;
    const stock = visit.stock.map((slot) => {
        if (marked || slot.sold || slot.name !== itemName) return slot;
        marked = true;
        return { ...slot, sold: true };
    });
    return { ...player, merchantVisit: { ...visit, stock } };
};

/** 행상인이 떠난다 — 만남 기록을 지운다. */
export const endMerchantVisit = (player: Player): Player => {
    if (!player.merchantVisit) return player;
    const { merchantVisit: _ended, ...rest } = player;
    return rest;
};

/** 행상인 상점에 보일 칸 — 카탈로그 아이템과 이번 만남의 값. */
export const getMerchantShelf = (player: Player | null | undefined) => (getActiveMerchantVisit(player)?.stock || []).flatMap((slot) => {
    const item = findCatalogItem(slot.name);
    return item ? [{ item, price: slot.price, rare: slot.rare, sold: slot.sold }] : [];
});
