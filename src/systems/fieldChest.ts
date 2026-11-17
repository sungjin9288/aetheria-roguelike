import { BALANCE, CONSTANTS } from '../data/constants';
import { DB } from '../data/db';
import { DROP_TABLES } from '../data/dropTables';
import { MSG } from '../data/messages';
import { createDomainRandom, deriveSeed, type RandomSource } from '../utils/seededRandom';
import { spawnEnemy } from '../utils/exploreUtils';
import { getPrefixLevelBonus } from '../utils/enemyLevel';
import { findItemByName, grantGold, makeItem, registerLootToCodex } from '../utils/gameUtils';
import { getInventoryCapacity } from '../utils/inventoryCapacity';
import { getSellPrice } from '../utils/equipmentUtils';
import { getJobGearPool, getUsableGearTier } from '../utils/wanderingMerchant';
import { formatLootStacks } from '../utils/lootSummary';
import { isConsumableItem } from './consumableRules';
import type { GameMap } from '../types/map';
import type { Item } from '../types/item';
import type { Monster } from '../types/monster';
import type { Player } from '../types/player';

/**
 * 2026-11 지역 지도의 보물상자 · 미믹(설계 §5 · §6). 내용 · 미믹 여부는 지도 시드 · 상자 번호의 해시로 정한다 — 게임 난수를
 * 쓰지 않으므로 다시 불러와도 같고, 열기 전에 다시 불러와 피할 수 없다. 전투 난수는 미믹 보상을 바꾸지 않는다.
 */

export interface FieldChestReward {
    gold: number;
    /** 아이템 카탈로그 이름 — 지급 지점이 `makeItem`으로 만든다 */
    items: string[];
    /**
     * 미믹 처치의 확정 보상(강화 재료 · 장비) — 가방 상한을 넘어서도 들어간다(보상 소실 금지, 보장 보상과 같은 규칙).
     * 보통 상자에는 없다.
     */
    guaranteed?: string[];
}

