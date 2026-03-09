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
    DEFAULT_COMBAT_FLAGS: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },

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

    getCombatFlags(player) {
        return { ...this.DEFAULT_COMBAT_FLAGS, ...(player?.combatFlags || {}) };
    },

    getEffectiveMaxMp(player, relics = []) {
        const rmp = 1 + relics.reduce((acc, relic) => {
            if (relic.effect === 'mp_mult') return acc + relic.val;
            if (relic.effect === 'omega') return acc + relic.val;
            return acc;
        }, 0);
        return Math.floor((player?.maxMp || 50) * rmp);
    },

    applyCritMpRestore(player, relics = [], logs = []) {
        const critMpRelic = relics.find((relic) => relic.effect === 'crit_mp_regen');
        if (!critMpRelic) return player;

        const nextMp = Math.min(this.getEffectiveMaxMp(player, relics), (player.mp || 0) + critMpRelic.val);
        if (nextMp > (player.mp || 0)) {
            logs.push({ type: 'event', text: `[피의 갈증] +${nextMp - (player.mp || 0)} MP` });
        }
        return { ...player, mp: nextMp };
    },

    applyFatalProtection(player, relics = [], incomingDamage = 0, logs = []) {
        const flags = this.getCombatFlags(player);
        let nextHp = Math.max(0, (player.hp || 0) - Math.max(0, incomingDamage));

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic) => relic.effect === 'death_save');
            if (deathSaveRelic && !flags.deathSaveUsed) {
                nextHp = 1;
                flags.deathSaveUsed = true;
                logs.push({ type: 'event', text: '[불사의 의지] 치명상을 버텼습니다!' });
            } else {
                const voidHeartRelic = relics.find((relic) => relic.effect === 'void_heart');
                if (voidHeartRelic && !flags.voidHeartUsed) {
                    nextHp = 1;
                    flags.voidHeartUsed = true;
                    flags.voidHeartArmed = true;
                    logs.push({ type: 'event', text: '[허공의 심장] 죽음을 거부했습니다. 다음 공격이 강화됩니다!' });
                }
            }
        }

        return {
            updatedPlayer: { ...player, hp: nextHp, combatFlags: flags },
            isDead: nextHp <= 0
        };
    },

    // ── 스킬 효과 → 적 상태 적용 (#5) ─────────────────────────────────────
    /**
     * 스킬 effect 값을 적 오브젝트에 상태이상으로 적용합니다.
     * blind / fear / curse / taunt / stun / freeze / poison / burn / bleed 처리.
     */
    applyStatusEffectToEnemy(enemy, effect) {
        if (!effect) return enemy;
        switch (effect) {
            case 'blind':
                return { ...enemy, blindTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, 0.65) };
            case 'fear':
                return { ...enemy, fearTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, 0.70) };
            case 'curse':
                return { ...enemy, cursedTurns: 3, atkMult: Math.min(enemy.atkMult ?? 1, 0.80), cursed: true };
            case 'taunt':
                return { ...enemy, taunted: true, tauntTurns: 1 };
            case 'stun':
            case 'freeze':
                return { ...enemy, stunnedTurns: Math.max(enemy.stunnedTurns ?? 0, 1) };
            case 'poison':
            case 'burn':
            case 'bleed': {
                const existingDots = Array.isArray(enemy.dots) ? enemy.dots : [];
                if (!existingDots.includes(effect)) {
                    return { ...enemy, dots: [...existingDots, effect] };
                }
                return enemy;
            }
            default:
                return enemy;
        }
    },

    /**
     * 적의 상태이상 틱을 처리합니다. 매 적 행동 전에 호출하세요.
     * DoT 피해, 상태 턴 감소, 만료 처리를 수행합니다.
     */
    tickEnemyStatus(enemy, logs = []) {
        let updated = { ...enemy };

        // DoT (burn / poison / bleed)
        (updated.dots || []).forEach(dot => {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || 100) * 0.05));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            const dotKor = dot === 'burn' ? '화상' : dot === 'poison' ? '독' : '출혈';
            logs.push({ type: 'event', text: `[${dotKor}] ${updated.name}에게 ${dmg} 지속 피해!` });
        });
        // 저주 DoT
        if (updated.cursed) {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || 100) * 0.03));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            logs.push({ type: 'event', text: `[저주] ${updated.name}에게 ${dmg} 저주 피해!` });
        }

        // 상태 턴 감소 & 만료
        if ((updated.blindTurns ?? 0) > 0) {
            updated.blindTurns -= 1;
            if (updated.blindTurns <= 0) { delete updated.blindTurns; delete updated.atkMult; }
        }
        if ((updated.fearTurns ?? 0) > 0) {
            updated.fearTurns -= 1;
            if (updated.fearTurns <= 0) { delete updated.fearTurns; delete updated.atkMult; }
        }
        if ((updated.cursedTurns ?? 0) > 0) {
            updated.cursedTurns -= 1;
            if (updated.cursedTurns <= 0) { delete updated.cursedTurns; updated.cursed = false; delete updated.atkMult; }
        }
        if ((updated.tauntTurns ?? 0) > 0) {
            updated.tauntTurns -= 1;
            if (updated.tauntTurns <= 0) { delete updated.tauntTurns; updated.taunted = false; }
        }

        return { updatedEnemy: updated, logs };
    },

    tickCombatState(player) {
        const logs = [];
        const updated = { ...player };
        const relics = updated.relics || [];
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

        const mpRegenRelic = relics.find((relic) => relic.effect === 'mp_regen_turn');
        if (mpRegenRelic) {
            const nextMp = Math.min(this.getEffectiveMaxMp(updated, relics), (updated.mp || 0) + mpRegenRelic.val);
            if (nextMp > (updated.mp || 0)) {
                updated.mp = nextMp;
                logs.push({ type: 'event', text: `[비전 서지] +${mpRegenRelic.val} MP` });
            }
        }

        return { updatedPlayer: updated, logs };
    },

    attack(player, enemy, stats) {
        const relics = stats.relics || [];
        const elementMultiplier = this.getElementMultiplier(stats.elem, enemy);
        const logs = [];
        let updatedPlayer = { ...player, combatFlags: this.getCombatFlags(player) };
        const flags = this.getCombatFlags(player);

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
        const executeTriggered = Boolean(exRelic && enemy.hp / (enemy.maxHp || 1) < exRelic.val.threshold);
        let finalDamage = executeTriggered
            ? Math.floor(damage * (1 + exRelic.val.mult))
            : damage;

        const comboRelic = relics.find((relic) => relic.effect === 'combo_stack');
        let comboTriggered = false;
        if (comboRelic) {
            if ((flags.comboCount || 0) >= comboRelic.val.stack) {
                finalDamage = Math.floor(finalDamage * (1 + comboRelic.val.bonus));
                flags.comboCount = 0;
                comboTriggered = true;
            } else {
                flags.comboCount = (flags.comboCount || 0) + 1;
            }
        }

        const voidHeartRelic = relics.find((relic) => relic.effect === 'void_heart');
        let voidHeartTriggered = false;
        if (voidHeartRelic && flags.voidHeartArmed) {
            finalDamage = Math.floor(finalDamage * voidHeartRelic.val.dmg_mult);
            flags.voidHeartArmed = false;
            voidHeartTriggered = true;
        }

        const newEnemyHp = enemy.hp - finalDamage;
        const tags = [];
        if (enemy.guarding) tags.push('방어 격파');
        if (elementMultiplier > 1) tags.push('속성 약점');
        if (elementMultiplier < 1) tags.push('속성 저항');
        if (dsRelic) tags.push('연격');
        if (apRelic) tags.push('방어 무시');
        if (comboTriggered) tags.push('연속 베기');
        if (voidHeartTriggered) tags.push('허공 각성');

        updatedPlayer = { ...updatedPlayer, combatFlags: flags };
        if (isCrit) {
            updatedPlayer = this.applyCritMpRestore(updatedPlayer, relics, logs);
        }

        logs.unshift({
            type: isCrit ? 'critical' : 'combat',
            text: MSG.COMBAT_ATTACK_DETAIL(enemy.name, finalDamage, Math.max(0, newEnemyHp), enemy.maxHp, tags)
        });
        if (isCrit) logs.push({ type: 'critical', text: MSG.COMBAT_CRIT });
        if (elementMultiplier > 1) logs.push({ type: 'success', text: MSG.COMBAT_WEAKNESS });
        if (elementMultiplier < 1) logs.push({ type: 'warning', text: MSG.COMBAT_RESIST });
        if (dsRelic && secondHit > 0) logs.push({ type: 'event', text: `[쌍검 각인] 연격! +${secondHit}` });
        if (executeTriggered) logs.push({ type: 'event', text: `[처형자의 날] 처형 피해!` });
        if (comboTriggered) logs.push({ type: 'event', text: '[연격의 반지] 축적된 연격이 폭발했습니다!' });
        if (voidHeartTriggered) logs.push({ type: 'event', text: '[허공의 심장] 허공 각성 일격!' });

        return {
            updatedPlayer,
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

        const dotRelic = relics.find((relic) => relic.effect === 'dot_mult');
        const dotMult = dotRelic ? dotRelic.val : 1;
        const extraDamage = ['burn', 'poison', 'bleed'].includes(skill.effect)
            ? Math.floor(damage * 0.2 * dotMult)
            : 0;

        // 유물: 정신 연소 (skill_mult) — 스킬 피해 70% 증가
        const smRelic = relics.find(r => r.effect === 'skill_mult');
        const smMult = smRelic ? (1 + smRelic.val) : 1;
        const totalDamage = Math.floor((damage + extraDamage) * smMult);
        const newEnemyHp = enemy.hp - totalDamage;

        // 적에게 상태이상 부여 (#5)
        // stun/freeze/poison/burn/bleed/blind/fear/curse/taunt 통합 처리
        const STATUS_EFFECTS_TO_ENEMY = ['stun', 'freeze', 'poison', 'burn', 'bleed', 'blind', 'fear', 'curse', 'taunt'];
        let postEffectEnemy = { ...enemy, hp: newEnemyHp, guarding: false };
        if (STATUS_EFFECTS_TO_ENEMY.includes(skill.effect)) {
            postEffectEnemy = this.applyStatusEffectToEnemy(postEffectEnemy, skill.effect);
            const effectLabels = { stun: '기절', freeze: '빙결', poison: '독', burn: '화상', bleed: '출혈', blind: '실명', fear: '공포', curse: '저주', taunt: '도발' };
            if (effectLabels[skill.effect]) {
                logs.push({ type: 'event', text: `[${skill.name}] ${enemy.name}에게 [${effectLabels[skill.effect]}] 부여!` });
            }
        }
        const updatedEnemy = postEffectEnemy;

        const updatedPlayer = {
            ...player,
            mp: player.mp - actualMpCost,
            skillLoadout: { selected: loadout.selected || 0, cooldowns: { ...cooldowns } },
            combatFlags: {
                ...this.getCombatFlags(player),
                comboCount: 0
            }
        };
        updatedPlayer.skillLoadout.cooldowns[skill.name] = skill.cooldown || Math.max(1, Math.ceil(mpCost / 15));
        const logs = [{
            type: isCrit ? 'critical' : 'combat',
            text: MSG.SKILL_USE(skill.name, totalDamage, enemy.name, Math.max(0, newEnemyHp), enemy.maxHp)
        }];

        // 유물: 영혼 흡수 (skill_lifesteal) — 스킬 피해의 10% HP 흡수
        const slRelic = relics.find(r => r.effect === 'skill_lifesteal');
        if (slRelic) {
            const heal = Math.floor(totalDamage * slRelic.val);
            updatedPlayer.hp = Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + heal);
        }
        if (isCrit) {
            const critLogs = [];
            const restoredPlayer = this.applyCritMpRestore(updatedPlayer, relics, critLogs);
            updatedPlayer.mp = restoredPlayer.mp;
            critLogs.forEach((entry) => logs.push(entry));
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

        // drain: 스킬 피해의 25% HP 흡수 (#5)
        if (skill.effect === 'drain') {
            const drainHeal = Math.floor(totalDamage * 0.25);
            updatedPlayer.hp = Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + drainHeal);
            logs.push({ type: 'heal', text: `[생명흡수] +${drainHeal} HP 흡수!` });
        }

        // purify: 플레이어 상태이상 전부 제거 + 로그 (#5)
        if (skill.effect === 'purify') {
            const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
            if (currentStatus.length > 0) {
                updatedPlayer.status = [];
                logs.push({ type: 'success', text: `[${skill.name}] 상태이상이 정화되었습니다!` });
            }
        }

        // stealth: 다음 적 공격 1회 회피 플래그 설정 (#5)
        if (skill.effect === 'stealth') {
            updatedPlayer.nextHitEvaded = true;
            logs.push({ type: 'event', text: `[${skill.name}] 다음 적 공격을 회피합니다!` });
        }


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
        if (dotRelic && extraDamage > 0) logs.push({ type: 'event', text: '[죽음의 낙인] 지속 피해가 증폭됩니다!' });

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

        // ── 적 상태이상 틱 처리 (#5) ──────────────────────────────────────
        const enemyTickResult = this.tickEnemyStatus(updatedEnemy, []);
        updatedEnemy = enemyTickResult.updatedEnemy;
        enemyTickResult.logs.forEach(l => logs.push(l));
        // DoT로 인해 이미 사망한 경우
        if (updatedEnemy.hp <= 0) {
            return { updatedPlayer, updatedEnemy, damage: 0, isDead: false, isEnemyDead: true, logs };
        }

        // ── stealth 회피 처리 (#5) ────────────────────────────────────────
        if (updatedPlayer.nextHitEvaded) {
            updatedPlayer = { ...updatedPlayer, nextHitEvaded: false };
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: `[은신] ${enemy.name}의 공격을 회피했습니다!` }]
            };
        }

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

        // taunt: 적이 반드시 강타만 사용 (#5)
        const effectivePattern = updatedEnemy.taunted
            ? { guardChance: 0, heavyChance: 1.0 }
            : (updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 });

        const pattern = effectivePattern;
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
        const relics = stats.relics || [];
        let mult = heavy ? 1.4 : 1;
        const critBlockRelic = relics.find((relic) => relic.effect === 'crit_block');
        if (heavy && critBlockRelic && Math.random() < critBlockRelic.val) {
            mult = 1;
            logs.push({ type: 'event', text: '[강철 의지] 강타를 흘려냈습니다!' });
        }
        const heavyResolved = heavy && mult > 1;

        // 유물: 가시 갑옷 (reflect) — 피격 시 적에게 반사
        const reflectRelic = relics.find(r => r.effect === 'reflect');
        const reflectDmg = reflectRelic ? Math.floor(stats.def * reflectRelic.val) : 0;
        const enemyHpAfterReflect = reflectDmg > 0 ? Math.max(0, updatedEnemy.hp - reflectDmg) : updatedEnemy.hp;
        if (reflectDmg > 0) {
            updatedEnemy = { ...updatedEnemy, hp: enemyHpAfterReflect };
            logs.push({ type: 'event', text: `[가시 갑옷] 반사 피해 ${reflectDmg}!` });
        }

        // atkMult: blind / fear / curse에 의한 적 공격력 감소 (#5)
        const enemyAtkMult = updatedEnemy.atkMult ?? 1;
        const enemyDmg = Math.max(1, Math.floor((updatedEnemy.atk * mult * enemyAtkMult) - stats.def));
        if (enemyAtkMult < 1 && (updatedEnemy.blindTurns > 0 || updatedEnemy.fearTurns > 0 || updatedEnemy.cursedTurns > 0)) {
            const statusName = updatedEnemy.blindTurns > 0 ? '실명' : updatedEnemy.fearTurns > 0 ? '공포' : '저주';
            logs.push({ type: 'info', text: `[${statusName}] ${updatedEnemy.name}의 공격력이 감소합니다!` });
        }
        const protectedResult = this.applyFatalProtection(updatedPlayer, relics, enemyDmg, logs);


        return {
            updatedPlayer: protectedResult.updatedPlayer,
            updatedEnemy: { ...updatedEnemy, guarding: false },
            damage: enemyDmg,
            isDead: protectedResult.isDead,
            isCrit: heavyResolved,
            logs: [...logs, {
                type: heavyResolved ? 'critical' : 'warning',
                text: heavyResolved ? MSG.COMBAT_ENEMY_HEAVY_HIT(updatedEnemy.name, enemyDmg) : MSG.COMBAT_ENEMY_HIT(updatedEnemy.name, enemyDmg)
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

    applyExpGain(player, expGained = 0) {
        const p = { ...player, exp: (player.exp || 0) + expGained };
        const logs = [];
        let levelUps = 0;
        let visualEffect = null;

        while (p.level < CONSTANTS.MAX_LEVEL && p.exp >= p.nextExp) {
            p.exp -= p.nextExp;
            p.level += 1;
            p.nextExp = Math.floor(p.nextExp * BALANCE.EXP_SCALE_RATE);
            if (p.level >= 50) p.nextExp = Math.max(p.nextExp, BALANCE.EXP_LEVEL_CAP_50);
            p.maxHp += 20;
            p.maxMp += 10;
            p.hp = p.maxHp;
            p.mp = p.maxMp;
            p.atk += 2;
            p.def += 1;
            levelUps += 1;
            visualEffect = 'levelUp';
            logs.push({ type: 'system', text: MSG.LEVEL_UP(p.level) });
        }

        if (p.level >= CONSTANTS.MAX_LEVEL) {
            p.exp = Math.min(p.exp, Math.max(0, p.nextExp - 1));
        }

        return {
            updatedPlayer: p,
            logs,
            leveledUp: levelUps > 0,
            levelUps,
            visualEffect
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

        const expResult = this.applyExpGain(p, expGained);
        expResult.logs.forEach((log) => logs.push(log));
        leveledUp = expResult.leveledUp;
        visualEffect = expResult.visualEffect;

        return {
            updatedPlayer: {
                ...expResult.updatedPlayer,
                combatFlags: {
                    ...this.getCombatFlags(expResult.updatedPlayer),
                    comboCount: 0,
                    deathSaveUsed: false
                }
            },
            logs,
            leveledUp,
            visualEffect,
            expGained,
            goldGained,
            isDemonKingSlain
        };
    },

    updateQuestProgress(player, enemyName) {
        if (!player.quests?.length) return { updatedQuests: player.quests || [], completedCount: 0 };
        const normalizedEnemyName = enemyName || '';

        const updatedQuests = player.quests.map((q) => {
            const qData = q.isBounty ? q : DB.QUESTS.find((dbQ) => dbQ.id === q.id);
            if (!qData) return q;

            // ─ 통계 기반 퀘스트 타입 (#7) ────────────────────────────────
            // explore_count: 탐색 횟수 동기화
            if (qData.type === 'explore_count' && qData.target === 'explores') {
                const current = player.stats?.explores || 0;
                return { ...q, progress: Math.min(qData.goal, current) };
            }
            // craft: 제작 횟수 동기화
            if (qData.type === 'craft' && qData.target === 'crafts') {
                const current = player.stats?.crafts || 0;
                return { ...q, progress: Math.min(qData.goal, current) };
            }
            // survive_low_hp: 저체력 킬 횟수
            if (qData.type === 'survive_low_hp' && qData.target === 'lowHpWins') {
                const current = player.stats?.lowHpWins || 0;
                return { ...q, progress: Math.min(qData.goal, current) };
            }
            // bounty_count: 현상수배 완료 횟수
            if (qData.type === 'bounty_count' && qData.target === 'bountiesCompleted') {
                const current = player.stats?.bountiesCompleted || 0;
                return { ...q, progress: Math.min(qData.goal, current) };
            }

            // 정확히 일치하거나, 적 이름이 퀘스트 목표를 포함(엘리트 접두어 처리)하는 경우만 허용
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

    processLoot(enemy, player = null) {
        const items = [];
        const logs = [];
        const lootKey = this.resolveEnemyBaseName(enemy) || enemy.name;
        const lootList = LOOT_TABLE[lootKey] || LOOT_TABLE[enemy.name];
        const relics = player?.relics || [];
        const dropRateMult = 1 + (relics.find((relic) => relic.effect === 'drop_rate')?.val || 0);
        const bossDropMult = enemy?.isBoss ? 1 + (relics.find((relic) => relic.effect === 'boss_hunter')?.val?.drop || 0) : 1;

        if (!lootList || lootList.length === 0) return { items: [], logs: [] };

        lootList.forEach((itemName) => {
            const chance = Math.min(1, BALANCE.DROP_CHANCE * (enemy.dropMod || 1.0) * dropRateMult * bossDropMult);
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
