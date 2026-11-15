import { BALANCE, CONSTANTS } from '../data/constants';
import { DB } from '../data/db';
import { DROP_TABLES } from '../data/dropTables';
import { MSG } from '../data/messages';
import { createDomainRandom, deriveSeed, type RandomSource } from '../utils/seededRandom';
import { spawnEnemy } from '../utils/exploreUtils';
import { getPrefixLevelBonus } from '../utils/enemyLevel';
import { findItemByName, grantGold, makeItem, registerLootToCodex } from '../utils/gameUtils';
import { getInventoryCapacity } from '../utils/inventoryCapacity';
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

/** 상자 보상 — `mimic`이면 미믹을 쓰러뜨렸을 때의 보상(골드 2배 · 재료 확정 · 낮은 확률로 강화 재료) */
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
    const rareRoll = rng();
    if (mimic && rareRoll < BALANCE.FIELD_MIMIC_RARE_MAT_CHANCE) items.push(CONSTANTS.ENHANCE_MATERIAL_NAME);
    return { gold: mimic ? baseGold * BALANCE.FIELD_MIMIC_GOLD_MULT : baseGold, items };
};

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
 * 미믹 개체(설계 §6) — 그 지역 레벨의 '미믹'에 정예 배율을 건다. 초반 구간(지역 레벨 ≤ `EARLY_ELITE_LEVEL_CAP`)은 ×1.4, 그 위는
 * 완전 정예 '재앙의'와 같은 ×2.5(경험 · 골드도 같은 배율). 종은 정해진 종 경로(`storyMonster`)라 조우 추첨 · 접두어가 없고,
 * 난수는 상자 해시의 도메인 난수다 — 탐험 난수를 쓰지 않는다. 정예 목격 칭호를 남기지 않도록 `isElite`는 세우지 않는다
 * (그 지역 정예를 만난 것이 아니다). 그래도 격노는 정예와 같은 규칙이다.
 */
export const buildFieldMimic = (player: Player, mapData: GameMap, ref: FieldMimicRef): FieldMimic | null => {
    const rng = createDomainRandom(ref.seed, ref.loc, ref.chestId, 'mimic-spawn');
    const { mStats } = spawnEnemy(mapData, player, player.relics || [], { addLog: noop }, { storyMonster: MIMIC_NAME, rng });
    if (!mStats) return null;
    const early = mapLevel(mapData) <= BALANCE.EARLY_ELITE_LEVEL_CAP;
    const mult = early ? BALANCE.FIELD_MIMIC_EARLY_MULT : BALANCE.FIELD_MIMIC_MULT;
    const level = typeof mStats.level === 'number' ? mStats.level : mapLevel(mapData);
    const pattern = mStats.pattern;
    return {
        ...mStats,
        hp: Math.floor(mStats.hp * mult),
        maxHp: Math.floor(mStats.maxHp * mult),
        atk: Math.floor(mStats.atk * mult),
        exp: Math.floor(mStats.exp * mult),
        gold: Math.floor(mStats.gold * mult),
        levelBonus: getPrefixLevelBonus(level, mult),
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
    gold: number;
    admitted: string[];
    dropped: string[];
}

/**
 * 상자 · 미믹 보상을 가방에 넣는다. 전리품과 같이 가방 상한에서 멈춘다(넣지 못한 것은 두고 온다 — 상자는 이미 열렸다).
 * 아이템 id는 넘겨받은 난수 · 시각으로 만든다(리듀서 결정론).
 */
export const grantFieldChestReward = (
    player: Player,
    reward: FieldChestReward,
    rng: RandomSource,
    now: number,
): FieldChestGrant => {
    let next = grantGold(player, reward.gold);
    const gold = (next.gold || 0) - (player.gold || 0);
    const capacity = getInventoryCapacity(next);
    const made: Item[] = [];
    const admitted: string[] = [];
    const dropped: string[] = [];
    for (const name of reward.items) {
        const template = findItemByName(name);
        if (!template) continue;
        if ((next.inv || []).length + made.length >= capacity) {
            dropped.push(name);
            continue;
        }
        made.push(makeItem(template, rng, () => now));
        admitted.push(name);
    }
    if (made.length > 0) next = registerLootToCodex({ ...next, inv: [...(next.inv || []), ...made] }, made);
    return { player: next, gold, admitted, dropped };
};

/**
 * 미믹 승리 정산(설계 §6) — 이긴 미믹의 상자 보상(골드 2배 · 지역 재료 확정 · 낮은 확률로 강화 재료). 보상은 상자 해시로 미리
 * 정해져 전투 난수가 바꾸지 않는다. 승리 정산(`handleVictoryOutcome`)이 다른 승리 보상과 같은 player 위에서 부른다.
 */
export const settleFieldMimicVictory = (
    player: Player,
    enemy: { fieldMimic?: FieldMimicRef } | null | undefined,
    now: number,
): { player: Player; logs: Array<{ type: string; text: string }> } => {
    const ref = enemy?.fieldMimic;
    const mapData = ref ? DB.MAPS[ref.loc] : null;
    if (!ref || !mapData) return { player, logs: [] };
    const reward = getFieldChestReward(ref.loc, mapData, ref.seed, ref.chestId, true);
    const grant = grantFieldChestReward(player, reward, createDomainRandom(ref.seed, ref.loc, ref.chestId, 'mimic-item'), now);
    const logs = [{ type: 'success', text: MSG.FIELD_MIMIC_REWARD(grant.gold, grant.admitted) }];
    if (grant.dropped.length > 0) logs.push({ type: 'warning', text: MSG.FIELD_CHEST_BAG_FULL(grant.dropped) });
    return { player: grant.player, logs };
};
