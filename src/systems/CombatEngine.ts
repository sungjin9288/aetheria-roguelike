import type { Monster, Player, Relic } from '../types/index.js';
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
    DEFAULT_COMBAT_FLAGS: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false, phoenixUsed: false } as any,

    resolveEnemyBaseName(enemy: Monster) {
        return _resolveEnemyBaseName(enemy);
    },

    getElementMultiplier(elem: any, enemy: Monster, relics: any[] = []) {
        if (!elem || elem === 'physical' || elem === 'none') return 1;
        if (enemy?.weakness && enemy.weakness === elem) {
            // cycle 151: 'elem_boost' (프리즘 핵) — 약점 적중 배율에 val 추가 (1.25 → 1.5).
            const boostRelic = (relics || []).find((r: any) => r.effect === 'elem_boost');
            const boost = typeof boostRelic?.val === 'number' ? boostRelic.val : 0;
            return BALANCE.ELEMENT_WEAK_MULT + boost;
        }
        if (enemy?.resistance && enemy.resistance === elem) return BALANCE.ELEMENT_RESIST_MULT;
        return 1;
    },

    calculateDamage(stats: any, options: any = {}) {
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

    getCombatFlags(player: Player) {
        return { ...this.DEFAULT_COMBAT_FLAGS, ...(player?.combatFlags || {}) };
    },

    getEffectiveMaxMp(player: Player, relics: Relic[] = []) {
        const rmp = 1 + relics.reduce((acc: any, relic: any) => {
            if (relic.effect === 'mp_mult') return acc + relic.val;
            if (relic.effect === 'omega') return acc + relic.val;
            return acc;
        }, 0);
        return Math.floor((player?.maxMp || 50) * rmp);
    },

    applyCritMpRestore(player: Player, relics: Relic[] = [], logs: any[] = []) {
        const critMpRelic = relics.find((relic: any) => relic.effect === 'crit_mp_regen');
        if (!critMpRelic) return player;

        const nextMp = Math.min(this.getEffectiveMaxMp(player, relics), (player.mp || 0) + critMpRelic.val);
        if (nextMp > (player.mp || 0)) {
            logs.push({ type: 'event', text: `[피의 갈증] +${nextMp - (player.mp || 0)} MP` });
        }
        return { ...player, mp: nextMp };
    },

    applyFatalProtection(player: Player, relics: Relic[] = [], incomingDamage = 0, logs: any[] = [], activeSynergies: any[] = []) {
        const flags = this.getCombatFlags(player);
        let nextHp = Math.max(0, (player.hp || 0) - Math.max(0, incomingDamage));
        // cycle 162: phoenix_revive atkBuff tempBuff — 부활 분기에서 set, return에 합류.
        let phoenixTempBuff: any = null;

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic: any) => relic.effect === 'death_save');
            // cycle 153: 시너지 'absolute_immortal' — reviveCount 2회 부활. effect-name primary + bonus-key fallback.
            const absoluteImmortalSyn = activeSynergies.find((s: any) =>
                s.bonus.effect === 'absolute_immortal' || s.bonus.reviveCount);
            const maxRevives = absoluteImmortalSyn ? (absoluteImmortalSyn.bonus.reviveCount || 1) : 1;
            const reviveUsedCount = flags.deathSaveUsedCount || 0;

            if (deathSaveRelic && reviveUsedCount < maxRevives) {
                // cycle 153: 시너지 'absolute_immortal' / 'immortal_warrior' / 'blood_immortal' — reviveHeal 부활 시 HP 회복량 증가.
                const reviveHealSyn = activeSynergies.find((s: any) =>
                    s.bonus.effect === 'absolute_immortal'
                    || s.bonus.effect === 'immortal_warrior'
                    || s.bonus.effect === 'blood_immortal'
                    || s.bonus.reviveHeal);
                nextHp = reviveHealSyn
                    ? Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * reviveHealSyn.bonus.reviveHeal)
                    : 1;
                flags.deathSaveUsed = true;
                flags.deathSaveUsedCount = reviveUsedCount + 1;
                // cycle 153: 시너지 'unbreakable' — healOnSave 부활 시 추가 HP 회복.
                const healOnSaveSyn = activeSynergies.find((s: any) =>
                    s.bonus.effect === 'unbreakable' || s.bonus.healOnSave);
                if (healOnSaveSyn) {
                    const bonus = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * healOnSaveSyn.bonus.healOnSave);
                    nextHp = Math.min(player.maxHp || BALANCE.DEFAULT_MAX_HP, nextHp + bonus);
                    logs.push({ type: 'heal', text: `[난공불락] 부활 시 +${bonus} HP 회복!` });
                }
                const reviveMsg = reviveUsedCount > 0 ? `[절대 불사] ${reviveUsedCount + 1}회 부활!` : '[불사의 의지] 치명상을 버텼습니다!';
                logs.push({ type: 'event', text: reviveMsg });
            } else {
                const voidHeartRelic = relics.find((relic: any) => relic.effect === 'void_heart');
                if (voidHeartRelic && !flags.voidHeartUsed) {
                    nextHp = 1;
                    flags.voidHeartUsed = true;
                    flags.voidHeartArmed = true;
                    logs.push({ type: 'event', text: '[허공의 심장] 죽음을 거부했습니다. 다음 공격이 강화됩니다!' });
                } else {
                    // cycle 186: 'reviveTokens' (PremiumShop revive) — HP 0 도달 시 token 1개 소비해 즉시 부활.
                    //   spec: 'HP/MP 50% 회복 후 즉시 부활'. token 음수 가드.
                    //   기존엔 token 구매되지만 소비 로직 없어 dead purchase 회귀.
                    const reviveTokens = Math.max(0, Number((player as any).reviveTokens) || 0);
                    if (reviveTokens > 0) {
                        nextHp = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * 0.5);
                        // reviveTokens 소비는 updatedPlayer 합류 시점에 처리 (return 직전).
                        flags.reviveTokenUsed = true;
                        logs.push({ type: 'event', text: `[즉시 부활] 프리미엄 부활권 사용 — HP/MP 50% 회복!` });
                    } else {
                    // cycle 157: 'phoenix_revive' (불사조의 깃털) — HP 0 도달 시 1회 부활 (HP healRatio% 회복).
                    // cycle 162: atkBuff/duration tempBuff 적용 추가 — 부활 직후 N턴 동안 ATK 증폭.
                    const phoenixRelic = relics.find((relic: any) => relic.effect === 'phoenix_revive');
                    if (phoenixRelic && !flags.phoenixUsed) {
                        const healRatio = phoenixRelic.val?.healRatio || 0.3;
                        nextHp = Math.max(1, Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * healRatio));
                        flags.phoenixUsed = true;
                        const atkBuff = phoenixRelic.val?.atkBuff || 0;
                        const duration = phoenixRelic.val?.duration || 0;
                        if (atkBuff > 0 && duration > 0) {
                            phoenixTempBuff = {
                                atk: atkBuff,
                                def: 0,
                                turn: duration,
                                name: 'phoenix_revive',
                            };
                        }
                        logs.push({ type: 'event', text: `[불사조의 깃털] 재의 잿더미에서 부활! +${nextHp} HP, ATK +${Math.round(atkBuff * 100)}% (${duration}턴)` });
                    }
                    } // close cycle 186 else (token-not-used path)
                }
            }
        }

        const updatedPlayer: any = { ...player, hp: nextHp, combatFlags: flags };
        if (phoenixTempBuff) updatedPlayer.tempBuff = phoenixTempBuff;
        // cycle 186: reviveTokens 소비 + MP 50% 회복 (token 사용 시).
        if (flags.reviveTokenUsed) {
            updatedPlayer.reviveTokens = Math.max(0, Number((player as any).reviveTokens) || 0) - 1;
            updatedPlayer.mp = Math.min(player.maxMp || 50, Math.floor((player.maxMp || 50) * 0.5));
        }
        return {
            updatedPlayer,
            isDead: nextHp <= 0
        };
    },

    // ── 스킬 효과 → 적 상태 적용 (#5) ─────────────────────────────────────
    /**
     * 스킬 effect 값을 적 오브젝트에 상태이상으로 적용합니다.
     * blind / fear / curse / taunt / stun / freeze / poison / burn / bleed 처리.
     */
    /**
     * cycle 159: entropy tick — 'entropy_tick' 유물 (entropy_engine) +
     *   'entropy_brand' 시너지의 매 N턴 고정 피해를 적에게 적용.
     *
     * 시너지 동시 보유 시 시너지 파라미터(damage 0.12 / interval 2)가 우선
     * — 시너지가 유물을 강화하는 사양.
     *
     * @returns { player, enemy, logs } — turnCount 증가 + (조건 시) 적 hp 차감.
     */
    applyEntropyTick(player: Player, enemy: Monster, activeSynergies: any[] = []) {
        const relics = (player as any)?.relics || [];
        const flags: any = { ...((player as any).combatFlags || {}) };
        const turnCount = (flags.turnCount || 0) + 1;
        flags.turnCount = turnCount;

        const updatedPlayer: any = { ...player, combatFlags: flags };
        let updatedEnemy: any = enemy;
        const logs: any[] = [];

        const tickRelic = relics.find((r: any) => r.effect === 'entropy_tick');
        const brandSyn = activeSynergies.find((s: any) =>
            s.bonus.effect === 'entropy_brand' || (s.bonus.damage && s.bonus.interval));
        if (!tickRelic && !brandSyn) {
            return { player: updatedPlayer, enemy: updatedEnemy, logs };
        }

        // 시너지 우선 (브랜드 강화 사양). 누락 키는 유물에서 fallback.
        const damage = brandSyn?.bonus.damage ?? tickRelic?.val?.damage ?? 0;
        const interval = brandSyn?.bonus.interval ?? tickRelic?.val?.interval ?? 0;
        const label = brandSyn ? '엔트로피 낙인' : '엔트로피 엔진';

        if (interval > 0 && damage > 0 && turnCount % interval === 0 && (enemy.hp ?? 0) > 0) {
            const fixedDmg = Math.max(1, Math.floor((enemy.maxHp || enemy.hp || 1) * damage));
            updatedEnemy = { ...enemy, hp: Math.max(0, (enemy.hp ?? 0) - fixedDmg) };
            logs.push({ type: 'event', text: `[${label}] 시간 무게 — ${enemy.name} 고정 피해 ${fixedDmg}!` });
        }

        return { player: updatedPlayer, enemy: updatedEnemy, logs };
    },

    applyStatusEffectToEnemy(enemy: Monster, effect: any) {
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
    tickEnemyStatus(enemy: Monster, logs: any[] = [], curseAmpMult = 1, synergyDotMult = 1) {
        let updated = { ...enemy };

        // DoT (burn / poison / bleed) — 시너지 죽음의 예언자 dotMult 반영
        (updated.dots || []).forEach((dot: any) => {
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

    tickCombatState(player: Player) {
        const logs: any[] = [];
        const updated: any = { ...player };
        const relics = updated.relics || [];
        const loadout = updated.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const nextCooldowns: Record<string, number> = { ...(loadout.cooldowns || {}) };

        Object.keys(nextCooldowns).forEach((key: any) => {
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

        // === 상태이상 DoT 처리 (poison / burn / bleed) ===
        // cycle 106: bleed 누락 회귀 fix — 보스 phase 2/3가 statusEffect: 'bleed'를
        // player에 부여할 수 있는데 player DoT 분기에 bleed가 빠져있어 표시만 되고
        // 실제 피해 0이었음 (적 enemy.dots 분기는 bleed 포함 정상 동작 — 비대칭 회귀).
        const DOT_STATUSES = ['poison', 'burn', 'bleed'];
        updated.status.filter((s: any) => DOT_STATUSES.includes(s)).forEach((s: any) => {
            const dmg = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * BALANCE.STATUS_DOT_RATIO));
            updated.hp = Math.max(1, (updated.hp ?? 1) - dmg);
            logs.push({ type: 'warning', text: MSG.STATUS_DOT(s, dmg) });
        });

        const mpRegenRelic = relics.find((relic: any) => relic.effect === 'mp_regen_turn');
        if (mpRegenRelic) {
            const nextMp = Math.min(this.getEffectiveMaxMp(updated, relics), (updated.mp || 0) + mpRegenRelic.val);
            if (nextMp > (updated.mp || 0)) {
                updated.mp = nextMp;
                logs.push({ type: 'event', text: `[비전 서지] +${mpRegenRelic.val} MP` });
            }
        }

        // 유물: 대지의 심장 (regen) — 매 턴 최대 HP의 5% 회복
        const regenRelic = relics.find((relic: any) => relic.effect === 'regen');
        if (regenRelic && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * (regenRelic.val || 0.05)));
            updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[대지의 심장] +${heal} HP 재생` });
        }

        // 시너지: 영원의 생명 (healPerTurn) — 매 턴 4% HP 재생
        const healPerTurnSyn = getActiveRelicSynergies(relics).find((s: any) => s.bonus.healPerTurn);
        if (healPerTurnSyn && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * (healPerTurnSyn.bonus.healPerTurn ?? 0)));
            updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[영원의 생명] +${heal} HP 재생` });
        }

        // cycle 161: 'genesis' 유물 (창세의 핵) — val.healPerTurn 0.02 매 턴 HP 회복.
        //   cycle 149에서 statBonus만 적용했고 healPerTurn은 별도 사이클로 미뤘던 잔존.
        const genesisRelic = relics.find((r: any) => r.effect === 'genesis');
        if (genesisRelic && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const ratio = genesisRelic.val?.healPerTurn || 0;
            if (ratio > 0) {
                const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * ratio));
                updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
                logs.push({ type: 'heal', text: `[창세의 핵] +${heal} HP 재생` });
            }
        }

        // cycle 161: 시너지 'eternal_fortress' (regenPerTurn 0.08) — 매 턴 8% HP 재생.
        //   cycle 154에서 defMult만 적용했고 regenPerTurn은 별도 사이클로 미뤘던 잔존.
        const fortressRegenSyn = getActiveRelicSynergies(relics).find((s: any) =>
            s.bonus.effect === 'eternal_fortress' || s.bonus.regenPerTurn);
        if (fortressRegenSyn && (updated.hp || 0) < (updated.maxHp || BALANCE.DEFAULT_MAX_HP)) {
            const ratio = fortressRegenSyn.bonus.regenPerTurn || 0;
            if (ratio > 0) {
                const heal = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * ratio));
                updated.hp = Math.min(updated.maxHp || BALANCE.DEFAULT_MAX_HP, (updated.hp || 1) + heal);
                logs.push({ type: 'heal', text: `[영원의 요새] +${heal} HP 재생` });
            }
        }

        // cycle 161: 'hp_drain_atk' 유물 (혈맹의 반지 / 심연의 계약) — val.hpCost 매 턴 HP 소모.
        //   cycle 150에서 atkBonus만 적용했고 hpCost는 별도 사이클로 미뤘던 잔존.
        //   hell_reaper 시너지 보유 시 hpCostReduction으로 부담 경감 (cycle 156 시너지 정합).
        const drainRelic = relics.find((r: any) => r.effect === 'hp_drain_atk');
        if (drainRelic && (updated.hp || 0) > 1) {
            let cost = (drainRelic.val?.hpCost || 0);
            const hellReaperSynRegen = getActiveRelicSynergies(relics).find((s: any) =>
                s.bonus.effect === 'hell_reaper' || s.bonus.hpCostReduction);
            if (hellReaperSynRegen) {
                const reducedCost = hellReaperSynRegen.bonus.hpCostReduction;
                if (typeof reducedCost === 'number' && reducedCost >= 0 && reducedCost < cost) {
                    cost = reducedCost; // hell_reaper가 cost를 0.02로 직접 대체
                }
            }
            if (cost > 0) {
                const dmg = Math.max(1, Math.floor((updated.maxHp || BALANCE.DEFAULT_MAX_HP) * cost));
                updated.hp = Math.max(1, (updated.hp || 1) - dmg);
                const label = hellReaperSynRegen ? '지옥의 수확자' : '혈맹의 반지';
                logs.push({ type: 'warning', text: `[${label}] HP 대가 -${dmg}` });
            }
        }

        // 유물: 시간의 파편 (cd_minus) — 매 턴 모든 스킬 쿨타임 추가 -1
        const cdMinusRelic = relics.find((relic: any) => relic.effect === 'cd_minus');
        if (cdMinusRelic) {
            const cds = { ...(updated.skillLoadout?.cooldowns || {}) };
            let reduced = false;
            Object.keys(cds).forEach((k: any) => { if (cds[k] > 0) { cds[k] = Math.max(0, cds[k] - 1); reduced = true; } });
            if (reduced) updated.skillLoadout = { ...(updated.skillLoadout || {}), cooldowns: cds };
        }

        return { updatedPlayer: updated, logs };
    },

    attack(player: Player, enemy: Monster, stats: any) {
        // cycle 107: freeze/stun 상태이상 턴 스킵 — 보스 phase 2/3가 부여하는
        // freeze/stun이 player 쪽에서 처리되지 않아 정상 공격되던 회귀 fix.
        // 적의 stunnedTurns 처리와 짝을 이룸 (one-turn effect — status 제거 후 진행).
        const incomingStatus = Array.isArray(player.status) ? player.status : [];
        const blockingStatus = incomingStatus.find((s: any) => s === 'freeze' || s === 'stun');
        if (blockingStatus) {
            const newStatus = incomingStatus.filter((s: any) => s !== blockingStatus);
            return {
                updatedPlayer: { ...player, status: newStatus },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.PLAYER_STATUS_SKIP(blockingStatus) }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 109: blind 상태이상 — 매 공격마다 BLIND_PLAYER_MISS_CHANCE roll.
        // freeze/stun(1턴 effect)과 달리 status 유지 — 저주해제/purify/휴식까지 지속.
        if (incomingStatus.includes('blind') && Math.random() < (BALANCE.BLIND_PLAYER_MISS_CHANCE || 0.30)) {
            return {
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: '[실명] 공격이 빗나갔습니다!' }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 110: fear 상태이상 — flinch 확률(FEAR_PLAYER_FLINCH_CHANCE).
        // blind와 같은 모델이지만 의미는 "두려움에 움츠림"으로 차별화. status 유지.
        if (incomingStatus.includes('fear') && Math.random() < (BALANCE.FEAR_PLAYER_FLINCH_CHANCE || 0.25)) {
            return {
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: '[공포] 두려움에 움츠립니다!' }],
                isCrit: false,
                isVictory: false,
            };
        }

        const relics = stats.relics || [];
        const elementMultiplier = this.getElementMultiplier(stats.elem, enemy, relics);
        const logs: any[] = [];
        let updatedPlayer: any = { ...player, combatFlags: this.getCombatFlags(player) };
        const flags = this.getCombatFlags(player);

        // 유물: 방어 무시 (armor_pen)
        const apRelic = relics.find((r: any) => r.effect === 'armor_pen');
        const effectiveDef = apRelic ? Math.floor((stats.def || 0) * (1 - apRelic.val)) : (stats.def || 0);
        const statsForAtk = apRelic ? { ...stats, def: effectiveDef } : stats;

        const { damage: rawBaseDmg, isCrit } = this.calculateDamage(statsForAtk, {
            mult: 1,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelic = relics.find((r: any) => r.effect === 'crit_dmg');
        // cycle 154: 시너지 'void_dragon' / 'primordial_wrath' — bonus.critDmg 곱셈 추가.
        const critDmgSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'void_dragon' || s.bonus.effect === 'primordial_wrath' || s.bonus.critDmg);
        const critDmgMult = (critDmgRelic?.val || 1) * (isCrit && critDmgSyn ? (critDmgSyn.bonus.critDmg || 1) : 1);
        const baseDmg = (isCrit && (critDmgRelic || critDmgSyn)) ? Math.floor(rawBaseDmg * critDmgMult) : rawBaseDmg;

        // 유물: 연격 (double_strike) — 두 번째 타격 추가
        const dsRelic = relics.find((r: any) => r.effect === 'double_strike');
        const secondHit = dsRelic ? Math.floor(baseDmg * dsRelic.val) : 0;
        const damage = baseDmg + secondHit;

        // 유물: 처형자의 날 (execute_bonus) — 적 HP 25% 미만 시 추가 피해.
        const exRelic = relics.find((r: any) => r.effect === 'execute_bonus');
        // cycle 156: 시너지 'annihilator' (executeThreshold 0.35) — 처형 임계치 상향. 유물의 threshold와 max 합산.
        const annihilatorSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'annihilator' || s.bonus.executeThreshold);
        const exThreshold = Math.max(exRelic?.val?.threshold || 0, annihilatorSyn?.bonus.executeThreshold || 0);
        const executeTriggered = Boolean((exRelic || annihilatorSyn) && (enemy.hp ?? 0) / (enemy.maxHp || 1) < exThreshold);
        const exMult = exRelic?.val?.mult || 0;
        let finalDamage = executeTriggered
            ? Math.floor(damage * (1 + exMult))
            : damage;

        const comboRelic = relics.find((relic: any) => relic.effect === 'combo_stack');
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

        const voidHeartRelic = relics.find((relic: any) => relic.effect === 'void_heart');
        let voidHeartTriggered = false;
        if (voidHeartRelic && flags.voidHeartArmed) {
            finalDamage = Math.floor(finalDamage * voidHeartRelic.val.dmg_mult);
            flags.voidHeartArmed = false;
            voidHeartTriggered = true;
        }

        // 유물: 예언의 돌판 (execute_atk) — 보스 HP 25% 이하 시 ATK 2배
        const executeAtkRelic = relics.find((r: any) => r.effect === 'execute_atk');
        let executeAtkTriggered = false;
        if (executeAtkRelic && enemy.isBoss && (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || 1) < (executeAtkRelic.threshold || 0.25)) {
            finalDamage = Math.floor(finalDamage * (executeAtkRelic.val || 2.0));
            executeAtkTriggered = true;
        }

        // 유물: 공허의 메아리 (echo_atk) — 스킬 사용 후 다음 일반 공격 피해 강화
        const echoAtkRelic = relics.find((r: any) => r.effect === 'echo_atk');
        let echoTriggered = false;
        if (echoAtkRelic && flags.echoArmed) {
            finalDamage = Math.floor(finalDamage * (echoAtkRelic.val || 1.8));
            flags.echoArmed = false;
            echoTriggered = true;
        }

        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelic = relics.find((r: any) => r.effect === 'low_hp_dmg');
        if (lowHpDmgRelic) {
            const hpRatio = (player.hp ?? 0) / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP);
            if (hpRatio < (lowHpDmgRelic.threshold || 0.4)) {
                finalDamage = Math.floor(finalDamage * (lowHpDmgRelic.val || 1.4));
            }
        }

        const newEnemyHp = (enemy.hp ?? 0) - finalDamage;
        const tags: any[] = [];
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

        // cycle 153: 시너지 'vampire_lord' — lifeSteal 일반 공격 흡혈.
        const vampireSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'vampire_lord' || s.bonus.lifeSteal);
        // cycle 156: 시너지 'hell_reaper' — lifeStealBonus 0.5 추가 흡혈 (vampire_lord와 합산).
        const hellReaperSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'hell_reaper' || s.bonus.lifeStealBonus);
        const totalLifeSteal = (vampireSyn?.bonus.lifeSteal || 0) + (hellReaperSyn?.bonus.lifeStealBonus || 0);
        if (totalLifeSteal > 0) {
            const steal = Math.floor(finalDamage * totalLifeSteal);
            if (steal > 0) {
                updatedPlayer = { ...updatedPlayer, hp: Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + steal) };
                const label = hellReaperSyn ? '지옥의 수확자' : '흡혈 군주';
                logs.push({ type: 'heal', text: `[${label}] +${steal} HP 흡혈!` });
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

        // cycle 152: 'on_hit_freeze' (frost_anchor) — val 확률로 적 1턴 빙결.
        let postHitEnemy: any = { ...enemy, hp: newEnemyHp, guarding: false };
        const freezeRelic = relics.find((r: any) => r.effect === 'on_hit_freeze');
        if (freezeRelic && newEnemyHp > 0 && Math.random() < (freezeRelic.val || 0)) {
            postHitEnemy = this.applyStatusEffectToEnemy(postHitEnemy, 'freeze');
            logs.push({ type: 'event', text: `[동결의 닻] ${enemy.name} 빙결!` });
        }

        // cycle 159: entropy_tick / entropy_brand — 매 N턴 적 maxHp 비율 고정 피해.
        const entropyResult = this.applyEntropyTick(updatedPlayer, postHitEnemy, stats.activeSynergies || []);
        updatedPlayer = entropyResult.player;
        postHitEnemy = entropyResult.enemy;
        entropyResult.logs.forEach((l: any) => logs.push(l));

        return {
            updatedPlayer,
            updatedEnemy: postHitEnemy,
            logs,
            isCrit,
            isVictory: (postHitEnemy.hp ?? 0) <= 0
        };
    },

    performSkill(player: Player, enemy: Monster, stats: any, skill: any) {
        if (!skill) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NONE }] };
        }

        // cycle 107: freeze/stun 상태이상 턴 스킵 — attack()와 동일 처리.
        // 스킬 발동 자체가 막히고 MP는 소비되지 않음.
        const incomingStatusSkill = Array.isArray(player.status) ? player.status : [];
        const blockingStatusSkill = incomingStatusSkill.find((s: any) => s === 'freeze' || s === 'stun');
        if (blockingStatusSkill) {
            const newStatus = incomingStatusSkill.filter((s: any) => s !== blockingStatusSkill);
            return {
                success: true,
                updatedPlayer: { ...player, status: newStatus },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.PLAYER_STATUS_SKIP(blockingStatusSkill) }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 109: blind miss — attack()와 동일. miss 시 MP 소비 안 됨, status 유지.
        if (incomingStatusSkill.includes('blind') && Math.random() < (BALANCE.BLIND_PLAYER_MISS_CHANCE || 0.30)) {
            return {
                success: true,
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: '[실명] 스킬이 빗나갔습니다!' }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 110: fear flinch — attack()와 동일. flinch 시 MP 소비 안 됨, status 유지.
        if (incomingStatusSkill.includes('fear') && Math.random() < (BALANCE.FEAR_PLAYER_FLINCH_CHANCE || 0.25)) {
            return {
                success: true,
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: '[공포] 두려움에 움츠립니다!' }],
                isCrit: false,
                isVictory: false,
            };
        }

        // 스킬 분기 선택 적용
        const skillChoiceKey = player.skillChoices?.[skill.name];
        if (skillChoiceKey) {
            const classData = CLASSES[player.job as string];
            const branches = classData?.skillBranches?.[skill.name];
            if (branches) {
                const branch = branches.find((b: any) => b.choice === skillChoiceKey);
                if (branch?.override) {
                    skill = { ...skill, ...branch.override };
                }
            }
        }

        const relics = stats.relics || [];
        const mpCost = skill.mp || BALANCE.SKILL_MP_COST;
        const loadout = player.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const cooldowns: Record<string, number> = { ...(loadout.cooldowns || {}) };
        const cooldown = cooldowns[skill.name] || 0;

        // escape_100: 즉시 100% 전투 이탈 (무당 공허의 문 / 시간술사 순간 이동)
        if (skill.effect === 'escape_100') {
            if ((player.mp ?? 0) < mpCost) {
                return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
            }
            const updatedPlayer = { ...player, mp: (player.mp ?? 0) - mpCost };
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
        if ((player.mp ?? 0) < mpCost) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
        }

        // 유물: 주문 메아리 (free_skill) — 15% 확률 MP 무료.
        const freeSkillRelic = relics.find((r: any) => r.effect === 'free_skill');
        // cycle 155: 시너지 'arcane_singularity' — bonus.freeSkillChance 35% 추가. 유물과 합산.
        const arcaneSingSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'arcane_singularity' || s.bonus.freeSkillChance);
        const freeChance = (freeSkillRelic?.val || 0) + (arcaneSingSyn?.bonus.freeSkillChance || 0);
        // cycle 163: 'cooldown_reduce' (시간 군주의 왕관) — val.firstFree=true면 전투 첫 스킬 MP 무소비.
        //   cycle 151에서 cdReduction만 적용 → firstFree 보조 메커니즘 추가.
        const playerFlags: any = (player as any).combatFlags || {};
        const cdRelicForFree = relics.find((r: any) => r.effect === 'cooldown_reduce');
        const firstFreeAvailable = cdRelicForFree?.val?.firstFree && !playerFlags.firstSkillUsed;
        const actualMpCost = firstFreeAvailable
            ? 0
            : (freeChance > 0 && Math.random() < freeChance) ? 0 : mpCost;

        const skillElem = skill.type || stats.elem;
        const elementMultiplier = this.getElementMultiplier(skillElem, enemy, relics);
        // cycle 155: 시너지 'arcane_singularity' — bonus.skillMult 0.3 스킬 피해 +30% (mult 합산).
        const skillMultSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'arcane_singularity' || s.bonus.skillMult);
        const skillMultBonus = skillMultSyn?.bonus.skillMult || 0;
        const { damage: rawSkillDmg, isCrit } = this.calculateDamage(stats, {
            mult: (skill.mult || 1.5) + skillMultBonus,
            guarding: !!enemy.guarding,
            elementMultiplier
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelicSkill = relics.find((r: any) => r.effect === 'crit_dmg');
        // cycle 154: 시너지 'void_dragon' / 'primordial_wrath' — 스킬 크리에도 bonus.critDmg 곱셈 적용.
        const critDmgSynSkill = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'void_dragon' || s.bonus.effect === 'primordial_wrath' || s.bonus.critDmg);
        const skillCritMult = (critDmgRelicSkill?.val || 1) * (isCrit && critDmgSynSkill ? (critDmgSynSkill.bonus.critDmg || 1) : 1);
        const damage = (isCrit && (critDmgRelicSkill || critDmgSynSkill)) ? Math.floor(rawSkillDmg * skillCritMult) : rawSkillDmg;

        const dotRelic = relics.find((relic: any) => relic.effect === 'dot_mult');
        const dotMult = dotRelic ? dotRelic.val : 1;
        const extraDamage = ['burn', 'poison', 'bleed'].includes(skill.effect)
            ? Math.floor(damage * 0.2 * dotMult)
            : 0;

        // 유물: 정신 연소 (skill_mult) — 스킬 피해 70% 증가
        const smRelic = relics.find((r: any) => r.effect === 'skill_mult');
        const smMult = smRelic ? (1 + smRelic.val) : 1;
        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelicSkill = relics.find((r: any) => r.effect === 'low_hp_dmg');
        const lowHpMultSkill = (lowHpDmgRelicSkill && (player.hp ?? 0) / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP) < (lowHpDmgRelicSkill.threshold || 0.4))
            ? (lowHpDmgRelicSkill.val || 1.4) : 1;
        const totalDamage = Math.floor((damage + extraDamage) * smMult * lowHpMultSkill);
        const newEnemyHp = (enemy.hp ?? 0) - totalDamage;

        // logs 선언을 status effect 검사 이전으로 이동 (use-before-declaration 버그 수정).
        const logs: Array<{ type: string; text: string }> = [{
            type: isCrit ? 'critical' : 'combat',
            text: MSG.SKILL_USE(skill.name, totalDamage, enemy.name, Math.max(0, newEnemyHp), enemy.maxHp)
        }];

        // 적에게 상태이상 부여 (#5)
        // stun/freeze/poison/burn/bleed/blind/fear/curse/taunt 통합 처리
        const STATUS_EFFECTS_TO_ENEMY = ['stun', 'freeze', 'poison', 'burn', 'bleed', 'blind', 'fear', 'curse', 'taunt'];
        let postEffectEnemy: Monster = { ...enemy, hp: newEnemyHp, guarding: false };
        const effectLabels: Record<string, string> = { stun: '기절', freeze: '빙결', poison: '독', burn: '화상', bleed: '출혈', blind: '실명', fear: '공포', curse: '저주', taunt: '도발' };
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

        const updatedPlayer: Record<string, any> = {
            ...player,
            mp: (player.mp ?? 0) - actualMpCost,
            skillLoadout: { selected: loadout.selected || 0, cooldowns: { ...cooldowns } },
            combatFlags: {
                ...this.getCombatFlags(player),
                comboCount: 0,
                // cycle 163: cooldown_reduce.firstFree — 첫 스킬 사용 후 플래그 set.
                firstSkillUsed: true,
            }
        };
        // cycle 151: 'cooldown_reduce' (시간 군주의 왕관) — 스킬 사용 시 초기 쿨다운 -val.cdReduction. firstFree는 별도 사이클.
        const cdRelic = relics.find((r: any) => r.effect === 'cooldown_reduce');
        // cycle 155: 시너지 'time_dominator' — bonus.cdReduction 2 추가. 유물과 합산.
        const timeDomSyn = (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'time_dominator' || s.bonus.cdReduction);
        const cdReduction = (cdRelic?.val?.cdReduction || 0) + (timeDomSyn?.bonus.cdReduction || 0);
        const baseCd = skill.cooldown || Math.max(1, Math.ceil(mpCost / 15));
        updatedPlayer.skillLoadout.cooldowns[skill.name] = Math.max(0, baseCd - cdReduction);

        // 유물: 영혼 흡수 (skill_lifesteal) — 스킬 피해의 10% HP 흡수
        const slRelic = relics.find((r: any) => r.effect === 'skill_lifesteal');
        if (slRelic) {
            const heal = Math.floor(totalDamage * slRelic.val);
            updatedPlayer.hp = Math.min(updatedPlayer.maxHp || player.maxHp, (updatedPlayer.hp || player.hp) + heal);
        }
        if (isCrit) {
            const critLogs: any[] = [];
            const restoredPlayer = this.applyCritMpRestore(updatedPlayer, relics, critLogs);
            updatedPlayer.mp = restoredPlayer.mp;
            critLogs.forEach((entry: any) => logs.push(entry));
        }

        if (skill.type === 'buff' || ['atk_up', 'def_up', 'all_up', 'berserk', 'counter'].includes(skill.effect)) {
            const buff: any = { atk: 0, def: 0, turn: skill.turn || 3, name: skill.name };
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
            // cycle 172: 'counter' (반격 자세) — 피격 시 반격 확률. val(=1.4)을 chance 보정으로 해석:
            //   counterChance = val - 1 (예: 1.4 → 40%). counter damage = stats.atk (1배 반격 추가타).
            if (skill.effect === 'counter') {
                buff.counterChance = Math.max(0.2, (skill.val || 1.4) - 1);
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

        // cycle 153: 시너지 'time_master' (extraTurnChance 0.1) / cycle 155: 'time_dominator' (extraAction 0.3) —
        //   스킬 사용 후 확률로 추가 행동. 두 시너지 동시 보유 시 더 높은 확률 채택.
        const timeMasterSyn = relics && (stats.activeSynergies || []).find((s: any) =>
            s.bonus.effect === 'time_master' || s.bonus.effect === 'time_dominator'
            || s.bonus.extraTurnChance || s.bonus.extraAction);
        const extraChance = (timeMasterSyn?.bonus.extraTurnChance || timeMasterSyn?.bonus.extraAction || 0);
        if (timeMasterSyn && !updatedPlayer.extraTurnGranted && Math.random() < extraChance) {
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
        const echoRelicInSkill = relics.find((r: any) => r.effect === 'echo_atk');
        if (echoRelicInSkill) {
            updatedPlayer.combatFlags = { ...this.getCombatFlags(updatedPlayer), echoArmed: true };
            logs.push({ type: 'event', text: `[공허의 메아리] 다음 공격이 강화됩니다!` });
        }

        // crit_cooldown: 크리티컬 시 모든 쿨타임 -1 (Sprint 16 — 인과율 조작)
        if (skill.effect === 'crit_cooldown' && isCrit) {
            const cdLoadout = updatedPlayer.skillLoadout || { selected: 0, cooldowns: {} };
            const reducedCds: Record<string, number> = {};
            Object.entries(cdLoadout.cooldowns || {}).forEach(([k, v]: any) => {
                const cd = Number(v);
                if (cd > 0) reducedCds[k] = cd - 1;
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
        if (actualMpCost === 0 && firstFreeAvailable) logs.push({ type: 'event', text: `[시간 군주의 왕관] 첫 스킬 MP 무소비!` });
        else if (actualMpCost === 0 && freeSkillRelic) logs.push({ type: 'event', text: `[주문 메아리] MP 소모 없음!` });
        if (slRelic) {
            const healAmt = Math.floor(totalDamage * slRelic.val);
            if (healAmt > 0) logs.push({ type: 'heal', text: `[영혼 흡수] +${healAmt} HP` });
        }
        if (smRelic && smRelic.val > 0) logs.push({ type: 'event', text: `[정신 연소] 스킬 피해 강화!` });
        if (dotRelic && extraDamage > 0) logs.push({ type: 'event', text: '[죽음의 낙인] 지속 피해가 증폭됩니다!' });

        // cycle 159: entropy_tick / entropy_brand — 매 N턴 적 maxHp 비율 고정 피해 (스킬 사용 턴에도 적용).
        const entropyResult = this.applyEntropyTick(updatedPlayer, updatedEnemy, stats.activeSynergies || []);
        const finalPlayer = entropyResult.player;
        const finalEnemy = entropyResult.enemy;
        entropyResult.logs.forEach((l: any) => logs.push(l));

        return {
            success: true,
            updatedPlayer: finalPlayer,
            updatedEnemy: finalEnemy,
            logs,
            isCrit,
            isVictory: (finalEnemy.hp ?? 0) <= 0
        };
    },

    enemyAttack(player: Player, enemy: Monster, stats: any) {
        let updatedEnemy = { ...enemy };
        let updatedPlayer: any = { ...player };
        const logs: any[] = [];
        // relics 선언을 함수 상단으로 (Phase 전환 블록에서 use-before-declaration 방지).
        const relics = stats.relics || [];

        // ── 적 상태이상 틱 처리 (#5) ──────────────────────────────────────
        // curse_amp 패시브: 무당/시간술사 직업 보너스
        const curseAmpPassive = CLASSES[player.job as string]?.skills?.find((s: any) => s.passive && s.effect === 'curse_amp');
        const curseAmpMult = curseAmpPassive ? (curseAmpPassive.val || 1) : 1;
        // cycle 153: 시너지 'death_oracle' — dotMult DoT 피해 증폭.
        const activeSynergies = stats.activeSynergies || [];
        const synergyDotMult = activeSynergies.reduce((acc: any, syn: any) =>
            (syn.bonus.effect === 'death_oracle' ? acc + (syn.bonus.dotMult || 0)
                : syn.bonus.dotMult ? acc + syn.bonus.dotMult
                : acc),
            1);
        const enemyTickResult = this.tickEnemyStatus(updatedEnemy, [], curseAmpMult, synergyDotMult);
        updatedEnemy = enemyTickResult.updatedEnemy;
        enemyTickResult.logs.forEach((l: any) => logs.push(l));
        // DoT로 인해 이미 사망한 경우
        if ((updatedEnemy.hp ?? 0) <= 0) {
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
            const hpRatio = (updatedEnemy.hp ?? 0) / Math.max(1, updatedEnemy.maxHp || (updatedEnemy.hp ?? 1));
            const statusLabels: Record<string, string> = { burn: '화상', poison: '독', freeze: '빙결', curse: '저주' };

            // Phase 3 (원시의 신 등 3페이즈 보스, threshold 25%)
            if (updatedEnemy.phase3 && !updatedEnemy.phase3Triggered) {
                const threshold = updatedEnemy.phase3.threshold ?? 0.25;
                if (hpRatio <= threshold) {
                    const p3 = updatedEnemy.phase3;
                    updatedEnemy = {
                        ...updatedEnemy,
                        name: p3.name,
                        atk: Math.floor((updatedEnemy.atk ?? 0) * (1 + (p3.atkBonus ?? 0))),
                        pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p3.pattern },
                        phase3Triggered: true,
                    };
                    logs.push({ type: 'critical', text: `💀 ${p3.log}` });
                    if (p3.statusEffect) {
                        const resistRelic = relics.find((r: any) => r.effect === 'status_resist');
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
                        atk: Math.floor((updatedEnemy.atk ?? 0) * (1 + (p2.atkBonus ?? 0))),
                        pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p2.pattern },
                        phase2Triggered: true,
                    };
                    logs.push({ type: 'warning', text: `⚡ ${p2.log}` });
                    if (p2.statusEffect) {
                        const resistRelic2 = relics.find((r: any) => r.effect === 'status_resist');
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
        let mult = heavy ? 1.4 : 1;
        const critBlockRelic = relics.find((relic: any) => relic.effect === 'crit_block');
        if (heavy && critBlockRelic && Math.random() < critBlockRelic.val) {
            mult = 1;
            logs.push({ type: 'event', text: '[강철 의지] 강타를 흘려냈습니다!' });
        }
        const heavyResolved = heavy && mult > 1;

        // 유물: 가시 갑옷 (reflect) — 피격 시 적에게 반사
        const reflectRelic = relics.find((r: any) => r.effect === 'reflect');
        // cycle 156: 시너지 'absolute_reflect' — 반사율 50%, 스턴 25% 확률. effect-name primary + bonus.reflect fallback.
        const absoluteReflectSyn = activeSynergies.find((s: any) =>
            s.bonus.effect === 'absolute_reflect' || s.bonus.reflect);
        const reflectMult = absoluteReflectSyn ? (absoluteReflectSyn.bonus.reflect || 0.3) : (reflectRelic ? reflectRelic.val : 0);
        const reflectDmg = (reflectRelic || absoluteReflectSyn) ? Math.floor(stats.def * reflectMult) : 0;
        const enemyHpAfterReflect = reflectDmg > 0 ? Math.max(0, (updatedEnemy.hp ?? 0) - reflectDmg) : (updatedEnemy.hp ?? 0);
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
        const rawEnemyAtk = (updatedEnemy.atk ?? 0) * mult * enemyAtkMult;
        // 최소 피해량: 원래 공격력의 10% (DEF 스택으로 완전 무효화 방지, 고DEF 빌드 보상)
        const minEnemyDmg = Math.max(1, Math.floor(rawEnemyAtk * 0.10));
        let enemyDmg = Math.max(minEnemyDmg, Math.floor(rawEnemyAtk - stats.def));
        if (enemyAtkMult < 1 && (updatedEnemy.blindTurns > 0 || updatedEnemy.fearTurns > 0 || updatedEnemy.cursedTurns > 0)) {
            const statusName = updatedEnemy.blindTurns > 0 ? '실명' : updatedEnemy.fearTurns > 0 ? '공포' : '저주';
            logs.push({ type: 'info', text: `[${statusName}] ${updatedEnemy.name}의 공격력이 감소합니다!` });
        }

        // cycle 108: 플레이어 curse 상태이상 — 받는 피해 증폭 (BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT).
        // MSG.SKILL_CURSE_AMPLIFY 의도 구현. 보스 phase / heavy attack에 의한 curse 부여
        // 위협이 actually 작동하도록. 적의 cursedTurns(공격력 감소)와 짝을 이루는 player-side 페널티.
        const playerStatusList = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
        if (playerStatusList.includes('curse')) {
            const ampMult = BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT || 1.3;
            const before = enemyDmg;
            enemyDmg = Math.floor(enemyDmg * ampMult);
            const pct = Math.round((ampMult - 1) * 100);
            logs.push({ type: 'warning', text: `[저주] 받는 피해 +${pct}% (${before} → ${enemyDmg})` });
        }

        // cycle 162: 'titan' 유물 (타이탄의 허리띠) — val.critReduce 0.5 받는 치명타 피해 감소.
        //   cycle 149에서 hp 보너스만 적용했고 critReduce는 별도 사이클로 미뤘던 잔존.
        //   heavyResolved (heavy attack — boss/enemy의 강타) 상황을 enemy crit으로 해석.
        if (heavyResolved) {
            const titanRelic = relics.find((r: any) => r.effect === 'titan');
            const reduce = titanRelic?.val?.critReduce || 0;
            if (reduce > 0) {
                const before = enemyDmg;
                enemyDmg = Math.max(1, Math.floor(enemyDmg * (1 - reduce)));
                const pct = Math.round(reduce * 100);
                logs.push({ type: 'success', text: `[타이탄의 허리띠] 강타 피해 -${pct}% (${before} → ${enemyDmg})` });
            }
        }

        // 몬스터 공격 시 상태이상 부여 (pattern.statusEffect + pattern.statusChance 지원)
        if (heavy && updatedEnemy.pattern?.statusEffect && Math.random() < (updatedEnemy.pattern.statusChance || 0.25)) {
            const sEff = updatedEnemy.pattern.statusEffect;
            const resistRelic = relics.find((r: any) => r.effect === 'status_resist');
            const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
            const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
            if (!currentStatus.includes(sEff) && Math.random() >= resistChance) {
                const statusLabels: Record<string, string> = { burn: '화상', poison: '독', freeze: '빙결', curse: '저주', bleed: '출혈' };
                updatedPlayer = { ...updatedPlayer, status: [...currentStatus, sEff] };
                logs.push({ type: 'warning', text: `[${updatedEnemy.name}] [${statusLabels[sEff] || sEff}] 부여!` });
            } else if (resistRelic) {
                logs.push({ type: 'success', text: `[고대의 봉인] 상태이상을 저항했습니다!` });
            }
        }

        const protectedResult = this.applyFatalProtection(updatedPlayer, relics, enemyDmg, logs, activeSynergies);

        // cycle 172: 'counter' (반격 자세) 스킬 — 피격 시 buff.counterChance 확률로 적에게 반격 추가타.
        //   tempBuff에 counterChance 필드가 있고 turn > 0이며 player가 살아있고 적도 살아있을 때만.
        let finalEnemy: any = { ...updatedEnemy, guarding: false };
        const playerBuff = (protectedResult.updatedPlayer as any).tempBuff;
        if (playerBuff?.counterChance > 0 && playerBuff.turn > 0
            && !protectedResult.isDead
            && (finalEnemy.hp ?? 0) > 0
            && Math.random() < playerBuff.counterChance) {
            const counterDmg = Math.max(1, Math.floor(stats.atk));
            finalEnemy = { ...finalEnemy, hp: Math.max(0, (finalEnemy.hp ?? 0) - counterDmg) };
            logs.push({ type: 'event', text: `[${playerBuff.name}] 반격! ${finalEnemy.name}에게 ${counterDmg} 피해!` });
        }

        return {
            updatedPlayer: protectedResult.updatedPlayer,
            updatedEnemy: finalEnemy,
            damage: enemyDmg,
            isDead: protectedResult.isDead,
            isCrit: heavyResolved,
            logs: [...logs, {
                type: heavyResolved ? 'critical' : 'warning',
                text: heavyResolved ? MSG.COMBAT_ENEMY_HEAVY_HIT(updatedEnemy.name, enemyDmg) : MSG.COMBAT_ENEMY_HIT(updatedEnemy.name, enemyDmg)
            }]
        };
    },

    attemptEscape(enemy: Monster, stats: any) {
        const success = Math.random() > BALANCE.ESCAPE_CHANCE;
        if (success) {
            return { success: true, logs: [{ type: 'info', text: MSG.ESCAPE_SUCCESS }] };
        }

        const enemyDmg = Math.max(1, (enemy.atk ?? 0) - stats.def);
        return {
            success: false,
            damage: enemyDmg,
            logs: [
                { type: 'error', text: MSG.ESCAPE_FAIL },
                { type: 'warning', text: MSG.ESCAPE_FAIL_DMG(enemy.name, enemyDmg) }
            ]
        };
    },

    applyExpGain(player: Player, expGained: any = 0) {
        const p: any = { ...player, exp: (player.exp || 0) + expGained };
        const logs: any[] = [];
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

    handleVictory(player: Player, enemy: Monster, passiveBonus: any = {}) {
        const p: any = { ...player };
        const relics = p.relics || [];
        const baseName: string = this.resolveEnemyBaseName(enemy) || '';
        const previousBossClears = p.stats?.killRegistry?.[baseName] || 0;
        const bossBrief = enemy.isBoss ? BOSS_BRIEFS[baseName] : null;

        // 유물 + 패시브 스킬: EXP/골드 배율
        const expMult = 1 + (relics.find((r: any) => r.effect === 'exp_mult')?.val || 0) + (passiveBonus.expMult || 0);
        const goldMult = 1 + (relics.find((r: any) => r.effect === 'gold_mult')?.val || 0) + (passiveBonus.goldMult || 0);
        // 챌린지 모디파이어 보상 스케일링 (3개 이상 → 1.5배)
        const challengeMods = p.challengeModifiers || [];
        const challengeScale: { threshold?: number; mult?: number } = (BALANCE as any).CHALLENGE_REWARD_SCALING || {};
        const challengeRewardMult = challengeMods.length >= (challengeScale.threshold || 3) ? (challengeScale.mult || 1.5) : 1;
        // 유물: 처치 보너스 (kill_bonus)
        const killBonusRelic = relics.find((r: any) => r.effect === 'kill_bonus');
        const killExpMult = killBonusRelic ? (1 + (killBonusRelic.val?.exp || 0)) : 1;
        const killGoldMult = killBonusRelic ? (1 + (killBonusRelic.val?.gold || 0)) : 1;
        // 레벨 차이 골드 스케일링: 플레이어가 몬스터보다 10레벨 이상 높으면 골드 감소 (최소 30%)
        const playerLevel = p.level || 1;
        const enemyLevel = enemy.level || 1;
        const levelGap = Math.max(0, playerLevel - enemyLevel - 9);
        const levelPenalty = Math.max(0.3, 1 - levelGap * 0.07);
        const expGained = Math.floor((enemy.exp ?? 0) * expMult * killExpMult * challengeRewardMult);
        const noGold = p.challengeModifiers?.includes('noGold');
        const goldGained = Math.floor((enemy.gold ?? 0) * goldMult * killGoldMult * levelPenalty * (noGold ? 0.5 : 1) * challengeRewardMult);

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
        const essenceGain = Math.max(1, Math.floor((enemy.exp ?? 0) / 8));
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
        const healRelic = relics.find((r: any) => r.effect === 'on_kill_heal');
        if (healRelic) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * healRelic.val);
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[피의 서약] +${heal} HP` });
        }

        // cycle 158: 'kill_stack_atk' (허공의 왕좌) — 적 처치 시 ATK perKill 누적, max 캡.
        //   combatFlags.killStackAtkBonus에 저장. applyBattleStartRelics에서 0으로 리셋(전투 내 한정).
        const killStackRelic = relics.find((r: any) => r.effect === 'kill_stack_atk');
        if (killStackRelic) {
            const perKill = killStackRelic.val?.perKill || 0;
            const maxStack = killStackRelic.val?.max || 1;
            const flags: any = p.combatFlags || {};
            const next = Math.min(maxStack, (flags.killStackAtkBonus || 0) + perKill);
            p.combatFlags = { ...flags, killStackAtkBonus: next };
            logs.push({ type: 'event', text: `[허공의 왕좌] ATK 누적 +${Math.round(next * 100)}% (이번 전투)` });
        }

        // cycle 157: 'devour_hp' (세계 포식자) — 적 처치 시 적 maxHp의 val(=0.1)만큼 player maxHp 영구 증가.
        // 스펙은 "전투 내"이지만 per-combat 리셋 인프라 미구현 → 런 내 영구 적용 (관대한 해석).
        const devourRelic = relics.find((r: any) => r.effect === 'devour_hp');
        if (devourRelic && enemy.maxHp) {
            const hpGain = Math.floor((enemy.maxHp || 0) * (devourRelic.val || 0));
            if (hpGain > 0) {
                p.maxHp = (p.maxHp || BALANCE.DEFAULT_MAX_HP) + hpGain;
                p.hp = (p.hp || 0) + hpGain; // 신규 HP만큼 현재 HP도 증가 (overheal 방지: maxHp 갱신 후)
                logs.push({ type: 'heal', text: `[세계 포식자] 영혼 흡수! 최대 HP +${hpGain}` });
            }
        }

        // cycle 153: 시너지 'immortal_warrior' (killHeal) / 'infinite_devour' (devour) — 처치 시 HP 회복.
        const victorySynergies = getActiveRelicSynergies(relics);
        const killHealSyn = victorySynergies.find((s: any) =>
            s.bonus.effect === 'immortal_warrior' || s.bonus.killHeal);
        if (killHealSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * (killHealSyn.bonus.killHeal ?? 0));
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[불멸의 전사] +${heal} HP (처치 회복)` });
        }
        const devourSyn = victorySynergies.find((s: any) =>
            s.bonus.effect === 'infinite_devour' || s.bonus.devour);
        if (devourSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * (devourSyn.bonus.devour ?? 0));
            p.hp = Math.min(p.maxHp, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: `[무한 포식] +${heal} HP (포식)` });
        }

        // 유물: 별의 핵 (mp_restore_battle) — 전투 종료 시 MP 전량 회복
        const starCoreRelic = relics.find((r: any) => r.effect === 'mp_restore_battle');
        if (starCoreRelic) {
            p.mp = p.maxMp || 50;
            logs.push({ type: 'heal', text: `[별의 핵] MP 전량 회복!` });
        }

        const expResult = this.applyExpGain(p, expGained);
        expResult.logs.forEach((log: any) => logs.push(log));
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

    updateQuestProgress(player: Player, enemyName: any) {
        return syncQuestProgress(player, enemyName, DB.QUESTS);
    },

    processLoot(enemy: Monster, player: any = null, signaturePityMult: any = 1.0) {
        return _processLoot(enemy, player, signaturePityMult);
    },

    /**
     * 적의 다음 행동을 예측하여 텔레그래프 메시지를 반환합니다.
     * CombatPanel에서 UI 경고 표시에 사용.
     */
    predictEnemyNextAction(enemy: Monster) {
        if (!enemy || (enemy.hp ?? 0) <= 0) return null;
        if ((enemy.stunnedTurns || 0) > 0) return { type: 'stunned', label: '기절 중 — 행동 불가', color: 'blue' };

        // 보스 Phase 2 전환 임박 체크
        const hpRatio = (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || (enemy.hp ?? 1));
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

    handleDefeat(player: Player, INITIAL_PLAYER: any) {
        const graveData = buildGraveData(player);

        const starterState: any = { ...INITIAL_PLAYER };
        const meta = { ...this.DEFAULT_META, ...(player.meta || {}) };
        const prevStats = player.stats || starterState.stats || {};

        starterState.stats = {
            ...starterState.stats,
            ...prevStats,
            deaths: (prevStats.deaths || 0) + 1,
            // cycle 205: areaBossDefeated는 per-RUN flag (exploreUtils.ts:144 주석
            //   '이번 런 미처치 시 보장'). 사망 = run 종료 → reset 필수.
            //   기존엔 ...prevStats spread로 보존되어 사망 후 재진입 시 area boss respawn
            //   영구 차단 → 같은 area의 signature 회수 봉인 + signaturePity counter도
            //   climb 불가 (보스 kill에서만 +=1). ASCEND/RESET_GAME과 정합성 align.
            areaBossDefeated: {},
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
        // cycle 191: 죽음은 RUN 진행도 reset이지만 META 진행도(premium 자산 / 영구 칭호)는 보존.
        //   cycle 119(6 영구 카운터) / cycle 188(ASCEND premium preserve) 패턴 확장 — 죽음에도 동일.
        //   기존엔 INITIAL_PLAYER spread로 모두 reset되어 premium currency / 칭호 / 부활권 / 인벤
        //   확장 슬롯이 사라지던 회귀.
        starterState.titles = Array.isArray(player.titles) ? [...player.titles] : [];
        starterState.activeTitle = player.activeTitle || null;
        starterState.premiumCurrency = Math.max(0, Number((player as any).premiumCurrency) || 0);
        starterState.reviveTokens = Math.max(0, Number((player as any).reviveTokens) || 0);
        if ((player as any).maxInv !== undefined) {
            starterState.maxInv = Math.max(20, Number((player as any).maxInv) || 20);
        }
        // seasonPass도 RUN 무관 — premium tier 진행도 보존.
        if ((player as any).seasonPass) {
            starterState.seasonPass = (player as any).seasonPass;
        }
        // cycle 214: 주간 미션 진행도 / claimed ledger 보존 — cycle 191 META preserve 시리즈 보강.
        //   사망 후 mid-week 진행도(kills 35/50 등)와 claimed 미션이 wipe되던 회귀.
        //   주 경계 자동 reset(exploreUtils.resetWeeklyProtocolIfNeeded)은 그대로 동작.
        if ((player as any).weeklyProtocol) {
            starterState.weeklyProtocol = (player as any).weeklyProtocol;
        }

        return {
            updatedPlayer: starterState,
            graveData,
            logs: [{ type: 'error', text: MSG.DEFEAT }]
        };
    }
};