const mapLevel = (mapData: GameMap): number => {
    const raw = Array.isArray(mapData.level) ? mapData.level[0] : mapData.level;
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const pick = <T>(pool: readonly T[], rng: RandomSource): T | null => (
    pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : null
);

const MATERIAL_NAMES: ReadonlySet<string> = new Set(DB.ITEMS.materials.map((item) => String(item.name)));

/** 그 지역 조우 몬스터의 드롭 표에 있는 재료(강화 재료 제외) — 이름순이라 데이터 순서와 무관하게 같다 */
export const getFieldRegionMaterials = (mapData: GameMap): string[] => {
    const names = new Set<string>();
    for (const monster of mapData.monsters ?? []) {
        for (const entry of DROP_TABLES[monster] ?? []) {
            if (MATERIAL_NAMES.has(entry.item) && entry.item !== CONSTANTS.ENHANCE_MATERIAL_NAME) names.add(entry.item);
        }
    }
    return [...names].sort();
};

const getRegionConsumables = (mapData: GameMap): string[] => {
    const cap = Math.max(
        BALANCE.WANDERING_MERCHANT_CONSUMABLE_PRICE_FLOOR,
        mapLevel(mapData) * BALANCE.WANDERING_MERCHANT_CONSUMABLE_PRICE_PER_LEVEL,
    );
    return DB.ITEMS.consumables
        .filter((item) => (Number(item.price) || 0) > 0 && (Number(item.price) || 0) <= cap)
        .map((item) => String(item.name))
        .sort();
};

/** 그 지역 일반 적 한 마리의 기본 골드(`spawnEnemy`의 깊이 0 식) */
export const getFieldRegionEnemyGold = (mapData: GameMap): number => BALANCE.MONSTER_GOLD_BASE + mapLevel(mapData) * 2;

export const isFieldChestMimic = (loc: string, mapSeed: number, chestId: number): boolean => (
    deriveSeed(mapSeed, loc, chestId, 'mimic') / 4294967296 < BALANCE.FIELD_MIMIC_CHANCE
);

/**
 * 상자 보상 — `mimic`이면 미믹을 쓰러뜨렸을 때의 보상(골드 `FIELD_MIMIC_GOLD_MULT`배 · 지역 재료 확정 · 강화 재료
 * `FIELD_MIMIC_ENHANCE_MATERIALS`개 확정). 장비는 처치한 플레이어의 직업 · 레벨로 정하므로 `settleFieldMimicVictory`가 더한다.
 * 보통 상자의 추첨 순서는 그대로다(미믹 여부와 무관하게 같은 수를 뽑는다).
 */
export const getFieldChestReward = (
    loc: string,
    mapData: GameMap,
    mapSeed: number,
    chestId: number,
    mimic = false,
): FieldChestReward => {
    const rng = createDomainRandom(mapSeed, loc, chestId, 'chest');
    const baseGold = Math.floor(getFieldRegionEnemyGold(mapData) * BALANCE.FIELD_CHEST_GOLD_MULT);
    const items: string[] = [];
    const consumable = pick(getRegionConsumables(mapData), rng);
    if (consumable) items.push(consumable);
    const materialRoll = rng();
    const material = pick(getFieldRegionMaterials(mapData), rng);
    if (material && (mimic || materialRoll < BALANCE.FIELD_CHEST_MATERIAL_CHANCE)) items.push(material);
    rng(); // 예전 미믹 강화 재료 확률 추첨 — 보통 상자의 내용이 바뀌지 않도록 한 번 그대로 쓴다
    if (!mimic) return { gold: baseGold, items };
    return {
        gold: baseGold * BALANCE.FIELD_MIMIC_GOLD_MULT,
        items,
        guaranteed: Array.from({ length: BALANCE.FIELD_MIMIC_ENHANCE_MATERIALS }, () => CONSTANTS.ENHANCE_MATERIAL_NAME),
    };
};

/**
 * 미믹 생명 배율 — 6 + 1.2 × 지역 레벨, 최대 ×36(지역 레벨 25부터). 자연 플레이에서 미믹전 행동 중앙값은 3번
 * (Lv1 ~ 20은 7번 · Lv41 이상 2번, 원장 §181). 플레이어 화력이 지역 레벨보다 빨리 자라므로 고정 배율은 어느 구간에서든 한 방이었다(Wave 85 우두머리와 같은 이유).
 */
export const getFieldMimicHpMult = (regionLevel: number): number => Math.min(
    BALANCE.FIELD_MIMIC_HP_MULT_MAX,
    BALANCE.FIELD_MIMIC_HP_MULT_BASE + BALANCE.FIELD_MIMIC_HP_MULT_PER_LEVEL * Math.max(1, regionLevel),
);

/** 미믹 전투의 출처 — 이기면 `applyFieldMimicVictory`가 이 상자의 미믹 보상을 다시 계산해 준다(전투 난수와 무관). */
export interface FieldMimicRef {
    loc: string;
    seed: number;
    chestId: number;
}

export type FieldMimic = Monster & { fieldMimic: FieldMimicRef };

const MIMIC_NAME = BALANCE.FIELD_MIMIC_SPECIES;
const noop = () => undefined;

/**
 * 미믹 개체(설계 §6) — 그 지역 레벨의 '미믹'을 고위험으로 만든다. 공격력은 정예와 같은 배율(초반 구간 ≤ `EARLY_ELITE_LEVEL_CAP`은
 * ×1.4, 그 위는 '재앙의'와 같은 ×2.5 — 경험 · 골드도 이 배율)이고 생명은 `getFieldMimicHpMult`(지역 레벨 비례)다. 한 방이 아니라
 * 쓰러뜨리는 동안 맞는 횟수가 위험이다. 표시 레벨 보너스는 공격력 배율로 단다(정예와 같은 표시). 종은 정해진 종 경로(`storyMonster`)라 조우 추첨 · 접두어가 없고,
 * 난수는 상자 해시의 도메인 난수다 — 탐험 난수를 쓰지 않는다. 정예 목격 칭호를 남기지 않도록 `isElite`는 세우지 않는다
 * (그 지역 정예를 만난 것이 아니다). 그래도 격노는 정예와 같은 규칙이다.
 */
export const buildFieldMimic = (player: Player, mapData: GameMap, ref: FieldMimicRef): FieldMimic | null => {
    const rng = createDomainRandom(ref.seed, ref.loc, ref.chestId, 'mimic-spawn');
    const { mStats } = spawnEnemy(mapData, player, player.relics || [], { addLog: noop }, { storyMonster: MIMIC_NAME, rng });
    if (!mStats) return null;
    const early = mapLevel(mapData) <= BALANCE.EARLY_ELITE_LEVEL_CAP;
    const hpMult = getFieldMimicHpMult(mapLevel(mapData));
    const atkMult = early ? BALANCE.FIELD_MIMIC_EARLY_ATK_MULT : BALANCE.FIELD_MIMIC_ATK_MULT;
    const level = typeof mStats.level === 'number' ? mStats.level : mapLevel(mapData);
    const pattern = mStats.pattern;
    return {
        ...mStats,
        hp: Math.floor(mStats.hp * hpMult),
        maxHp: Math.floor(mStats.maxHp * hpMult),
        atk: Math.floor(mStats.atk * atkMult),
        exp: Math.floor(mStats.exp * atkMult),
        gold: Math.floor(mStats.gold * atkMult),
        levelBonus: getPrefixLevelBonus(level, atkMult),
        phase2: mStats.phase2 ?? {
            name: MSG.FIELD_MIMIC_ENRAGED_NAME(MIMIC_NAME),
            atkBonus: early ? BALANCE.EARLY_ELITE_PHASE_ATK_BONUS : BALANCE.ELITE_PHASE_ATK_BONUS,
            pattern: {
                guardChance: Math.max(0, (pattern?.guardChance || 0.12) - 0.05),
                heavyChance: Math.min(0.6, (pattern?.heavyChance || 0.15) + (early ? BALANCE.EARLY_ELITE_PHASE_HEAVY_BONUS : BALANCE.ELITE_PHASE_HEAVY_BONUS)),
            },
            log: MSG.ELITE_ENRAGE_LOG(MIMIC_NAME),
        },
        fieldMimic: { ...ref },
    };
};

export interface FieldChestGrant {
    player: Player;
    /** 받은 골드 전부(상자 골드 + 골드로 바꾼 소모품) — 수입 규칙을 건 실제 지급액 */
    gold: number;
    admitted: string[];
    /** 같은 종류가 이미 가방에 있어 판매가 골드로 바꾼 소모품 */
    converted: string[];
    dropped: string[];
}

/**
 * 상자 · 미믹 보상을 가방에 넣는다. 전리품과 같이 가방 상한에서 멈춘다(넣지 못한 것은 두고 온다 — 상자는 이미 열렸다).
 * 소모품은 같은 이름이 이미 가방에 있으면 넣지 않고 판매가(`getSellPrice`) 골드로 바꾼다(2026-11 소유자 결정, 원장 §175) —
 * 사냥 지역 전부가 지도가 되면 상자 소모품이 판당 1,800개 가까이 들어와 가방 비우기 왕복이 2.4배였다. 상점에 파는 것과 같은 값이라
 * 골드 가치는 그대로이고, 아직 없는 소모품은 그대로 들어온다. 재료는 제작에 쓰므로 바꾸지 않는다.
 * 아이템 id는 넘겨받은 난수 · 시각으로 만든다(리듀서 결정론).
 */
export const grantFieldChestReward = (
    player: Player,
    reward: FieldChestReward,
    rng: RandomSource,
    now: number,
): FieldChestGrant => {
    const capacity = getInventoryCapacity(player);
    const owned = new Set((player.inv || []).map((item) => item?.name));
    const made: Item[] = [];
    const admitted: string[] = [];
    const converted: string[] = [];
    const dropped: string[] = [];
    let convertedGold = 0;
    for (const name of reward.items) {
        const template = findItemByName(name);
        if (!template) continue;
        if (isConsumableItem(template) && owned.has(name)) {
            convertedGold += getSellPrice(template);
            converted.push(name);
            continue;
        }
        if ((player.inv || []).length + made.length >= capacity) {
            dropped.push(name);
            continue;
        }
        made.push(makeItem(template, rng, () => now));
        admitted.push(name);
        owned.add(name);
    }
    // 확정 보상(미믹의 강화 재료 · 장비)은 가방 상한을 보지 않는다 — 고위험을 넘긴 보상을 두고 오게 하지 않는다.
    for (const name of reward.guaranteed ?? []) {
        const template = findItemByName(name);
        if (!template) continue;
        made.push(makeItem(template, rng, () => now));
        admitted.push(name);
    }
    let next = grantGold(player, reward.gold + convertedGold);
    const gold = (next.gold || 0) - (player.gold || 0);
    if (made.length > 0) next = registerLootToCodex({ ...next, inv: [...(next.inv || []), ...made] }, made);
    return { player: next, gold, admitted, converted, dropped };
};

/**
 * 미믹 처치 장비 — 지금 착용할 수 있는 가장 높은 등급(지역 레벨 + `HUNT_CONTRACT_PREVIEW_LEVELS`까지)의 이 직업 장비 중 위력 상위
 * 1/4에서 하나(토벌 의뢰 우두머리 보상과 같은 기준). 고르기는 상자 해시 · 직업의 도메인 난수라 전투 난수가 바꾸지 않는다.
 */
export const pickFieldMimicGear = (player: Player, mapData: GameMap, ref: FieldMimicRef): string | null => {
    const tier = getUsableGearTier(Math.min(Number(player.level) || 1, mapLevel(mapData) + BALANCE.HUNT_CONTRACT_PREVIEW_LEVELS));
    const pool = getJobGearPool(player.job, tier)
        .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0) || String(a.name).localeCompare(String(b.name)));
    const top = pool.slice(0, Math.max(1, Math.ceil(pool.length / 4)));
    if (top.length === 0) return null;
    const rng = createDomainRandom(ref.seed, ref.loc, ref.chestId, 'mimic-gear', String(player.job || ''));
    return String(top[Math.floor(rng() * top.length)]?.name ?? '') || null;
};

