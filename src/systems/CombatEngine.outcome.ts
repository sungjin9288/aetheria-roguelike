import { BALANCE, CONSTANTS } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import { BOSS_BRIEFS } from '../data/monsters.js';
import { getPrestigeUnlocks } from './prestigeUnlocks';
import { getMirrorEffects } from './mirrorUpgrades';
import { applyEssenceGain, getEssenceGainFromExp } from './essenceLedger';
import { getPacedCombatExp } from '../utils/progressionPacing.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';
import type { Player, Monster } from '../types/index.js';
import { scaleProgressionExpReward } from '../data/progressionProfiles.js';
import { endDevourBonus } from '../utils/adventureRelicBonuses.js';

/**
 * CombatEngine 결과(경험치/승리) 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). this 교차호출은 호출 시점 바인딩 → 객체 any.
 */
export const outcomeMethods: any = {
    applyExpGain(player: Player, expGained: any) {
        // 2026-09 N1: `p: any` → Player. INITIAL_STATE가 보장하는 수치 필드만 `!`로 좁힌다.
        const p: Player = { ...player, exp: (player.exp || 0) + expGained };
        const logs = [];
        let levelUps = 0;
        let visualEffect = null;

        while (p.level! < CONSTANTS.MAX_LEVEL && p.exp! >= p.nextExp!) {
            p.exp = p.exp! - p.nextExp!;
            p.level = p.level! + 1;
            p.nextExp = Math.min(
                Math.floor(p.nextExp! * BALANCE.EXP_SCALE_RATE),
                BALANCE.EXP_LEVEL_HARD_CAP
            );
            p.maxHp = p.maxHp! + BALANCE.HP_PER_LEVEL;
            p.maxMp = p.maxMp! + BALANCE.MP_PER_LEVEL;
            p.hp = Math.min(p.hp! + BALANCE.HP_PER_LEVEL, p.maxHp);
            p.mp = Math.min(p.mp! + BALANCE.MP_PER_LEVEL, p.maxMp);
            p.atk = p.atk! + BALANCE.ATK_PER_LEVEL;
            p.def = p.def! + BALANCE.DEF_PER_LEVEL;
            levelUps += 1;
            visualEffect = 'levelUp';
            logs.push({ type: 'system', text: MSG.LEVEL_UP(p.level, BALANCE.ATK_PER_LEVEL, BALANCE.HP_PER_LEVEL) });

            // 레벨 마일스톤 보상
            const isMajor = p.level % BALANCE.LEVEL_MAJOR_MILESTONE_EVERY === 0;
            const isMinor = !isMajor && p.level % BALANCE.LEVEL_MILESTONE_EVERY === 0;
            if (isMajor) {
                const atkBonus = BALANCE.MILESTONE_STAT_ATK;
                const hpBonus = BALANCE.MILESTONE_STAT_HP;
                const mpBonus = BALANCE.MILESTONE_STAT_MP;
                p.atk = p.atk! + atkBonus;
                p.maxHp = p.maxHp! + hpBonus;
                p.hp = Math.min(p.hp! + hpBonus, p.maxHp!);
                p.maxMp = p.maxMp! + mpBonus;
                p.mp = Math.min(p.mp! + mpBonus, p.maxMp!);
                logs.push({ type: 'event', text: MSG.LEVEL_MAJOR_MILESTONE(p.level, atkBonus, hpBonus, mpBonus) });
            } else if (isMinor) {
                const goldBonus = p.level * BALANCE.MILESTONE_GOLD_PER_LV;
                p.gold = (p.gold || 0) + goldBonus;
                logs.push({ type: 'event', text: MSG.LEVEL_MILESTONE(p.level, goldBonus) });
            }
        }

        if (p.level! >= CONSTANTS.MAX_LEVEL) {
            p.exp = Math.min(p.exp!, Math.max(0, p.nextExp! - 1));
        }

        return {
            updatedPlayer: p,
            logs,
            leveledUp: levelUps > 0,
            levelUps,
            visualEffect
        };
    },

    handleVictory(player: Player, enemy: Monster, passiveBonus: any, liveConfig: any) {
        const p: Player = { ...endDevourBonus(player) };
        const relics = p.relics || [];
        const baseName: string = this.resolveEnemyBaseName(enemy) || '';
        const previousBossClears = p.stats?.killRegistry?.[baseName] || 0;
        const bossBrief = enemy.isBoss ? BOSS_BRIEFS[baseName] : null;

        // cycle 265: liveConfig 보너스 dispatch — 기존엔 admin eventMultiplier(SystemTab UI)와
        //   seasonEvent.goldMultiplier / xpMultiplier(GameRoot 배너 광고)가 dispatch 0건이라
        //   광고된 보너스가 fake던 silent UX 회귀. UI 광고 vs 실제 동작 정합 fix.
        const eventMult = (typeof liveConfig?.eventMultiplier === 'number' && liveConfig.eventMultiplier > 0)
            ? liveConfig.eventMultiplier
            : 1;
        const seasonActive = liveConfig?.seasonEvent?.active === true;
        const seasonGoldMult = seasonActive && typeof liveConfig.seasonEvent.goldMultiplier === 'number'
            ? liveConfig.seasonEvent.goldMultiplier
            : 1;
        const seasonXpMult = seasonActive && typeof liveConfig.seasonEvent.xpMultiplier === 'number'
            ? liveConfig.seasonEvent.xpMultiplier
            : 1;

        // 유물 + 패시브 스킬: EXP/골드 배율 (cycle 265: liveConfig 곱셈 합류)
        // 2026-09 W4: gold_mult/drop_rate/dot_mult 과 같은 "최강값 1개" 정책 — 이전엔 relics.find 로
        //   유물 보유 순서에 따라 EXP 배율이 달라졌다(같은 유물 조합인데 획득 순서가 결과를 바꿈).
        const expMult = (1 + getStrongestNumericRelicValue(relics, 'exp_mult') + (passiveBonus.expMult || 0))
            * eventMult * seasonXpMult;
        const goldMult = (1 + getStrongestNumericRelicValue(relics, 'gold_mult') + (passiveBonus.goldMult || 0))
            * seasonGoldMult;
        // 챌린지 모디파이어 보상 스케일링 (3개 이상 → 1.5배, rank≥7 풀 스택 4개 → 2.0배)
        const challengeMods = p.challengeModifiers || [];
        const challengeScale: { threshold?: number; mult?: number; fullThreshold?: number; fullMult?: number } = (BALANCE as any).CHALLENGE_REWARD_SCALING || {};
        const challengeRewardMult =
            challengeScale.fullThreshold && challengeMods.length >= challengeScale.fullThreshold ? (challengeScale.fullMult || 2.0)
            : challengeMods.length >= (challengeScale.threshold || 3) ? (challengeScale.mult || 1.5)
            : 1;
        // 유물: 처치 보너스 (kill_bonus)
        const killBonusRelic = relics.find((r) => r.effect === 'kill_bonus');
        const killExpMult = killBonusRelic ? (1 + (killBonusRelic.val?.exp || 0)) : 1;
        const killGoldMult = killBonusRelic ? (1 + (killBonusRelic.val?.gold || 0)) : 1;
        // feat/prestige-rank-ladder: rank≥9 "심연 사냥꾼" — 정예(isElite) 처치 시 EXP/골드 +25%.
        //   보스는 별도 보상 체계(초회 토벌 보너스 등)가 있으므로 정예 한정, 비퇴행 순수 보너스.
        const eliteRewardMult = enemy.isElite ? getPrestigeUnlocks(p.meta?.prestigeRank).eliteRewardMult : 1;
        // 레벨 차이 골드 스케일링: 플레이어가 몬스터보다 10레벨 이상 높으면 골드 감소 (최소 30%)
        const playerLevel = p.level || 1;
        const enemyLevel = enemy.level || 1;
        const levelGap = Math.max(0, playerLevel - enemyLevel - BALANCE.VICTORY_GOLD_LEVEL_GAP_THRESHOLD);
        const levelPenalty = Math.max(
            BALANCE.VICTORY_GOLD_LEVEL_PENALTY_FLOOR,
            1 - levelGap * BALANCE.VICTORY_GOLD_LEVEL_PENALTY_SLOPE,
        );
        const rawExpGained = scaleProgressionExpReward(
            p,
            Math.floor((enemy.exp ?? 0) * expMult * killExpMult * challengeRewardMult * eliteRewardMult),
        );
        const expGained = getPacedCombatExp(p, rawExpGained);
        const noGold = p.challengeModifiers?.includes('noGold');
        const rawGoldGained = (enemy.gold ?? 0) * goldMult * killGoldMult * levelPenalty
            * (noGold ? BALANCE.NO_GOLD_MODIFIER_MULT : 1) * challengeRewardMult * eliteRewardMult;
        if (!Number.isFinite(rawGoldGained)) throw new Error('INVALID_RELIC_EFFECT_VALUE');
        const goldGained = Math.floor(rawGoldGained);
        const currentGold = Number.isFinite(p.gold) ? p.gold! : 0;
        const nextGold = currentGold + goldGained;
        if (!Number.isFinite(nextGold) || (goldGained > 0 && nextGold <= currentGold)) {
            throw new Error('INVALID_RELIC_EFFECT_VALUE');
        }

        p.gold = nextGold;

        const isDemonKingSlain = baseName === '마왕';
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
            const bonusGold = Math.max(
                BALANCE.FIRST_BOSS_BONUS_GOLD_FLOOR,
                Math.floor(goldGained * BALANCE.FIRST_BOSS_BONUS_GOLD_RATE),
            );
            p.gold += bonusGold;
            p.stats.total_gold = (p.stats.total_gold || 0) + bonusGold;
            bossClearBonus = {
                goldBonus: bonusGold,
                rewardHint: bossBrief?.rewardHint || '초회 토벌 보너스를 확보했습니다.'
            };
            logs.push({ type: 'event', text: MSG.FIRST_BOSS_GOLD(bonusGold) });
        }

        const meta = { ...this.DEFAULT_META, ...(p.meta || {}) };
        // PR #8: 프레스티지 rank≥1 해금 — 에센스 획득 +10% (essenceMult).
        // 2026-07 — 에테르 거울: essence_flow 노드(레벨당 +10%)를 rank 배율과 곱연산으로 누적.
        const essenceMult = getPrestigeUnlocks(meta.prestigeRank).essenceMult * getMirrorEffects(meta).essenceFlowMult;
        const essenceGain = getEssenceGainFromExp(enemy.exp, essenceMult);
        logs.push({ type: 'event', text: MSG.LEGACY_ESSENCE(essenceGain) });

        // 2026-09 G2: rank는 누적 획득량(essenceLifetime) 기준 — 거울 구매로 내려가지 않는다.
        const granted = applyEssenceGain(meta, essenceGain);
        if (granted.rankGain > 0) {
            logs.push({ type: 'system', text: MSG.LEGACY_RANK(granted.meta.rank) });
        }
        p.meta = granted.meta;

        // 유물: 피의 서약 (on_kill_heal) — 처치 시 HP 회복
        const healRelic = relics.find((r) => r.effect === 'on_kill_heal');
        if (healRelic) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * healRelic.val);
            p.hp = Math.min(p.maxHp!, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: MSG.BLOOD_OATH_HEAL(heal) });
        }

        // 처치 공격력은 원정 동안 유지하며 시너지는 처치당 증가량에 합산한다.
        const killStackRelic = relics.find((r) => r.effect === 'kill_stack_atk');
        const synergiesForKill = (passiveBonus as any)?.activeSynergies || [];
        const killStackSynergyBonus = synergiesForKill.reduce((acc: number, s: any) =>
            acc + (s.bonus?.killStack || 0), 0);
        if (killStackRelic || killStackSynergyBonus > 0) {
            const perKill = (killStackRelic?.val?.perKill || 0) + killStackSynergyBonus;
            const maxStack = killStackRelic?.val?.max || 1;
            const next = Math.min(maxStack, (p.adventureRelicBonuses?.killStackAtk || 0) + perKill);
            p.adventureRelicBonuses = { ...p.adventureRelicBonuses, killStackAtk: next };
            const sourceLabel = killStackRelic ? '[허공의 왕좌]' : '[시너지 처형 분노]';
            logs.push({ type: 'event', text: MSG.KILL_STACK_ATTACK(sourceLabel, Math.round(next * 100)) });
        }

        // 마지막 처치량만 다음 전투에 예약한다. 승리 화면에서는 HP를 올리지 않는다.
        const devourRelic = relics.find((r) => r.effect === 'devour_hp');
        if (devourRelic && enemy.maxHp) {
            const hpGain = Math.floor((enemy.maxHp || 0) * (devourRelic.val || 0));
            if (hpGain > 0) {
                p.adventureRelicBonuses = {
                    ...p.adventureRelicBonuses,
                    devour: { phase: 'ready', amount: hpGain },
                };
                logs.push({ type: 'event', text: MSG.WORLD_DEVOUR_HEALTH(hpGain) });
            }
        }

        // cycle 153: 시너지 'immortal_warrior' (killHeal) / 'infinite_devour' (devour) — 처치 시 HP 회복.
        const victorySynergies = getActiveRelicSynergies(relics);
        const killHealSyn = victorySynergies.find((s: any) =>
            s.bonus.effect === 'immortal_warrior' || s.bonus.killHeal);
        if (killHealSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * (killHealSyn.bonus.killHeal ?? 0));
            p.hp = Math.min(p.maxHp!, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: MSG.IMMORTAL_WARRIOR_HEAL(heal) });
        }
        const devourSyn = victorySynergies.find((s: any) =>
            s.bonus.effect === 'infinite_devour' || s.bonus.devour);
        if (devourSyn) {
            const heal = Math.floor((p.maxHp || BALANCE.DEFAULT_MAX_HP) * (devourSyn.bonus.devour ?? 0));
            p.hp = Math.min(p.maxHp!, (p.hp || 1) + heal);
            logs.push({ type: 'heal', text: MSG.INFINITE_DEVOUR_HEAL(heal) });
        }

        // 유물: 별의 핵 (mp_restore_battle) — 전투 종료 시 MP 전량 회복
        const starCoreRelic = relics.find((r) => r.effect === 'mp_restore_battle');
        if (starCoreRelic) {
            p.mp = p.maxMp || 50;
            logs.push({ type: 'heal', text: MSG.STAR_CORE_RESTORE });
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
};
