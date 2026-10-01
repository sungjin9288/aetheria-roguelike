import type { Item, Monster, Player } from '../types/index.js';
import { DB } from '../data/db.js';
import { LOOT_TABLE } from '../data/loot.js';
import { DROP_TABLES, type DropTableEntry } from '../data/dropTables.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { applyItemPrefix } from '../utils/itemPrefixUtils';
import { withCanonicalEquipmentBaseIdentity } from '../utils/equipmentBaseIdentity.js';
import { MSG } from '../data/messages.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { LIBRARY_BONUS_LOOT } from '../data/libraryLoot.js';
import { getPrestigeUnlocks } from './prestigeUnlocks';
import { getProgressionLootMultiplier } from '../data/progressionProfiles.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';

export type LootLog = { type: string; text: string };
/**
 * `guaranteed`: 보장 보상(계승 3단계 "보스 희귀 장비 보장") — 가방 상한을 보지 않고 들어간다(보상 소실 금지, Wave 58).
 */
export type LootCandidate = { item: Item; logs: LootLog[]; guaranteed?: boolean };
export type LootResult = {
    candidates: LootCandidate[];
    items: Item[];
    logs: LootLog[];
};

const normalBonusPool = (enemy: Monster, player: Player | null): Item[] | null => {
    const map = player?.loc ? DB.MAPS[player.loc] : undefined;
    const name = enemy.baseName || enemy.name;
    const enemyLevel = enemy.level;
    if (enemy.isBoss || enemy.isElite || !map || map.level === 'infinite'
        || !name || !map.monsters?.includes(name)
        || !Number.isSafeInteger(enemyLevel) || (enemyLevel as number) <= 0) return null;

    const tier = Object.entries(BALANCE.TIER_REQ_LEVEL)
        .map(([key, value]) => [Number(key), Number(value)])
        .filter(([, requiredLevel]) => requiredLevel <= (enemyLevel as number))
        .sort((left, right) => right[1] - left[1])[0]?.[0];
    const pool = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter(item => (
        item.tier === tier && item.name && !SIGNATURE_ITEM_REGISTRY[item.name]
    ));
    if (pool.length === 0) throw new Error('INVALID_NORMAL_BONUS_POOL');
    if (player?.loc === LIBRARY_BONUS_LOOT.location && tier === LIBRARY_BONUS_LOOT.tier
        && LIBRARY_BONUS_LOOT.monsterNames.includes(name)) {
        return LIBRARY_BONUS_LOOT.itemNames.map(itemName => {
            const item = pool.find(candidate => candidate.name === itemName);
            if (!item) throw new Error('INVALID_LIBRARY_BONUS_POOL');
            return item;
        });
    }
    return pool;
};

/**
 * 보스가 선언한 계열 장비 풀(2026-10 Wave 59, 브리핑 "화염 계열 장비" 등) — 원소 · 이름 · 직업 중 하나라도 맞고 `minTier` 이상인,
 * 전설 각인이 아닌 무기 · 방어구다. 계열이 없는 보스는 null(기존 등급 무작위 풀). 이전에는 계열을 약속한 보스 8종도 6등급 20종에서
 * 균등하게 뽑았다(바람 계열 0종). 빈 풀은 데이터 오류라 던진다(`tests/boss-mechanics-contract.test.js`가 지킨다).
 */
export const getBossThemedLootPool = (enemy: Monster): Item[] | null => {
    const theme = enemy.mechanics?.lootTheme;
    if (!theme) return null;
    const pool = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter((item) => {
        if (!item.name || SIGNATURE_ITEM_REGISTRY[item.name]) return false;
        if ((item.tier || 1) < (theme.minTier ?? 1)) return false;
        const elemMatch = Boolean(item.elem && theme.elems?.some((elem) => elem === item.elem));
        const nameMatch = Boolean(theme.nameIncludes?.some((keyword) => item.name!.includes(keyword)));
        const jobMatch = Boolean(theme.jobs?.some((job) => item.jobs?.includes(job)));
        return elemMatch || nameMatch || jobMatch;
    });
    if (pool.length === 0) throw new Error('INVALID_BOSS_LOOT_THEME');
    return pool;
};