/**
 * 미믹 승리 정산(설계 §6) — 이긴 미믹의 상자 보상(골드 5배 · 지역 재료 확정 · 강화 재료 2개 · 이 직업 장비 하나, 확정 보상은 가방
 * 상한을 넘어 들어간다). 보상은 상자 해시로 미리 정해져 전투 난수가 바꾸지 않는다. 승리 정산(`handleVictoryOutcome`)이 다른 승리
 * 보상과 같은 player 위에서 부른다.
 */
export const settleFieldMimicVictory = (
    player: Player,
    enemy: { fieldMimic?: FieldMimicRef } | null | undefined,
    now: number,
): { player: Player; logs: Array<{ type: string; text: string }> } => {
    const ref = enemy?.fieldMimic;
    const mapData = ref ? DB.MAPS[ref.loc] : null;
    if (!ref || !mapData) return { player, logs: [] };
    const chestReward = getFieldChestReward(ref.loc, mapData, ref.seed, ref.chestId, true);
    const gear = pickFieldMimicGear(player, mapData, ref);
    const reward = { ...chestReward, guaranteed: [...(chestReward.guaranteed ?? []), ...(gear ? [gear] : [])] };
    const grant = grantFieldChestReward(player, reward, createDomainRandom(ref.seed, ref.loc, ref.chestId, 'mimic-item'), now);
    const logs = [{ type: 'success', text: MSG.FIELD_MIMIC_REWARD(grant.gold, formatLootStacks(grant.admitted), grant.converted) }];
    if (grant.dropped.length > 0) logs.push({ type: 'warning', text: MSG.FIELD_CHEST_BAG_FULL(grant.dropped) });
    return { player: grant.player, logs };
};
