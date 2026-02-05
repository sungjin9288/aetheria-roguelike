import { DB } from '../data/db';
import { LOOT_TABLE } from '../data/loot';
import { BALANCE } from '../data/constants';

/**
 * CombatEngine - Pure functions for combat calculations
 * All functions return new state without side effects
 */
export const CombatEngine = {
    /**
     * Calculate damage with critical hit chance
     */
    calculateDamage(stats, type = 'attack') {
        const mult = type === 'skill' ? 1.5 : 1.0;
        const baseDamage = Math.floor(stats.atk * (0.9 + Math.random() * 0.2) * mult);
        const isCrit = Math.random() < BALANCE.CRIT_CHANCE;
        return {
            damage: isCrit ? baseDamage * 2 : baseDamage,
            isCrit
        };
    },

    /**
     * Process player attack on enemy
     */
    attack(_player, enemy, stats) {
        const { damage, isCrit } = this.calculateDamage(stats, 'attack');
        const newEnemyHp = enemy.hp - damage;

        const logs = [{
            type: isCrit ? 'critical' : 'combat',
            text: `⚔️ ${enemy.name}에게 ${damage} 피해! ${isCrit ? '(치명타!)' : ''} (남은 체력: ${Math.max(0, newEnemyHp)}/${enemy.maxHp})`
        }];

        return {
            updatedEnemy: { ...enemy, hp: newEnemyHp },
            logs,
            isCrit,
            isVictory: newEnemyHp <= 0
        };
    },

    /**
     * Process skill usage
     */
    performSkill(player, enemy, stats) {
        if (player.mp < BALANCE.SKILL_MP_COST) {
            return {
                success: false,
                logs: [{ type: 'error', text: '마나가 부족합니다.' }]
            };
        }

        const { damage, isCrit } = this.calculateDamage(stats, 'skill');
        const newEnemyHp = enemy.hp - damage;
        const newPlayerMp = player.mp - BALANCE.SKILL_MP_COST;

        const logs = [{
            type: isCrit ? 'critical' : 'combat',
            text: `⚔️ ${enemy.name}에게 ${damage} 피해! ${isCrit ? '(치명타!)' : ''} (남은 체력: ${Math.max(0, newEnemyHp)}/${enemy.maxHp})`
        }];

        return {
            success: true,
            updatedPlayer: { ...player, mp: newPlayerMp },
            updatedEnemy: { ...enemy, hp: newEnemyHp },
            logs,
            isCrit,
            isVictory: newEnemyHp <= 0
        };
    },

    /**
     * Process enemy counter-attack
     */
    enemyAttack(player, enemy, stats) {
        const enemyDmg = Math.max(1, enemy.atk - stats.def);
        const newPlayerHp = Math.max(0, player.hp - enemyDmg);

        return {
            updatedPlayer: { ...player, hp: newPlayerHp },
            damage: enemyDmg,
            isDead: newPlayerHp <= 0,
            logs: [{ type: 'warning', text: `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.` }]
        };
    },

    /**
     * Process escape attempt
     */
    attemptEscape(enemy, stats) {
        const success = Math.random() > BALANCE.ESCAPE_CHANCE;

        if (success) {
            return {
                success: true,
                logs: [{ type: 'info', text: '🏃‍♂️ 무사히 도망쳤습니다.' }]
            };
        }

        const enemyDmg = Math.max(1, enemy.atk - stats.def);
        return {
            success: false,
            damage: enemyDmg,
            logs: [
                { type: 'error', text: '도망에 실패했습니다!' },
                { type: 'warning', text: `💥 ${enemy.name}의 추격! ${enemyDmg} 피해.` }
            ]
        };
    },

    /**
     * Process victory rewards and level up
     */
    handleVictory(player, enemy) {
        let p = { ...player };
        p.exp += enemy.exp;
        p.gold += enemy.gold;
        p.stats = { ...p.stats, kills: p.stats.kills + 1 };

        const logs = [{ type: 'success', text: `승리! EXP +${enemy.exp}, Gold +${enemy.gold}` }];
        let leveledUp = false;
        let visualEffect = null;

        // Level up check
        if (p.exp >= p.nextExp) {
            p.level++;
            p.exp -= p.nextExp;
            p.nextExp = Math.floor(p.nextExp * 1.5);
            p.maxHp += 20;
            p.maxMp += 10;
            p.hp = p.maxHp;
            p.mp = p.maxMp;
            p.atk += 2;
            p.def += 1;
            leveledUp = true;
            visualEffect = 'levelUp';
            logs.push({ type: 'system', text: `✨ LEVEL UP! Lv.${p.level} 달성! (HP/MP/Stats 증가)` });
        }

        return {
            updatedPlayer: p,
            logs,
            leveledUp,
            visualEffect
        };
    },

    /**
     * Update quest progress after kill
     */
    updateQuestProgress(player, enemyName) {
        if (player.quests.length === 0) return { updatedQuests: player.quests, completedCount: 0 };

        const updatedQuests = player.quests.map(q => {
            const qData = DB.QUESTS.find(dbQ => dbQ.id === q.id);
            if (qData) {
                if (qData.target === enemyName) {
                    return { ...q, progress: Math.min(qData.goal, q.progress + 1) };
                }
                if (qData.target === 'Level') {
                    return { ...q, progress: player.level };
                }
            }
            return q;
        });

        const completedCount = updatedQuests.filter(q => {
            const qData = DB.QUESTS.find(dbQ => dbQ.id === q.id);
            return qData && q.progress >= qData.goal;
        }).length;

        return { updatedQuests, completedCount };
    },

    /**
     * Process loot drops
     */
    processLoot(enemy) {
        const items = [];
        const logs = [];
        const lootList = LOOT_TABLE[enemy.name];

        if (!lootList || lootList.length === 0) return { items: [], logs: [] };

        lootList.forEach(itemName => {
            if (Math.random() < BALANCE.DROP_CHANCE) {
                const itemData = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]
                    .find(i => i.name === itemName);

                if (itemData) {
                    let newItem = { ...itemData, id: Date.now() + Math.random().toString() };

                    // Item prefix logic (20% for gear)
                    if (['weapon', 'armor'].includes(newItem.type) && Math.random() < 0.2) {
                        const possiblePrefixes = DB.ITEMS.prefixes.filter(p => p.type === 'all' || p.type === newItem.type);
                        if (possiblePrefixes.length > 0) {
                            const prefix = possiblePrefixes[Math.floor(Math.random() * possiblePrefixes.length)];
                            newItem.name = `${prefix.name} ${newItem.name}`;
                            newItem.price = Math.floor(newItem.price * prefix.price);
                            if (prefix.stat === 'atk') newItem.val += prefix.val;
                            if (prefix.stat === 'def') newItem.val += prefix.val;
                            if (prefix.stat === 'hp') newItem.hpBoost = (newItem.hpBoost || 0) + prefix.val;
                            if (prefix.stat === 'all') newItem.val += 5;
                            if (prefix.elem) newItem.elem = prefix.elem;
                            logs.push({ type: 'event', text: `✨ 접두사가 붙은 희귀 아이템 발견! (${prefix.name})` });
                        }
                    }

                    items.push(newItem);
                    logs.push({ type: 'success', text: `📦 ${newItem.name} 획득!` });
                }
            }
        });

        return { items, logs };
    },

    /**
     * Handle player death and create grave
     */
    handleDefeat(player, INITIAL_PLAYER) {
        // Create grave with dropped items
        let droppedItem = null;
        if (player.inv.length > 0) {
            const tradableItems = player.inv.filter(i => !i.id?.startsWith('starter_'));
            if (tradableItems.length > 0) {
                droppedItem = tradableItems[Math.floor(Math.random() * tradableItems.length)];
            }
        }

        const graveData = {
            loc: player.loc,
            gold: Math.floor(player.gold / 2),
            item: droppedItem,
            timestamp: Date.now()
        };

        // Reset to starter state
        const starterState = { ...INITIAL_PLAYER };
        starterState.name = '';
        starterState.gold = 50;
        starterState.inv = [
            { ...DB.ITEMS.consumables[0], id: 'starter_1' },
            { ...DB.ITEMS.consumables[0], id: 'starter_2' }
        ];

        return {
            updatedPlayer: starterState,
            graveData,
            logs: [{ type: 'error', text: '💀 사망했습니다. 레벨과 장비가 초기화되었습니다. (전생)' }]
        };
    }
};
