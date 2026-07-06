// cycle 321: unused LOOT_TABLE / DROP_TABLES imports 제거 — 두 데이터는 CombatEngine.loot.ts에서만 사용.
//   CombatEngine.ts 본체는 _processLoot / _resolveEnemyBaseName re-export로 충분.
import type { Monster, Player, Relic } from '../types/index.js';
import { DB } from '../data/db.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { BOSS_BRIEFS } from '../data/monsters.js';
import { syncQuestProgress } from '../utils/questProgress.js';
import { buildGraveData } from '../utils/graveUtils.js';
import { MSG } from '../data/messages.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import { processLoot as _processLoot, resolveEnemyBaseName as _resolveEnemyBaseName } from './CombatEngine.loot.js';
import { statusMethods } from './CombatEngine.status.js';
import { outcomeMethods } from './CombatEngine.outcome.js';
import { relicEffectMethods } from './CombatEngine.relics.js';
import { actionMethods } from './CombatEngine.actions.js';
import { enemyAIMethods } from './CombatEngine.enemyAI.js';

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

    // cycle 546: relics default [] 제거 — 2 internal callsite (line 480, 745)
    //   + N test callsite 모두 명시 전달이라 default 도달 불가. body의
    //   (relics || []) defensive guard는 별개 보존 (caller가 null 넘기는 path
    //   활성). 청소 메가 시리즈 41번째 (cycle 502-545).
    getElementMultiplier(elem: any, enemy: Monster, relics: any[]) {
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

    // cycle 537: options default {} 제거 — 2 internal callsite (line 486, 752)
    //   모두 object literal 명시 전달이라 default 도달 불가. destructuring
    //   내부 default(mult/guarding/elementMultiplier/critChance)는 별개 보존.
    //   util/component/hook/system default 청소 메가 시리즈 33번째.
    calculateDamage(stats: any, options: any) {
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

    // PR #3 (2026-06): 적 DEF 비율 경감. calculateDamage는 순수 공격 roll로 유지하고,
    //   경감은 모든 공격 배율(크리/처형/연격 등) 적용 후 finalDamage 단계에서 1회 처리.
    //   mitigated = max(1, floor(rawDamage × K/(K+effDef))). armor_pen 유물이 effDef를 감소
    //   (이전엔 플레이어 자신의 def를 줄이고 그마저 무시돼 완전 dead였던 회귀 fix).
    mitigateByEnemyDef(rawDamage: number, enemyDef: number, relics: Relic[]) {
        const def = Math.max(0, enemyDef || 0);
        if (def === 0) return rawDamage;
        const apRelic = relics.find((r: any) => r.effect === 'armor_pen');
        const effDef = apRelic ? Math.floor(def * (1 - apRelic.val)) : def;
        const K = BALANCE.ENEMY_DEF_K;
        return Math.max(1, Math.floor(rawDamage * K / (K + Math.max(0, effDef))));
    },

    getCombatFlags(player: Player) {
        return { ...this.DEFAULT_COMBAT_FLAGS, ...(player?.combatFlags || {}) };
    },

    // cycle 551: relics default [] 제거 — 4 internal callsite (line 84/370/
    //   957/987) 모두 명시 전달이라 default 도달 불가. 외부 caller 0건, test
    //   caller 0건. systems/CombatEngine method 시리즈 5번째 (cycle 546-549에
    //   이은). 청소 메가 시리즈 45번째 (cycle 502-550).
    getEffectiveMaxMp(player: Player, relics: Relic[]) {
        const rmp = 1 + relics.reduce((acc: any, relic: any) => {
            if (relic.effect === 'mp_mult') return acc + relic.val;
            if (relic.effect === 'omega') return acc + relic.val;
            return acc;
        }, 0);
        return Math.floor((player?.maxMp || 50) * rmp);
    },

    // cycle 548: relics / logs defaults 제거 — 2 internal callsite (line 592,
    //   890) 모두 명시 전달이라 두 default 모두 도달 불가. 외부 caller 0건,
    //   test caller 0건. 청소 메가 시리즈 43번째 (cycle 502-547).
    ...relicEffectMethods,

    ...statusMethods,

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

    ...actionMethods,

    ...enemyAIMethods,

    // cycle 536: expGained default 0 제거 — 4 production callsite (3 외부 +
    //   1 internal) + 16 test callsite 모두 명시 전달이라 default 도달 불가.
    //   util/component/hook default 청소 메가 시리즈 32번째, systems/ 진입.
    ...outcomeMethods,

    updateQuestProgress(player: Player, enemyName: any) {
        return syncQuestProgress(player, enemyName, DB.QUESTS);
    },

    // cycle 552: player / signaturePityMult defaults 제거 — 1 production
    //   caller (combatVictory.ts:63) 3 args 명시 전달. tests/cycle-171은
    //   CombatEngine.loot.ts의 별개 export된 processLoot (1 arg 호출)이라
    //   별개. method의 두 default 모두 도달 불가. systems/CombatEngine method
    //   시리즈 6번째.
    processLoot(enemy: Monster, player: any, signaturePityMult: any) {
        return _processLoot(enemy, player, signaturePityMult);
    },

    handleDefeat(player: Player, INITIAL_PLAYER: any) {
        // cycle 609: buildGraveData에 Math.random / Date.now 명시 추가 — caller
        //   에 explicit args 추가하여 buildGraveData defaults reachable →
        //   unreachable conversion (cycle 608 explicit default-elimination
        //   pattern 2번째 적용).
        const graveData = buildGraveData(player, Math.random, Date.now);

        const starterState: any = { ...INITIAL_PLAYER };
        const meta = { ...this.DEFAULT_META, ...(player.meta || {}) };
        const prevStats = player.stats || starterState.stats || {};

        // C-1 (B+ 2026-06): 첫 죽음에 영구 메타 보너스 — "죽어도 남는다"를 1회차에
        //   학습시켜 완전 리셋 페널티를 공정하게 완충. 메타는 RUN을 넘어 보존되어
        //   아래 starterState.atk/maxHp 합산 + 다음 런 buildClassVitals에도 반영된다.
        const isFirstDeath = (prevStats.deaths || 0) === 0;
        if (isFirstDeath) {
            meta.bonusAtk = (meta.bonusAtk || 0) + BALANCE.FIRST_DEATH_BONUS_ATK;
            meta.bonusHp = (meta.bonusHp || 0) + BALANCE.FIRST_DEATH_BONUS_HP;
        }

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

        const defeatLogs: any[] = [{ type: 'error', text: MSG.DEFEAT }];
        if (isFirstDeath) {
            defeatLogs.push({ type: 'system', text: MSG.FIRST_DEATH_META(BALANCE.FIRST_DEATH_BONUS_ATK, BALANCE.FIRST_DEATH_BONUS_HP) });
        }
        return {
            updatedPlayer: starterState,
            graveData,
            logs: defeatLogs
        };
    }
};