const calculateCappedLootChance = (...factors: unknown[]) => {
    let chance = 1;

    for (const factor of factors) {
        if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) {
            throw new Error('INVALID_LOOT_DROP_CHANCE');
        }
        chance *= factor;
        if (!Number.isFinite(chance)) throw new Error('INVALID_LOOT_DROP_CHANCE');
    }

    return Math.min(1, chance);
};

/**
 * 후반 강화 재료 드롭의 기본 확률(2026-09 Wave 39). 적 레벨(`enemy.level` — 스폰이 지역 레벨로, 심연은 층으로 채운다)이
 * `ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL` 아래면 `null`이다 — 그 적은 난수를 더 쓰지 않으므로 초반 전리품과 그 뒤 난수 흐름이 그대로다.
 */
const getLateEnhanceMaterialChance = (enemy: Monster): number | null => {
    const level = enemy.level;
    if (typeof level !== 'number' || !Number.isFinite(level) || level < BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL) return null;
    return enemy.isBoss ? BALANCE.ENHANCE_MATERIAL_LATE_BOSS_DROP_CHANCE : BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE;
};

/**
 * 후반 강화 재료를 드롭 표와 무관하게 한 번 판정한다. 드롭 표에 줄을 넣지 않는 이유는 표가 있는 적이 고레벨 보너스 장비
 * 판정을 건너뛰기 때문이다. 두 경로(드롭 표 · 레거시)의 맨 끝에서 부른다 — 그 앞의 판정 순서는 그대로다.
 */
const appendLateEnhanceMaterial = (
    enemy: Monster,
    random: () => number,
    currentTime: () => number,
    appendCandidate: (item: Item, logs: LootLog[]) => void,
    dropMults: number[],
) => {
    const baseChance = getLateEnhanceMaterialChance(enemy);
    if (baseChance === null) return;
    if (random() >= calculateCappedLootChance(baseChance, ...dropMults)) return;
    const material = DB.ITEMS.materials.find((item) => item.name === CONSTANTS.ENHANCE_MATERIAL_NAME);
    if (!material) throw new Error('INVALID_ENHANCE_MATERIAL');
    const item: Item = { ...material, id: `${currentTime()}_${random().toString(16).slice(2, 8)}` };
    appendCandidate(item, [{ type: 'success', text: MSG.LOOT_GET(item.name ?? '') }]);
};

/**
 * 적의 기본 이름을 해석합니다 (접두사 제거).
 * CombatEngine.resolveEnemyBaseName과 동일 로직.
 * @param {Object} enemy
 * @returns {string}
 */
export const resolveEnemyBaseName = (enemy: Monster) => {
    if (!enemy) return '';
    if (enemy.baseName) return enemy.baseName;
    if (LOOT_TABLE[enemy.name as string]) return enemy.name as string;
    const parts = String(enemy.name || '').split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : (enemy.name || '');
};

/**
 * 적 처치 후 아이템 루팅을 처리합니다.
 * CombatEngine.processLoot와 동일한 로직의 독립 순수 함수 버전.
 * @param {Object} enemy
 * @param {Object|null} player
 * @param {number} [signaturePityMult=1.0] - signature 드롭에만 적용되는 pity 배율
 * @returns {LootResult}
 */
