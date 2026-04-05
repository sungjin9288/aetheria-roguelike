import { DB } from '../data/db.js';
import { LOOT_TABLE } from '../data/loot.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { BALANCE } from '../data/constants.js';
import { applyItemPrefix } from '../utils/itemPrefixUtils';
import { MSG } from '../data/messages.js';

/**
 * 적의 기본 이름을 해석합니다 (접두사 제거).
 * CombatEngine.resolveEnemyBaseName과 동일 로직.
 * @param {Object} enemy
 * @returns {string}
 */
export const resolveEnemyBaseName = (enemy) => {
    if (!enemy) return '';
    if (enemy.baseName) return enemy.baseName;
    if (LOOT_TABLE[enemy.name]) return enemy.name;
    const parts = String(enemy.name || '').split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : (enemy.name || '');
};

/**
 * 적 처치 후 아이템 루팅을 처리합니다.
 * CombatEngine.processLoot와 동일한 로직의 독립 순수 함수 버전.
 * @param {Object} enemy
 * @param {Object|null} player
 * @returns {{ items: Object[], logs: Object[] }}
 */
export const processLoot = (enemy, player = null) => {
    const items = [];
    const logs = [];
    const lootKey = resolveEnemyBaseName(enemy) || enemy.name;
    const relics = player?.relics || [];
    const dropRateMult = 1 + (relics.find((relic) => relic.effect === 'drop_rate')?.val || 0);
    const bossDropMult = enemy?.isBoss ? 1 + (relics.find((relic) => relic.effect === 'boss_hunter')?.val?.drop || 0) : 1;

    const allItems = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors];

    // 강화 드롭 테이블 우선 참조
    const enrichedList = DROP_TABLES[lootKey] || DROP_TABLES[enemy.name];
    if (enrichedList) {
        enrichedList.forEach((entry) => {
            const chance = Math.min(1, entry.rate * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult);
            if (Math.random() < chance) {
                const itemData = allItems.find((i) => i.name === entry.item);
                if (!itemData) return;
                const qty = entry.qty ? (entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1))) : 1;
                for (let q = 0; q < qty; q++) {
                    const baseItem = { ...itemData, id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` };
                    const newItem = applyItemPrefix(baseItem);
                    items.push(newItem);
                    logs.push({ type: 'success', text: MSG.LOOT_GET(newItem.name) });
                    if (newItem.prefixed) {
                        logs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName) });
                    }
                }
            }
        });
        return { items, logs };
    }

    // 레거시 LOOT_TABLE 폴백
    const lootList = LOOT_TABLE[lootKey] || LOOT_TABLE[enemy.name];
    if (!lootList || lootList.length === 0) return { items: [], logs: [] };

    lootList.forEach((itemName) => {
        const chance = Math.min(1, BALANCE.DROP_CHANCE * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult);
        if (Math.random() < chance) {
            const itemData = allItems.find((i) => i.name === itemName);
            if (!itemData) return;

            const baseItem = { ...itemData, id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` };
            const newItem = applyItemPrefix(baseItem);
            items.push(newItem);
            logs.push({ type: 'success', text: MSG.LOOT_GET(newItem.name) });
            if (newItem.prefixed) {
                logs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName) });
            }
        }
    });

    // 고레벨 몬스터 보너스 장비 드랍 (exp 기반 레벨 추정)
    const inferredLevel = Math.max(1, Math.floor(((enemy.exp || BALANCE.LOOT_BASE_EXP) - BALANCE.LOOT_BASE_EXP) / BALANCE.LOOT_EXP_LEVEL_DIVISOR));
    if (inferredLevel >= BALANCE.LOOT_BONUS_MIN_LEVEL) {
        const bonusTier = inferredLevel >= 50 ? 6 : inferredLevel >= 40 ? 5 : 4;
        const bonusChance = enemy.isBoss ? BALANCE.LOOT_BOSS_BONUS_CHANCE : BALANCE.LOOT_NORMAL_BONUS_CHANCE;
        if (Math.random() < bonusChance * dropRateMult * bossDropMult) {
            const tierPool = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter(i => (i.tier || 1) === bonusTier);
            if (tierPool.length > 0) {
                const picked = tierPool[Math.floor(Math.random() * tierPool.length)];
                const baseItem = { ...picked, id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` };
                const newItem = applyItemPrefix(baseItem);
                items.push(newItem);
                logs.push({ type: 'success', text: MSG.LOOT_GET(newItem.name) });
                if (newItem.prefixed) logs.push({ type: 'event', text: MSG.LOOT_PREFIX(newItem.prefixName) });
            }
        }
    }

    return { items, logs };
};
