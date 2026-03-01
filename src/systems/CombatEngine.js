import { DB } from '../data/db';
import { LOOT_TABLE } from '../data/loot';
import { BALANCE, CONSTANTS } from '../data/constants';
import { applyItemPrefix } from '../utils/itemPrefixUtils';
import { MSG } from '../data/messages';

/**
 * CombatEngine - Pure functions for combat calculations
 * All functions return new state without side effects.
 * 모든 로그 메시지는 한국어로 통일합니다 (messages.js 사용).
 */
export const CombatEngine = {
    DEFAULT_SKILL_LOADOUT: { selected: 0, cooldowns: {} },
    DEFAULT_META: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },

    resolveEnemyBaseName(enemy) {
        if (!enemy) return '';
        if (enemy.baseName) return enemy.baseName;
        if (LOOT_TABLE[enemy.name]) return enemy.name;
        const parts = String(enemy.name || '').split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : (enemy.name || '');
    },

    getElementMultiplier(elem, enemy) {
        if (!elem || elem === 'physical' || elem === 'none') return 1;
        if (enemy?.weakness && enemy.weakness === elem) return 1.25;
        if (enemy?.resistance && enemy.resistance === elem) return 0.75;
        return 1;
    },

    calculateDamage(stats, options = {}) {
        const {
            mult = 1,
            guarding = false,
            elementMultiplier = 1,
            critChance = BALANCE.CRIT_CHANCE
        } = options;
        const guardMult = guarding ? 0.65 : 1;
        const baseDamage = Math.floor(stats.atk * (0.9 + Math.random() * 0.2) * mult * guardMult * elementMultiplier);
        const isCrit = Math.random() < critChance;
        return {
            damage: Math.max(1, isCrit ? baseDamage * 2 : baseDamage),
            isCrit
        };
    },

    tickCombatState(player) {
        const logs = [];
        const updated = { ...player };
        const loadout = updated.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const nextCooldowns = { ...(loadout.cooldowns || {}) };

        Object.keys(nextCooldowns).forEach((key) => {
            if (nextCooldowns[key] > 0) nextCooldowns[key] -= 1;
        });

        updated.skillLoadout = {
            selected: Number.isInteger(loadout.selected) ? loadout.selected : 0,
            cooldowns: nextCooldowns
        };

        const buff = { atk: 0, def: 0, turn: 0, name: null, ...(updated.tempBuff || {}) };
        if (buff.turn > 0) {
            buff.turn -= 1;
            if (buff.turn <= 0) {
                updated.tempBuff = { atk: 0, def: 0, turn: 0, name: null };
                logs.push({ type: 'info', text: MSG.BUFF_EXPIRED });
            } else {
                updated.tempBuff = buff;
            }
        } else {
            updated.tempBuff = { atk: 0, def: 0, turn: 0, name: null };
        }

        updated.status = Array.isArray(updated.status) ? updated.status : [];

        // === 상태이상 DoT 처리 (poison / burn) ===
        const DOT_STATUSES = ['poison', 'burn'];
        updated.status.filter(s => DOT_STATUSES.includes(s)).forEach(s => {
            const dmg = Math.max(1, Math.floor((updated.maxHp || 150) * BALANCE.STATUS_DOT_RATIO));
            updated.hp = Math.max(1, (updated.hp ?? 1) - dmg);
            logs.push({ type: 'warning', text: MSG.STATUS_DOT(s, dmg) });
        });

        return { updatedPlayer: updated, logs };
    },

    attack(_player, enemy, stats) {
        const relics = stats.relics || [];
        const elementMultiplier = this.getElementMultiplier(stats.elem, enemy);

        // 유물: 방어 무시 (armor_pen)
        const apRelic = relics.find(r => r.effect === 'armor_pen');
        const effectiveDef = apRelic ? Math.floor((stats.def || 0) * (1 - apRelic.val)) : (stats.def || 0);
        const statsForAtk = apRelic ? { ...stats, def: effectiveDef } : stats;

        const { damage: baseDmg, isCrit } = this.calculateDamage(statsForAtk, {
            mult: 1,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        // 유물: 연격 (double_strike) — 두 번째 타격 추가
        const dsRelic = relics.find(r => r.effect === 'double_strike');
        const secondHit = dsRelic ? Math.floor(baseDmg * dsRelic.val) : 0;
        const damage = baseDmg + secondHit;

        // 유물: 처형자의 날 (execute_bonus) — 적 HP 25% 미만 시 추가 피해
        const exRelic = relics.find(r => r.effect === 'execute_bonus');
        const finalDamage = (exRelic && enemy.hp / (enemy.maxHp || 1) < exRelic.val.threshold)
            ? Math.floor(damage * (1 + exRelic.val.mult))
            : damage;

        const newEnemyHp = enemy.hp - finalDamage;
        const tags = [];
        if (enemy.guarding) tags.push('방어 격파');
        if (elementMultiplier > 1) tags.push('속성 약점');
        if (elementMultiplier < 1) tags.push('속성 저항');
        if (dsRelic) tags.push('연격');
        if (apRelic) tags.push('방어 무시');

        const logs = [{
            type: isCrit ? 'critical' : 'combat',
            text: MSG.COMBAT_ATTACK_DETAIL(enemy.name, finalDamage, Math.max(0, newEnemyHp), enemy.maxHp, tags)
        }];
        if (isCrit) logs.push({ type: 'critical', text: MSG.COMBAT_CRIT });
        if (elementMultiplier > 1) logs.push({ type: 'success', text: MSG.COMBAT_WEAKNESS });
        if (elementMultiplier < 1) logs.push({ type: 'warning', text: MSG.COMBAT_RESIST });
        if (dsRelic && secondHit > 0) logs.push({ type: 'event', text: `[쌍검 각인] 연격! +${secondHit}` });
        if (exRelic && finalDamage > damage) logs.push({ type: 'event', text: `[처형자의 날] 처형 피해!` });

        return {
            updatedEnemy: { ...enemy, hp: newEnemyHp, guarding: false },
            logs,
            isCrit,
            isVictory: newEnemyHp <= 0
        };
    },

    performSkill(player, enemy, stats, skill) {
        if (!skill) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NONE }] };
        }

        const relics = stats.relics || [];
        const mpCost = skill.mp || BALANCE.SKILL_MP_COST;
        const loadout = player.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const cooldowns = { ...(loadout.cooldowns || {}) };
        const cooldown = cooldowns[skill.name] || 0;

        if (cooldown > 0) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_ON_COOLDOWN(skill.name, cooldown) }] };
        }
        if (player.mp < mpCost) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
        }

        // 유물: 주문 메아리 (free_skill) — 15% 확률 MP 무료
        const freeSkillRelic = relics.find(r => r.effect === 'free_skill');
        const actualMpCost = (freeSkillRelic && Math.random() < freeSkillRelic.val) ? 0 : mpCost;

        const skillElem = skill.type || stats.elem;
        const elementMultiplier = this.getElementMultiplier(skillElem, enemy);
        const { damage, isCrit } = this.calculateDamage(stats, {
            mult: skill.mult || 1.5,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        const extraDamage = ['burn', 'poison', 'bleed'].includes(skill.effect) ? Math.floor(damage * 0.2) : 0;

        // 유물: 정신 연소 (skill_mult) — 스킬 피해 70% 증가
        const smRelic = relics.find(r => r.effect === 'skill_mult');
        const smMult = smRelic ? (1 + smRelic.val) : 1;
        const totalDamage = Math.floor((damage + extraDamage) * smMult);
        const newEnemyHp = enemy.hp - totalDamage;

        const updatedEnemy = { ...enemy, hp: newEnemyHp, guarding: false };
        if (skill.effect === 'stun' || skill.effect === 'freeze') {
            updatedEnemy.stunnedTurns = Math.max(1, updatedEnemy.stunnedTurns || 0);
        }

        const updatedPlayer = {
            ...player,
            mp: player.mp - actualMpCost,
            skillLoadout: { selected: loadout.selected || 0, cooldowns: { ...cooldowns } }
        };
        updatedPlayer.skillLoadout.cooldowns[skill.name] = skill.cooldown || Math.max(1, Math.ceil(mpCost / 15));

        // 유물: 영혼 흡수 (skill_lifesteal) — 스킬 피해의 10% HP 흡수
        const slRelic = relics.find(r => r.effect === 'skill_lifesteal');
        if (slRelic) {
            const heal = Math.floor(totalDamage * slRelic.val);
            updatedPlayer.hp = Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + heal);
        }

        if (skill.type === 'buff' || ['atk_up', 'def_up', 'all_up', 'berserk'].includes(skill.effect)) {
            const buff = { atk: 0, def: 0, turn: skill.turn || 3, name: skill.name };
            if (skill.effect === 'atk_up') buff.atk = Math.max(0.15, (skill.val || 1.3) - 1);
            if (skill.effect === 'def_up') buff.def = Math.max(0.15, (skill.val || 1.3) - 1);
            if (skill.effect === 'all_up') {
                buff.atk = Math.max(0.15, (skill.val || 1.3) - 1);
                buff.def = Math.max(0.15, (skill.val || 1.3) - 1);
            }
            if (skill.effect === 'berserk') {
                buff.atk = Math.max(0.2, (skill.val || 2.0) - 1);
                buff.def = -0.2;
            }
            updatedPlayer.tempBuff = buff;
        }

        const logs = [{
            type: isCrit ? 'critical' : 'combat',
            text: MSG.SKILL_USE(skill.name, totalDamage, enemy.name, Math.max(0, newEnemyHp), enemy.maxHp)
        }];
        if (elementMultiplier > 1) logs.push({ type: 'success', text: MSG.COMBAT_WEAKNESS });
        if (elementMultiplier < 1) logs.push({ type: 'warning', text: MSG.COMBAT_RESIST });
        if (extraDamage > 0) logs.push({ type: 'event', text: MSG.SKILL_STATUS_BONUS(skill.effect, extraDamage) });
        if (updatedPlayer.tempBuff?.name === skill.name) {
            logs.push({ type: 'system', text: MSG.SKILL_BUFF_ACTIVE(skill.name, updatedPlayer.tempBuff.turn) });
        }
        if (actualMpCost === 0 && freeSkillRelic) logs.push({ type: 'event', text: `[주문 메아리] MP 소모 없음!` });
        if (slRelic) {
            const healAmt = Math.floor(totalDamage * slRelic.val);
            if (healAmt > 0) logs.push({ type: 'heal', text: `[영혼 흡수] +${healAmt} HP` });
        }
        if (smRelic && smRelic.val > 0) logs.push({ type: 'event', text: `[정신 연소] 스킬 피해 강화!` });

        return {
            success: true,
            updatedPlayer,
            updatedEnemy,
            logs,
            isCrit,
            isVictory: newEnemyHp <= 0
        };
    },

    enemyAttack(player, enemy, stats) {
        let updatedEnemy = { ...enemy };
        let updatedPlayer = { ...player };
        const logs = [];

        // ── 보스 Phase 2 전환 체크 ─────────────────────────────────────────
        if (updatedEnemy.isBoss && !updatedEnemy.phase2Triggered && updatedEnemy.phase2) {
            const hpRatio = updatedEnemy.hp / Math.max(1, updatedEnemy.maxHp || updatedEnemy.hp);
            if (hpRatio <= BALANCE.BOSS_PHASE2_THRESHOLD) {
                const p2 = updatedEnemy.phase2;
                updatedEnemy = {
                    ...updatedEnemy,
                    name: p2.name,
                    atk: Math.floor(updatedEnemy.atk * (1 + p2.atkBonus)),
                    pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p2.pattern },
                    phase2Triggered: true,
                };
                logs.push({ type: 'warning', text: `⚡ ${p2.log}` });
                if (p2.statusEffect) {
                    const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
                    if (!currentStatus.includes(p2.statusEffect)) {
                        updatedPlayer = { ...updatedPlayer, status: [...currentStatus, p2.statusEffect] };
                        logs.push({ type: 'warning', text: `[Phase 2] [${p2.statusEffect === 'burn' ? '화상' : p2.statusEffect === 'poison' ? '독' : '빙결'}] 상태이상 부여!` });
                    }
                }
            }
        }

        if ((updatedEnemy.stunnedTurns || 0) > 0) {
            updatedEnemy.stunnedTurns -= 1;
            return {
                updatedPlayer,
                updatedEnemy,
                damage: 0,
                isDead: false,
                logs: [...logs, { type: 'info', text: MSG.COMBAT_ENEMY_STUNNED(enemy.name) }]
            };
        }

        const pattern = updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 };
        const roll = Math.random();
        if (roll < pattern.guardChance) {
            return {
                updatedPlayer,
                updatedEnemy: { ...updatedEnemy, guarding: true },
                damage: 0,
                isDead: false,
                logs: [...logs, { type: 'warning', text: MSG.COMBAT_ENEMY_GUARD(updatedEnemy.name) }]
            };
        }

        const heavy = roll < pattern.guardChance + pattern.heavyChance;
        const mult = heavy ? 1.4 : 1;

        // 유물: 가시 갑옷 (reflect) — 피격 시 적에게 반사
        const relics = stats.relics || [];
        const reflectRelic = relics.find(r => r.effect === 'reflect');
        const reflectDmg = reflectRelic ? Math.floor(stats.def * reflectRelic.val) : 0;
        const enemyHpAfterReflect = reflectDmg > 0 ? Math.max(0, updatedEnemy.hp - reflectDmg) : updatedEnemy.hp;
        if (reflectDmg > 0) {
            updatedEnemy = { ...updatedEnemy, hp: enemyHpAfterReflect };
            logs.push({ type: 'event', text: `[가시 갑옷] 반사 피해 ${reflectDmg}!` });
        }

        const enemyDmg = Math.max(1, Math.floor((updatedEnemy.atk * mult) - stats.def));
        const newPlayerHp = Math.max(0, updatedPlayer.hp - enemyDmg);

        return {
            updatedPlayer: { ...updatedPlayer, hp: newPlayerHp },
            updatedEnemy: { ...updatedEnemy, guarding: false },
            damage: enemyDmg,
            isDead: newPlayerHp <= 0,
            logs: [...logs, {
                type: heavy ? 'critical' : 'warning',
                text: heavy ? MSG.COMBAT_ENEMY_HEAVY_HIT(updatedEnemy.name, enemyDmg) : MSG.COMBAT_ENEMY_HIT(updatedEnemy.name, enemyDmg)
            }]
        };
    },

    attemptEscape(enemy, stats) {
        const success = Math.random() > BALANCE.ESCAPE_CHANCE;
        if (success) {
            return { success: true, logs: [{ type: 'info', text: MSG.ESCAPE_SUCCESS }] };
        }

        const enemyDmg = Math.max(1, enemy.atk - stats.def);
        return {
            success: false,
            damage: enemyDmg,
            logs: [
                { type: 'error', text: MSG.ESCAPE_FAIL },
                { type: 'warning', text: MSG.ESCAPE_FAIL_DMG(enemy.name, enemyDmg) }
            ]
        };
    },

    handleVictory(player, enemy) {
        const p = { ...player };
        const relics = p.relics || [];

        // 유물: EXP/골드 배율
        const expMult = 1 + (relics.find(r => r.effect === 'exp_mult')?.val || 0);
        const goldMult = 1 + (relics.find(r => r.effect === 'gold_mult')?.val || 0);
        const expGained = Math.floor(enemy.exp * expMult);
        const goldGained = Math.floor(enemy.gold * goldMult);

        p.exp += expGained;
        p.gold += goldGained;

        const baseName = this.resolveEnemyBaseName(enemy);
        const isDemonKingSlain = baseName === '마왕' || baseName.includes('마왕');
        const prevStats = p.stats || { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 };
        p.stats = {
            ...prevStats,
            kills: (prevStats.kills || 0) + 1,
            total_gold: (prevStats.total_gold || 0) + goldGained,
            killRegistry: {
                ...(prevStats.killRegistry || {}),
                [baseName]: ((prevStats.killRegistry || {})[baseName] || 0) + 1
            }
        };
        if (enemy.isBoss) p.stats.bossKills = (p.stats.bossKills || 0) + 1;

        const logs = [{ type: 'success', text: MSG.VICTORY(expGained, goldGained) }];
        let leveledUp = false;
        let visualEffect = null;

        const meta = { ...this.DEFAULT_META, ...(p.meta || {}) };
        const essenceGain = Math.max(1, Math.floor(enemy.exp / 8));
        meta.essence += essenceGain;
        logs.push({ type: 'event', text: MSG.LEGACY_ESSENCE(essenceGain) });

        const nextRank = Math.floor(meta.essence / 150);
        if (nextRank > meta.rank) {
            const gain = nextRank - meta.rank;
            meta.rank = nextRank;
            meta.bonusAtk += gain;
            meta.bonusHp += gain * 5;
            meta.bonusMp += gain * 3;
            logs.push({ type: 'system', text: MSG.LEGACY_RANK(meta.rank) });
        }
        p.meta = meta;

        // 유물: 피의 서약 (on_kill_heal) — 처치 시 HP 회복
        const healRelic = relics.find(r => r.effect === 'on_kill_heal');
        if (healRelic) {
            const heal = Math.floor((p.maxHp || 150) * healRelic.val);
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[피의 서약] +${heal} HP` });
        }

        if (p.exp >= p.nextExp) {
            p.level += 1;
            p.exp -= p.nextExp;
            // v4.0: EXP 스케일 완화 (1.5 → BALANCE.EXP_SCALE_RATE 1.2)
            p.nextExp = Math.floor(p.nextExp * BALANCE.EXP_SCALE_RATE);
            if (p.level >= 50) p.nextExp = Math.max(p.nextExp, BALANCE.EXP_LEVEL_CAP_50);
            p.maxHp += 20;
            p.maxMp += 10;
            p.hp = p.maxHp;
            p.mp = p.maxMp;
            p.atk += 2;
            p.def += 1;
            leveledUp = true;
            visualEffect = 'levelUp';
            logs.push({ type: 'system', text: MSG.LEVEL_UP(p.level) });
        }

        return { updatedPlayer: p, logs, leveledUp, visualEffect, expGained, goldGained, isDemonKingSlain };
    },

    updateQuestProgress(player, enemyName) {
        if (!player.quests?.length) return { updatedQuests: player.quests || [], completedCount: 0 };
        const normalizedEnemyName = enemyName || '';

        const updatedQuests = player.quests.map((q) => {
            const qData = q.isBounty ? q : DB.QUESTS.find((dbQ) => dbQ.id === q.id);
            if (!qData) return q;

            // 정확히 일치하거나, 적 이름이 퀘스트 목표를 포함(엘리트 접두어 처리)하는 경우만 허용
            // 반대 방향(qData.target이 enemyName을 포함)은 false positive를 유발하므로 제외
            const exactMatch = qData.target === normalizedEnemyName;
            const prefixedMatch = normalizedEnemyName.includes(qData.target);
            if (exactMatch || prefixedMatch) {
                return { ...q, progress: Math.min(qData.goal, q.progress + 1) };
            }
            if (qData.target === 'Level') {
                return { ...q, progress: player.level };
            }
            return q;
        });

        const completedCount = updatedQuests.filter((q) => {
            const qData = q.isBounty ? q : DB.QUESTS.find((dbQ) => dbQ.id === q.id);
            return qData && q.progress >= qData.goal && player.quests.find(pq => pq.id === q.id)?.progress < qData.goal;
        }).length;

        return { updatedQuests, completedCount };
    },

    processLoot(enemy) {
        const items = [];
        const logs = [];
        const lootKey = this.resolveEnemyBaseName(enemy) || enemy.name;
        const lootList = LOOT_TABLE[lootKey] || LOOT_TABLE[enemy.name];

        if (!lootList || lootList.length === 0) return { items: [], logs: [] };

        lootList.forEach((itemName) => {
            const chance = BALANCE.DROP_CHANCE * (enemy.dropMod || 1.0);
            if (Math.random() < chance) {
                const itemData = [...DB.ITEMS.materials, ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]
                    .find((i) => i.name === itemName);
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

        return { items, logs };
    },

    handleDefeat(player, INITIAL_PLAYER) {
        let droppedItem = null;
        if (player.inv?.length > 0) {
            const tradableItems = player.inv.filter((i) => !i.id?.startsWith('starter_'));
            if (tradableItems.length > 0) droppedItem = tradableItems[Math.floor(Math.random() * tradableItems.length)];
        }

        const graveData = {
            loc: player.loc,
            gold: Math.floor(player.gold / 2),
            item: droppedItem,
            timestamp: Date.now()
        };

        const starterState = { ...INITIAL_PLAYER };
        const meta = { ...this.DEFAULT_META, ...(player.meta || {}) };
        const prevStats = player.stats || starterState.stats || {};

        starterState.stats = {
            ...starterState.stats,
            ...prevStats,
            deaths: (prevStats.deaths || 0) + 1
        };
        starterState.meta = meta;
        starterState.achievements = Array.isArray(player.achievements) ? [...player.achievements] : [];
        starterState.skillLoadout = { selected: 0, cooldowns: {} };
        starterState.name = '';
        starterState.gold = CONSTANTS.START_GOLD;
        starterState.atk = (starterState.atk || 10) + (meta.bonusAtk || 0);
        starterState.maxHp = (starterState.maxHp || 150) + (meta.bonusHp || 0);
        starterState.maxMp = (starterState.maxMp || 50) + (meta.bonusMp || 0);
        starterState.hp = starterState.maxHp;
        starterState.mp = starterState.maxMp;
        starterState.inv = [
            { ...DB.ITEMS.consumables[0], id: 'starter_1' },
            { ...DB.ITEMS.consumables[0], id: 'starter_2' }
        ];

        return {
            updatedPlayer: starterState,
            graveData,
            logs: [{ type: 'error', text: MSG.DEFEAT }]
        };
    }
};