export const processLoot = (
    enemy: Monster,
    player: Player | null,
    signaturePityMult: number,
    rng?: () => number,
    now?: () => number,
): LootResult => {
    const random = typeof rng === 'function' ? rng : Math.random;
    const currentTime = typeof now === 'function' ? now : Date.now;
    const candidates: LootCandidate[] = [];
    const appendCandidate = (item: Item, candidateLogs: LootLog[], guaranteed = false) => {
        candidates.push(guaranteed ? { item, logs: candidateLogs, guaranteed } : { item, logs: candidateLogs });
    };
    const lootKey = resolveEnemyBaseName(enemy) || enemy.name;
    const relics = player?.relics || [];
    const dropRateMult = 1 + getStrongestNumericRelicValue(relics, 'drop_rate');
    const bossDropMult = enemy?.isBoss ? 1 + (relics.find((relic) => relic.effect === 'boss_hunter')?.val?.drop || 0) : 1;
    const pityMult = Number.isFinite(signaturePityMult) && signaturePityMult > 0 ? signaturePityMult : 1.0;
    const progressionLootMult = getProgressionLootMultiplier(player);
    const enemyDropMult = enemy.dropMod || 1.0;
    const enrichedList: readonly DropTableEntry[] | undefined = DROP_TABLES[lootKey as string] || DROP_TABLES[enemy.name as string];
    const lootList = (LOOT_TABLE[lootKey as string] || LOOT_TABLE[enemy.name as string]) as string[] | undefined;
    const inferredLevel = Math.max(1, Math.floor(((enemy.exp || BALANCE.LOOT_BASE_EXP) - BALANCE.LOOT_BASE_EXP) / BALANCE.LOOT_EXP_LEVEL_DIVISOR));

    if (!Number.isFinite(dropRateMult)) throw new Error('INVALID_LOOT_DROP_CHANCE');
    if (enrichedList) {
        enrichedList.forEach((entry) => {
            const entryPityMult = SIGNATURE_ITEM_REGISTRY[entry.item] ? pityMult : 1;
            calculateCappedLootChance(entry.rate, enemyDropMult, dropRateMult, bossDropMult, progressionLootMult, entryPityMult);
        });
    }
    if (lootList && lootList.length > 0) {
        calculateCappedLootChance(BALANCE.DROP_CHANCE, enemyDropMult, dropRateMult, bossDropMult, progressionLootMult);
    }
    if (inferredLevel >= BALANCE.LOOT_BONUS_MIN_LEVEL) {
        const bonusChance = enemy.isBoss ? BALANCE.LOOT_BOSS_BONUS_CHANCE : BALANCE.LOOT_NORMAL_BONUS_CHANCE;
        calculateCappedLootChance(bonusChance, dropRateMult, bossDropMult, progressionLootMult);
    }
    const lateMaterialMults = [enemyDropMult, dropRateMult, bossDropMult, progressionLootMult];
    const lateMaterialChance = getLateEnhanceMaterialChance(enemy);
    if (lateMaterialChance !== null) calculateCappedLootChance(lateMaterialChance, ...lateMaterialMults);

    const allItems = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors];

    // PR #10: 프레스티지 rank≥3 "심연의 메아리" — 보스 처치 시 희귀(고티어) 장비 보장.
    //   드롭 경로(enrichedList/legacy)와 무관하게 1회 보장하므로 early-return 전에 처리.
    //   보스 한정(엘리트 제외)이라 경제 인플레 없이 하드코어 엔드게임 보상으로 작동.
    if (enemy?.isBoss && getPrestigeUnlocks(player?.meta?.prestigeRank).guaranteedRareBossDrop) {
        const inferredLvl = Math.max(1, Math.floor(((enemy.exp || BALANCE.LOOT_BASE_EXP) - BALANCE.LOOT_BASE_EXP) / BALANCE.LOOT_EXP_LEVEL_DIVISOR));
        const rareTier = inferredLvl >= 50 ? 6 : inferredLvl >= 40 ? 5 : 4;
        const pool = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter((i) => (i.tier || 1) === rareTier);
        if (pool.length > 0) {
            const picked = pool[Math.floor(random() * pool.length)];
            const baseItem = withCanonicalEquipmentBaseIdentity({ ...picked, id: `${currentTime()}_${random().toString(16).slice(2, 8)}` });
            const newItem = applyItemPrefix(baseItem, random);
            const candidateLogs: LootLog[] = [{ type: 'event', text: MSG.PRESTIGE_RARE_DROP(newItem.name ?? '') }];
            if (newItem.prefixed) candidateLogs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName ?? '') });
            // 2026-10 Wave 58: "보장"이므로 가방이 가득 차도 들어간다 — 일반 전리품과 같이 상한에서 막히던 동안 가득 찬
            //   가방으로 보스를 잡으면 보장 장비가 사라졌다.
            appendCandidate(newItem, candidateLogs, true);
        }
    }

    // 강화 드롭 테이블 우선 참조
    if (enrichedList) {
        enrichedList.forEach((entry) => {
            // Signature 아이템에만 pity 배율 적용 (일반 아이템 드롭률은 변동 없음)
            const isSignature = Boolean(SIGNATURE_ITEM_REGISTRY[entry.item]);
            const entryPityMult = isSignature ? pityMult : 1;
            const chance = calculateCappedLootChance(
                entry.rate,
                enemyDropMult,
                dropRateMult,
                bossDropMult,
                progressionLootMult,
                entryPityMult,
            );
            if (random() < chance) {
                const itemData = allItems.find((i) => i.name === entry.item);
                if (!itemData) return;
                const qty = entry.qty ? (entry.qty[0] + Math.floor(random() * (entry.qty[1] - entry.qty[0] + 1))) : 1;
                for (let q = 0; q < qty; q++) {
                    const baseItem = withCanonicalEquipmentBaseIdentity({ ...itemData, id: `${currentTime()}_${random().toString(16).slice(2, 8)}` });
                    const newItem = applyItemPrefix(baseItem, random);
                    const candidateLogs: LootLog[] = [{ type: 'success', text: MSG.LOOT_GET(newItem.name ?? '') }];
                    if (newItem.prefixed) {
                        candidateLogs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName ?? '') });
                    }
                    appendCandidate(newItem, candidateLogs);
                }
            }
        });
        appendLateEnhanceMaterial(enemy, random, currentTime, appendCandidate, lateMaterialMults);
        const items = candidates.map(({ item }) => item);
        const logs = candidates.flatMap(({ logs: candidateLogs }) => candidateLogs);
        return { candidates, items, logs };
    }

    // 레거시 LOOT_TABLE 폴백 (없으면 보너스 드랍만 시도)
    // cycle 171: 기존에는 lootList 없으면 early return으로 보너스 드랍 로직까지 차단됐음.
    //   non-boss 104종(drop/loot 둘 다 없음)이 고레벨이어도 빈손 회귀 fix.
    if (lootList && lootList.length > 0) {
        lootList.forEach((itemName) => {
            const chance = calculateCappedLootChance(
                BALANCE.DROP_CHANCE,
                enemyDropMult,
                dropRateMult,
                bossDropMult,
                progressionLootMult,
            );
            if (random() < chance) {
                const itemData = allItems.find((i) => i.name === itemName);
                if (!itemData) return;

                const baseItem = withCanonicalEquipmentBaseIdentity({ ...itemData, id: `${currentTime()}_${random().toString(16).slice(2, 8)}` });
                const newItem = applyItemPrefix(baseItem, random);
                const candidateLogs: LootLog[] = [{ type: 'success', text: MSG.LOOT_GET(newItem.name ?? '') }];
                if (newItem.prefixed) {
                    candidateLogs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName ?? '') });
                }
                appendCandidate(newItem, candidateLogs);
            }
        });
    }

    // 고레벨 몬스터 보너스 장비 드랍 (exp 기반 레벨 추정)
    if (inferredLevel >= BALANCE.LOOT_BONUS_MIN_LEVEL) {
        const bonusTier = inferredLevel >= 50 ? 6 : inferredLevel >= 40 ? 5 : 4;
        const bonusChance = enemy.isBoss ? BALANCE.LOOT_BOSS_BONUS_CHANCE : BALANCE.LOOT_NORMAL_BONUS_CHANCE;
        if (random() < calculateCappedLootChance(bonusChance, dropRateMult, bossDropMult, progressionLootMult)) {
            const tierPool = normalBonusPool(enemy, player)
                ?? getBossThemedLootPool(enemy)
                ?? [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter((i) => (i.tier || 1) === bonusTier);
            if (tierPool.length > 0) {
                const picked = tierPool[Math.floor(random() * tierPool.length)];
                const baseItem = withCanonicalEquipmentBaseIdentity({ ...picked, id: `${currentTime()}_${random().toString(16).slice(2, 8)}` });
                const newItem = applyItemPrefix(baseItem, random);
                const candidateLogs: LootLog[] = [{ type: 'success', text: MSG.LOOT_GET(newItem.name ?? '') }];
                if (newItem.prefixed) candidateLogs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName ?? '') });
                appendCandidate(newItem, candidateLogs);
            }
        }
    }

    appendLateEnhanceMaterial(enemy, random, currentTime, appendCandidate, lateMaterialMults);
    const items = candidates.map(({ item }) => item);
    const logs = candidates.flatMap(({ logs: candidateLogs }) => candidateLogs);
    return { candidates, items, logs };
};
