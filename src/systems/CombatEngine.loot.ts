import type { Monster } from '../types/index.js';
import { DB } from '../data/db.js';
import { LOOT_TABLE } from '../data/loot.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { BALANCE } from '../data/constants.js';
import { applyItemPrefix } from '../utils/itemPrefixUtils';
import { MSG } from '../data/messages.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';

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
 * @returns {{ items: Object[], logs: Object[] }}
 */
export const processLoot = (enemy: Monster, player: any = null, signaturePityMult: any = 1.0) => {
    const items: any[] = [];
    const logs: any[] = [];
    const lootKey = resolveEnemyBaseName(enemy) || enemy.name;
    const relics = player?.relics || [];
    const dropRateMult = 1 + (relics.find((relic: any) => relic.effect === 'drop_rate')?.val || 0);
    const bossDropMult = enemy?.isBoss ? 1 + (relics.find((relic: any) => relic.effect === 'boss_hunter')?.val?.drop || 0) : 1;
    const pityMult = Number.isFinite(signaturePityMult) && signaturePityMult > 0 ? signaturePityMult : 1.0;

    const allItems = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors];

    // 강화 드롭 테이블 우선 참조
    const enrichedList = DROP_TABLES[lootKey as string] || DROP_TABLES[enemy.name as string];
    if (enrichedList) {
        enrichedList.forEach((entry: any) => {
            // Signature 아이템에만 pity 배율 적용 (일반 아이템 드롭률은 변동 없음)
            const isSignature = Boolean(SIGNATURE_ITEM_REGISTRY[entry.item]);
            const entryPityMult = isSignature ? pityMult : 1;
            const chance = Math.min(1, entry.rate * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult * entryPityMult);
            if (Math.random() < chance) {
                const itemData = allItems.find((i: any) => i.name === entry.item);
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
    const lootList = LOOT_TABLE[lootKey as string] || LOOT_TABLE[enemy.name as string];
    if (!lootList || lootList.length === 0) return { items: [], logs: [] };

    lootList.forEach((itemName: any) => {
        const chance = Math.min(1, BALANCE.DROP_CHANCE * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult);
        if (Math.random() < chance) {
            const itemData = allItems.find((i: any) => i.name === itemName);
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
            const tierPool = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].filter((i: any) => (i.tier || 1) === bonusTier);
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
