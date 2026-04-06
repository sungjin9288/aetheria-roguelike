import { DB } from '../data/db.js';
import { LOOT_TABLE } from '../data/loot.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { BOSS_BRIEFS } from '../data/monsters.js';
import { CLASSES } from '../data/classes.js';
import { syncQuestProgress } from '../utils/questProgress.js';
import { buildGraveData } from '../utils/graveUtils.js';
import { MSG } from '../data/messages.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import { processLoot as _processLoot, resolveEnemyBaseName as _resolveEnemyBaseName } from './CombatEngine.loot.js';

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
        return _resolveEnemyBaseName(enemy);
    },

    getElementMultiplier(elem, enemy) {
        if (!elem || elem === 'physical' || elem === 'none') return 1;
        if (enemy?.weakness && enemy.weakness === elem) return BALANCE.ELEMENT_WEAK_MULT;
        if (enemy?.resistance && enemy.resistance === elem) return BALANCE.ELEMENT_RESIST_MULT;
        return 1;
    },

    calculateDamage(stats, options = {}) {
        const {
            mult = 1,
            guarding = false,
            elementMultiplier = 1,
            critChance = BALANCE.CRIT_CHANCE
        } = options;
        const guardMult = guarding ? BALANCE.GUARD_DAMAGE_MULT : 1;
        const baseDamage = Math.floor(stats.atk * (BALANCE.DAMAGE_BASE_RATIO + Math.random() * BALANCE.DAMAGE_VARIANCE) * mult * guardMult * elementMultiplier);
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

    applyFatalProtection(player, relics = [], incomingDamage = 0, logs = [], activeSynergies = []) {
        const flags = this.getCombatFlags(player);
        let nextHp = Math.max(0, (player.hp || 0) - Math.max(0, incomingDamage));

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic) => relic.effect === 'death_save');
            // 시너지: 절대 불사 (absolute_immortal) — reviveCount 2회 지원
            const absoluteImmortalSyn = activeSynergies.find(s => s.bonus.reviveCount);
            const maxRevives = absoluteImmortalSyn ? (absoluteImmortalSyn.bonus.reviveCount || 1) : 1;
            const reviveUsedCount = flags.deathSaveUsedCount || 0;

            if (deathSaveRelic && reviveUsedCount < maxRevives) {
                // 시너지: 불멸의 전사/절대 불사 (reviveHeal) — 부활 시 HP 회복량 증가
                const reviveHealSyn = activeSynergies.find(s => s.bonus.reviveHeal);
                nextHp = reviveHealSyn
                    ? Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * reviveHealSyn.bonus.reviveHeal)
                    : 1;
                flags.deathSaveUsed = true;
                flags.deathSaveUsedCount = reviveUsedCount + 1;
                // 시너지: 난공불락 (healOnSave) — 부활 시 추가 HP 회복
                const healOnSaveSyn = activeSynergies.find(s => s.bonus.healOnSave);
                if (healOnSaveSyn) {
                    const bonus = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * healOnSaveSyn.bonus.healOnSave);
                    nextHp = Math.min(player.maxHp || BALANCE.DEFAULT_MAX_HP, nextHp + bonus);
                    logs.push({ type: 'heal', text: `[난공불락] 부활 시 +${bonus} HP 회복!` });
                }
                const reviveMsg = reviveUsedCount > 0 ? `[절대 불사] ${reviveUsedCount + 1}회 부활!` : '[불사의 의지] 치명상을 버텼습니다!';
                logs.push({ type: 'event', text: reviveMsg });
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
                return { ...enemy, blindTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.BLIND_ATK_MULT) };
            case 'fear':
                return { ...enemy, fearTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.FEAR_ATK_MULT) };
            case 'curse':
                return { ...enemy, cursedTurns: 3, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.CURSE_ATK_MULT), cursed: true };
            case 'taunt':
                return { ...enemy, taunted: true, tauntTurns: 3 };
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
    tickEnemyStatus(enemy, logs = [], curseAmpMult = 1, synergyDotMult = 1) {
        let updated = { ...enemy };

        // DoT (burn / poison / bleed) — 시너지 죽음의 예언자 dotMult 반영
        (updated.dots || []).forEach(dot => {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || 100) * BALANCE.STATUS_DOT_RATIO * synergyDotMult));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            const dotKor = dot === 'burn' ? '화상' : dot === 'poison' ? '독' : '출혈';
            logs.push({ type: 'event', text: `[${dotKor}] ${updated.name}에게 ${dmg} 지속 피해!` });
        });
        // 저주 DoT (curse_amp 패시브 반영)
        if (updated.cursed) {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || BALANCE.DEFAULT_MAX_HP) * BALANCE.CURSE_DOT_RATIO * curseAmpMult));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            logs.push({ type: 'event', text: `[저주] ${updated.name}에게 ${dmg} 저주 피해!` });
        }

        // 상태 턴 감소 & 만료
        if ((updated.blindTurns ?? 0) > 0) {
            if (updated.blindTurns - 1 <= 0) {
                const { blindTurns: _b, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, blindTurns: updated.blindTurns - 1 };
            }
        }
        if ((updated.fearTurns ?? 0) > 0) {
            if (updated.fearTurns - 1 <= 0) {
                const { fearTurns: _f, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, fearTurns: updated.fearTurns - 1 };
            }
        }
        if ((updated.cursedTurns ?? 0) > 0) {
            if (updated.cursedTurns - 1 <= 0) {
                const { cursedTurns: _c, atkMult: _a, ...rest } = updated;
                updated = { ...rest, cursed: false };
            } else {
                updated = { ...updated, cursedTurns: updated.cursedTurns - 1 };
            }
        }
        if ((updated.tauntTurns ?? 0) > 0) {
            if (updated.tauntTurns - 1 <= 0) {
                const { tauntTurns: _t, ...rest } = updated;
                updated = { ...rest, taunted: false };
            } else {
                updated = { ...updated, tauntTurns: updated.tauntTurns - 1 };
            }
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
            const dmg = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * BALANCE.STATUS_DOT_RATIO));
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

        // 유물: 대지의 심장 (regen) — 매 턴 최대 HP의 5% 회복
        const regenRelic = relics.find((relic) => relic.effect === 'regen');
        if (regenRelic && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * (regenRelic.val || 0.05)));
            updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[대지의 심장] +${heal} HP 재생` });
        }

        // 시너지: 영원의 생명 (healPerTurn) — 매 턴 4% HP 재생
        const healPerTurnSyn = getActiveRelicSynergies(relics).find(s => s.bonus.healPerTurn);
        if (healPerTurnSyn && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * healPerTurnSyn.bonus.healPerTurn));
            updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[영원의 생명] +${heal} HP 재생` });
        }

        // 유물: 시간의 파편 (cd_minus) — 매 턴 모든 스킬 쿨타임 추가 -1
        const cdMinusRelic = relics.find((relic) => relic.effect === 'cd_minus');
        if (cdMinusRelic) {
            const cds = { ...(updated.skillLoadout?.cooldowns || {}) };
            let reduced = false;
            Object.keys(cds).forEach((k) => { if (cds[k] > 0) { cds[k] = Math.max(0, cds[k] - 1); reduced = true; } });
            if (reduced) updated.skillLoadout = { ...(updated.skillLoadout || {}), cooldowns: cds };
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

        const { damage: rawBaseDmg, isCrit } = this.calculateDamage(statsForAtk, {
            mult: 1,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelic = relics.find(r => r.effect === 'crit_dmg');
        const baseDmg = (isCrit && critDmgRelic) ? Math.floor(rawBaseDmg * (critDmgRelic.val || 1)) : rawBaseDmg;

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

        // 유물: 예언의 돌판 (execute_atk) — 보스 HP 25% 이하 시 ATK 2배
        const executeAtkRelic = relics.find((r) => r.effect === 'execute_atk');
        let executeAtkTriggered = false;
        if (executeAtkRelic && enemy.isBoss && enemy.hp / Math.max(1, enemy.maxHp || 1) < (executeAtkRelic.threshold || 0.25)) {
            finalDamage = Math.floor(finalDamage * (executeAtkRelic.val || 2.0));
            executeAtkTriggered = true;
        }

        // 유물: 공허의 메아리 (echo_atk) — 스킬 사용 후 다음 일반 공격 피해 강화
        const echoAtkRelic = relics.find((r) => r.effect === 'echo_atk');
        let echoTriggered = false;
        if (echoAtkRelic && flags.echoArmed) {
            finalDamage = Math.floor(finalDamage * (echoAtkRelic.val || 1.8));
            flags.echoArmed = false;
            echoTriggered = true;
        }

        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelic = relics.find(r => r.effect === 'low_hp_dmg');
        if (lowHpDmgRelic) {
            const hpRatio = player.hp / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP);
            if (hpRatio < (lowHpDmgRelic.threshold || 0.4)) {
                finalDamage = Math.floor(finalDamage * (lowHpDmgRelic.val || 1.4));
            }
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

        // 시너지: 흡혈 군주 (vampire_lord) — 일반 공격 흡혈
        const vampireSyn = (stats.activeSynergies || []).find(s => s.bonus.lifeSteal);
        if (vampireSyn) {
            const steal = Math.floor(finalDamage * vampireSyn.bonus.lifeSteal);
            if (steal > 0) {
                updatedPlayer = { ...updatedPlayer, hp: Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + steal) };
                logs.push({ type: 'heal', text: `[흡혈 군주] +${steal} HP 흡혈!` });
            }
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
        if (executeAtkTriggered) logs.push({ type: 'critical', text: '[예언의 돌판] 예언 처형! 피해 2배!' });
        if (echoTriggered) logs.push({ type: 'event', text: '[공허의 메아리] 강화된 공격!' });

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

        // 스킬 분기 선택 적용
        const skillChoiceKey = player.skillChoices?.[skill.name];
        if (skillChoiceKey) {
            const classData = CLASSES[player.job];
            const branches = classData?.skillBranches?.[skill.name];
            if (branches) {
                const branch = branches.find(b => b.choice === skillChoiceKey);
                if (branch?.override) {
                    skill = { ...skill, ...branch.override };
                }
            }
        }

        const relics = stats.relics || [];
        const mpCost = skill.mp || BALANCE.SKILL_MP_COST;
        const loadout = player.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const cooldowns = { ...(loadout.cooldowns || {}) };
        const cooldown = cooldowns[skill.name] || 0;

        // escape_100: 즉시 100% 전투 이탈 (무당 공허의 문 / 시간술사 순간 이동)
        if (skill.effect === 'escape_100') {
            if (player.mp < mpCost) {
                return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
            }
            const updatedPlayer = { ...player, mp: player.mp - mpCost };
            return {
                success: true,
                forceEscape: true,
                updatedPlayer,
                updatedEnemy: enemy,
                logs: [{ type: 'success', text: `[${skill.name}] ${MSG.ESCAPE_SUCCESS}` }],
                isCrit: false,
                isVictory: false
            };
        }

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
        const { damage: rawSkillDmg, isCrit } = this.calculateDamage(stats, {
            mult: skill.mult || 1.5,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelicSkill = relics.find(r => r.effect === 'crit_dmg');
        const damage = (isCrit && critDmgRelicSkill) ? Math.floor(rawSkillDmg * (critDmgRelicSkill.val || 1)) : rawSkillDmg;

        const dotRelic = relics.find((relic) => relic.effect === 'dot_mult');
        const dotMult = dotRelic ? dotRelic.val : 1;
        const extraDamage = ['burn', 'poison', 'bleed'].includes(skill.effect)
            ? Math.floor(damage * 0.2 * dotMult)
            : 0;

        // 유물: 정신 연소 (skill_mult) — 스킬 피해 70% 증가
        const smRelic = relics.find(r => r.effect === 'skill_mult');
        const smMult = smRelic ? (1 + smRelic.val) : 1;
        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelicSkill = relics.find(r => r.effect === 'low_hp_dmg');
        const lowHpMultSkill = (lowHpDmgRelicSkill && player.hp / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP) < (lowHpDmgRelicSkill.threshold || 0.4))
            ? (lowHpDmgRelicSkill.val || 1.4) : 1;
        const totalDamage = Math.floor((damage + extraDamage) * smMult * lowHpMultSkill);
        const newEnemyHp = enemy.hp - totalDamage;

        // 적에게 상태이상 부여 (#5)
        // stun/freeze/poison/burn/bleed/blind/fear/curse/taunt 통합 처리
        const STATUS_EFFECTS_TO_ENEMY = ['stun', 'freeze', 'poison', 'burn', 'bleed', 'blind', 'fear', 'curse', 'taunt'];
        let postEffectEnemy = { ...enemy, hp: newEnemyHp, guarding: false };
        const effectLabels = { stun: '기절', freeze: '빙결', poison: '독', burn: '화상', bleed: '출혈', blind: '실명', fear: '공포', curse: '저주', taunt: '도발' };
        if (STATUS_EFFECTS_TO_ENEMY.includes(skill.effect)) {
            postEffectEnemy = this.applyStatusEffectToEnemy(postEffectEnemy, skill.effect);
            if (effectLabels[skill.effect]) {
                logs.push({ type: 'event', text: `[${skill.name}] ${enemy.name}에게 [${effectLabels[skill.effect]}] 부여!` });
            }
        }
        // 분기 선택으로 추가된 2차 상태이상
        if (skill.secondEffect && STATUS_EFFECTS_TO_ENEMY.includes(skill.secondEffect)) {
            postEffectEnemy = this.applyStatusEffectToEnemy(postEffectEnemy, skill.secondEffect);
            if (effectLabels[skill.secondEffect]) {
                logs.push({ type: 'event', text: `[분기 효과] ${enemy.name}에게 [${effectLabels[skill.secondEffect]}] 추가 부여!` });
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

        // hp_regen: 즉시 HP 회복 (성직자 기적의 손길, 버서커 역경의 힘 등)
        if (skill.effect === 'hp_regen' && skill.val) {
            const healAmt = Math.max(1, Math.floor((updatedPlayer.maxHp || player.maxHp) * skill.val));
            updatedPlayer.hp = Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + healAmt);
            logs.push({ type: 'heal', text: `[${skill.name}] +${healAmt} HP 회복!` });
        }

        // mp_regen: 즉시 MP 회복 (마법사 마나 가속 등)
        if (skill.effect === 'mp_regen' && skill.val) {
            const mpAmt = skill.val;
            const maxMp = this.getEffectiveMaxMp(updatedPlayer, relics);
            updatedPlayer.mp = Math.min(maxMp, (updatedPlayer.mp || player.mp) + mpAmt);
            logs.push({ type: 'event', text: `[${skill.name}] +${mpAmt} MP 회복!` });
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

        // extraTurn: 이번 스킬 사용 후 적 턴 스킵 → 플레이어 추가 행동 (Sprint 16 — 시간술사)
        if (skill.effect === 'extraTurn') {
            updatedPlayer.extraTurnGranted = true;
            if (skill.val && skill.val > 1) {
                const atkBonus = skill.val - 1;
                updatedPlayer.tempBuff = { atk: atkBonus, def: 0, turn: 1, name: skill.name };
            }
            logs.push({ type: 'event', text: MSG.SKILL_EXTRA_TURN(skill.name) });
        }

        // 시너지: 시간 지배자 (time_master) — 스킬 사용 후 10% 확률 추가 행동
        const timeMasterSyn = relics && (stats.activeSynergies || []).find(s => s.bonus.extraTurnChance);
        if (timeMasterSyn && !updatedPlayer.extraTurnGranted && Math.random() < (timeMasterSyn.bonus.extraTurnChance || 0)) {
            updatedPlayer.extraTurnGranted = true;
            logs.push({ type: 'event', text: `[시간 지배자] 시간이 멈춥니다 — 추가 행동!` });
        }

        // resetCooldowns: 모든 스킬 쿨타임을 0으로 초기화 (Sprint 16 — 시간술사)
        if (skill.effect === 'resetCooldowns') {
            const resetLoadout = updatedPlayer.skillLoadout || { selected: 0, cooldowns: {} };
            updatedPlayer.skillLoadout = { ...resetLoadout, cooldowns: {} };
            logs.push({ type: 'event', text: MSG.SKILL_RESET_COOLDOWNS(skill.name) });
        }

        // 유물: 공허의 메아리 (echo_atk) — 스킬 사용 후 다음 일반 공격 강화 플래그
        const echoRelicInSkill = relics.find((r) => r.effect === 'echo_atk');
        if (echoRelicInSkill) {
            updatedPlayer.combatFlags = { ...this.getCombatFlags(updatedPlayer), echoArmed: true };
            logs.push({ type: 'event', text: `[공허의 메아리] 다음 공격이 강화됩니다!` });
        }

        // crit_cooldown: 크리티컬 시 모든 쿨타임 -1 (Sprint 16 — 인과율 조작)
        if (skill.effect === 'crit_cooldown' && isCrit) {
            const cdLoadout = updatedPlayer.skillLoadout || { selected: 0, cooldowns: {} };
            const reducedCds = {};
            Object.entries(cdLoadout.cooldowns || {}).forEach(([k, v]) => {
                if (v > 0) reducedCds[k] = v - 1;
            });
            updatedPlayer.skillLoadout = { ...cdLoadout, cooldowns: reducedCds };
            logs.push({ type: 'event', text: `[인과율 조작] 치명타! 모든 쿨타임 -1.` });
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
        // curse_amp 패시브: 무당/시간술사 직업 보너스
        const curseAmpPassive = CLASSES[player.job]?.skills?.find(s => s.passive && s.effect === 'curse_amp');
        const curseAmpMult = curseAmpPassive ? (curseAmpPassive.val || 1) : 1;
        // 시너지: 죽음의 예언자 (dotMult) — DoT 피해 증폭
        const activeSynergies = stats.activeSynergies || [];
        const synergyDotMult = activeSynergies.reduce((acc, syn) => syn.bonus.dotMult ? acc + syn.bonus.dotMult : acc, 1);
        const enemyTickResult = this.tickEnemyStatus(updatedEnemy, [], curseAmpMult, synergyDotMult);
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

        // ── Phase 전환 체크 (보스 + 엘리트 통합) ───────────────────
        if (updatedEnemy.isBoss || updatedEnemy.isElite) {
            const hpRatio = updatedEnemy.hp / Math.max(1, updatedEnemy.maxHp || updatedEnemy.hp);
            const statusLabels = { burn: '화상', poison: '독', freeze: '빙결', curse: '저주' };

            // Phase 3 (원시의 신 등 3페이즈 보스, threshold 25%)
            if (updatedEnemy.phase3 && !updatedEnemy.phase3Triggered) {
                const threshold = updatedEnemy.phase3.threshold ?? 0.25;
                if (hpRatio <= threshold) {
                    const p3 = updatedEnemy.phase3;
                    updatedEnemy = {
                        ...updatedEnemy,
                        name: p3.name,
                        atk: Math.floor(updatedEnemy.atk * (1 + p3.atkBonus)),
                        pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p3.pattern },
                        phase3Triggered: true,
                    };
                    logs.push({ type: 'critical', text: `💀 ${p3.log}` });
                    if (p3.statusEffect) {
                        const resistRelic = relics.find(r => r.effect === 'status_resist');
                        const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
                        const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
                        if (!currentStatus.includes(p3.statusEffect) && Math.random() >= resistChance) {
                            updatedPlayer = { ...updatedPlayer, status: [...currentStatus, p3.statusEffect] };
                            logs.push({ type: 'warning', text: `[Phase 3] [${statusLabels[p3.statusEffect] || p3.statusEffect}] 상태이상 부여!` });
                        } else if (resistRelic && Math.random() < resistChance) {
                            logs.push({ type: 'success', text: `[고대의 봉인] 상태이상을 저항했습니다!` });
                        }
                    }
                }
            }

            // Phase 2 (threshold: BALANCE.BOSS_PHASE2_THRESHOLD ± 10% 랜덤)
            if (updatedEnemy.phase2 && !updatedEnemy.phase2Triggered) {
                const baseThreshold = updatedEnemy.phase2.threshold ?? BALANCE.BOSS_PHASE2_THRESHOLD;
                const jitter = (Math.random() - 0.5) * 0.2;
                const threshold = Math.max(0.2, Math.min(0.7, baseThreshold + jitter));
                if (hpRatio <= threshold) {
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
                        const resistRelic2 = relics.find(r => r.effect === 'status_resist');
                        const resistChance2 = resistRelic2 ? (resistRelic2.val || 0) : 0;
                        const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
                        if (!currentStatus.includes(p2.statusEffect) && Math.random() >= resistChance2) {
                            updatedPlayer = { ...updatedPlayer, status: [...currentStatus, p2.statusEffect] };
                            logs.push({ type: 'warning', text: `[Phase 2] [${statusLabels[p2.statusEffect] || p2.statusEffect}] 상태이상 부여!` });
                        } else if (resistRelic2 && Math.random() < resistChance2) {
                            logs.push({ type: 'success', text: `[고대의 봉인] 상태이상을 저항했습니다!` });
                        }
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
        // 시너지: 절대 반사 (absolute_reflect) — 반사율 50%, 스턴 25% 확률
        const absoluteReflectSyn = activeSynergies.find(s => s.bonus.reflect);
        const reflectMult = absoluteReflectSyn ? (absoluteReflectSyn.bonus.reflect || 0.3) : (reflectRelic ? reflectRelic.val : 0);
        const reflectDmg = (reflectRelic || absoluteReflectSyn) ? Math.floor(stats.def * reflectMult) : 0;
        const enemyHpAfterReflect = reflectDmg > 0 ? Math.max(0, updatedEnemy.hp - reflectDmg) : updatedEnemy.hp;
        if (reflectDmg > 0) {
            updatedEnemy = { ...updatedEnemy, hp: enemyHpAfterReflect };
            logs.push({ type: 'event', text: `[반사] 반사 피해 ${reflectDmg}!` });
            // 스턴 확률
            if (absoluteReflectSyn && Math.random() < (absoluteReflectSyn.bonus.stunOnReflect || 0)) {
                updatedEnemy = { ...updatedEnemy, stunnedTurns: Math.max(updatedEnemy.stunnedTurns ?? 0, 1) };
                logs.push({ type: 'event', text: '[절대 반사] 반사 충격으로 적이 기절!' });
            }
        }

        // atkMult: blind / fear / curse에 의한 적 공격력 감소 (#5)
        const enemyAtkMult = updatedEnemy.atkMult ?? 1;
        const rawEnemyAtk = updatedEnemy.atk * mult * enemyAtkMult;
        // 최소 피해량: 원래 공격력의 10% (DEF 스택으로 완전 무효화 방지, 고DEF 빌드 보상)
        const minEnemyDmg = Math.max(1, Math.floor(rawEnemyAtk * 0.10));
        const enemyDmg = Math.max(minEnemyDmg, Math.floor(rawEnemyAtk - stats.def));
        if (enemyAtkMult < 1 && (updatedEnemy.blindTurns > 0 || updatedEnemy.fearTurns > 0 || updatedEnemy.cursedTurns > 0)) {
            const statusName = updatedEnemy.blindTurns > 0 ? '실명' : updatedEnemy.fearTurns > 0 ? '공포' : '저주';
            logs.push({ type: 'info', text: `[${statusName}] ${updatedEnemy.name}의 공격력이 감소합니다!` });
        }

        // 몬스터 공격 시 상태이상 부여 (pattern.statusEffect + pattern.statusChance 지원)
        if (heavy && updatedEnemy.pattern?.statusEffect && Math.random() < (updatedEnemy.pattern.statusChance || 0.25)) {
            const sEff = updatedEnemy.pattern.statusEffect;
            const resistRelic = relics.find(r => r.effect === 'status_resist');
            const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
            const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
            if (!currentStatus.includes(sEff) && Math.random() >= resistChance) {
                const statusLabels = { burn: '화상', poison: '독', freeze: '빙결', curse: '저주', bleed: '출혈' };
                updatedPlayer = { ...updatedPlayer, status: [...currentStatus, sEff] };
                logs.push({ type: 'warning', text: `[${updatedEnemy.name}] [${statusLabels[sEff] || sEff}] 부여!` });
            } else if (resistRelic) {
                logs.push({ type: 'success', text: `[고대의 봉인] 상태이상을 저항했습니다!` });
            }
        }

        const protectedResult = this.applyFatalProtection(updatedPlayer, relics, enemyDmg, logs, activeSynergies);


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
            p.nextExp = Math.min(
                Math.floor(p.nextExp * BALANCE.EXP_SCALE_RATE),
                BALANCE.EXP_LEVEL_HARD_CAP
            );
            p.maxHp += BALANCE.HP_PER_LEVEL;
            p.maxMp += BALANCE.MP_PER_LEVEL;
            p.hp = Math.min(p.hp + BALANCE.HP_PER_LEVEL, p.maxHp);
            p.mp = Math.min(p.mp + BALANCE.MP_PER_LEVEL, p.maxMp);
            p.atk += BALANCE.ATK_PER_LEVEL;
            p.def += BALANCE.DEF_PER_LEVEL;
            levelUps += 1;
            visualEffect = 'levelUp';
            logs.push({ type: 'system', text: MSG.LEVEL_UP(p.level) });

            // 레벨 마일스톤 보상
            const isMajor = p.level % BALANCE.LEVEL_MAJOR_MILESTONE_EVERY === 0;
            const isMinor = !isMajor && p.level % BALANCE.LEVEL_MILESTONE_EVERY === 0;
            if (isMajor) {
                const atkBonus = BALANCE.MILESTONE_STAT_ATK;
                const hpBonus = BALANCE.MILESTONE_STAT_HP;
                const mpBonus = BALANCE.MILESTONE_STAT_MP;
                p.atk += atkBonus;
                p.maxHp += hpBonus;
                p.hp = Math.min(p.hp + hpBonus, p.maxHp);
                p.maxMp += mpBonus;
                p.mp = Math.min(p.mp + mpBonus, p.maxMp);
                logs.push({ type: 'event', text: MSG.LEVEL_MAJOR_MILESTONE(p.level, atkBonus, hpBonus, mpBonus) });
            } else if (isMinor) {
                const goldBonus = p.level * BALANCE.MILESTONE_GOLD_PER_LV;
                p.gold = (p.gold || 0) + goldBonus;
                logs.push({ type: 'event', text: MSG.LEVEL_MILESTONE(p.level, goldBonus) });
            }
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

    handleVictory(player, enemy, passiveBonus = {}) {
        const p = { ...player };
        const relics = p.relics || [];
        const baseName = this.resolveEnemyBaseName(enemy);
        const previousBossClears = p.stats?.killRegistry?.[baseName] || 0;
        const bossBrief = enemy.isBoss ? BOSS_BRIEFS[baseName] : null;

        // 유물 + 패시브 스킬: EXP/골드 배율
        const expMult = 1 + (relics.find(r => r.effect === 'exp_mult')?.val || 0) + (passiveBonus.expMult || 0);
        const goldMult = 1 + (relics.find(r => r.effect === 'gold_mult')?.val || 0) + (passiveBonus.goldMult || 0);
        // 챌린지 모디파이어 보상 스케일링 (3개 이상 → 1.5배)
        const challengeMods = p.challengeModifiers || [];
        const challengeScale = BALANCE.CHALLENGE_REWARD_SCALING || {};
        const challengeRewardMult = challengeMods.length >= (challengeScale.threshold || 3) ? (challengeScale.mult || 1.5) : 1;
        // 유물: 처치 보너스 (kill_bonus)
        const killBonusRelic = relics.find(r => r.effect === 'kill_bonus');
        const killExpMult = killBonusRelic ? (1 + (killBonusRelic.val?.exp || 0)) : 1;
        const killGoldMult = killBonusRelic ? (1 + (killBonusRelic.val?.gold || 0)) : 1;
        // 레벨 차이 골드 스케일링: 플레이어가 몬스터보다 10레벨 이상 높으면 골드 감소 (최소 30%)
        const playerLevel = p.level || 1;
        const enemyLevel = enemy.level || 1;
        const levelGap = Math.max(0, playerLevel - enemyLevel - 9);
        const levelPenalty = Math.max(0.3, 1 - levelGap * 0.07);
        const expGained = Math.floor(enemy.exp * expMult * killExpMult * challengeRewardMult);
        const noGold = p.challengeModifiers?.includes('noGold');
        const goldGained = Math.floor(enemy.gold * goldMult * killGoldMult * levelPenalty * (noGold ? 0.5 : 1) * challengeRewardMult);

        p.gold += goldGained;

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
        let bossClearBonus = null;

        if (enemy.isBoss && previousBossClears === 0) {
            const bonusGold = Math.max(120, Math.floor(goldGained * 0.35));
            p.gold += bonusGold;
            p.stats.total_gold = (p.stats.total_gold || 0) + bonusGold;
            bossClearBonus = {
                goldBonus: bonusGold,
                rewardHint: bossBrief?.rewardHint || '초회 토벌 보너스를 확보했습니다.'
            };
            logs.push({ type: 'event', text: `🏁 초회 보스 토벌 보너스 +${bonusGold}G` });
        }

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
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * healRelic.val);
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[피의 서약] +${heal} HP` });
        }

        // 시너지: 불멸의 전사 (killHeal), 무한 포식 (devour) — 처치 시 HP 회복
        const victorySynergies = getActiveRelicSynergies(relics);
        const killHealSyn = victorySynergies.find(s => s.bonus.killHeal);
        if (killHealSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * killHealSyn.bonus.killHeal);
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[불멸의 전사] +${heal} HP (처치 회복)` });
        }
        const devourSyn = victorySynergies.find(s => s.bonus.devour);
        if (devourSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * devourSyn.bonus.devour);
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[무한 포식] +${heal} HP (포식)` });
        }

        // 유물: 별의 핵 (mp_restore_battle) — 전투 종료 시 MP 전량 회복
        const starCoreRelic = relics.find(r => r.effect === 'mp_restore_battle');
        if (starCoreRelic) {
            p.mp = p.maxMp || 50;
            logs.push({ type: 'heal', text: `[별의 핵] MP 전량 회복!` });
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
            isDemonKingSlain,
            bossClearBonus
        };
    },

    updateQuestProgress(player, enemyName) {
        return syncQuestProgress(player, enemyName, DB.QUESTS);
    },

    processLoot(enemy, player = null) {
        return _processLoot(enemy, player);
    },

    /**
     * 적의 다음 행동을 예측하여 텔레그래프 메시지를 반환합니다.
     * CombatPanel에서 UI 경고 표시에 사용.
     */
    predictEnemyNextAction(enemy) {
        if (!enemy || enemy.hp <= 0) return null;
        if ((enemy.stunnedTurns || 0) > 0) return { type: 'stunned', label: '기절 중 — 행동 불가', color: 'blue' };

        // 보스 Phase 2 전환 임박 체크
        const hpRatio = enemy.hp / Math.max(1, enemy.maxHp || enemy.hp);
        if (enemy.isBoss && !enemy.phase2Triggered && enemy.phase2 && hpRatio <= BALANCE.BOSS_PHASE2_THRESHOLD + 0.1) {
            return { type: 'phase2_imminent', label: `⚡ Phase 2 임박 — ${enemy.phase2?.name || '형태 변환'}`, color: 'purple' };
        }

        const pattern = enemy.taunted
            ? { guardChance: 0, heavyChance: 1.0 }
            : (enemy.pattern || { guardChance: 0.2, heavyChance: 0.2 });

        // 가장 높은 확률 행동을 예측
        if (pattern.guardChance >= 0.5) return { type: 'guard', label: `방어 태세 (${Math.round(pattern.guardChance * 100)}%)`, color: 'blue' };
        if (pattern.heavyChance >= 0.4) return { type: 'heavy', label: `강타 준비 (${Math.round(pattern.heavyChance * 100)}%)`, color: 'red' };
        if (pattern.guardChance >= 0.3) return { type: 'guard', label: `방어 가능 (${Math.round(pattern.guardChance * 100)}%)`, color: 'blue' };
        if (pattern.heavyChance >= 0.25) return { type: 'heavy', label: `강타 가능 (${Math.round(pattern.heavyChance * 100)}%)`, color: 'orange' };
        return { type: 'normal', label: '일반 공격 예상', color: 'gray' };
    },

    handleDefeat(player, INITIAL_PLAYER) {
        const graveData = buildGraveData(player);

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
        starterState.maxHp = (starterState.maxHp || BALANCE.DEFAULT_MAX_HP) + (meta.bonusHp || 0);
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
