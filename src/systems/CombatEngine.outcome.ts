import { BALANCE, CONSTANTS } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import { BOSS_BRIEFS } from '../data/monsters.js';
import { getPrestigeUnlocks } from './prestigeUnlocks';
import { getMirrorEffects } from './mirrorUpgrades';
import type { Player, Monster } from '../types/index.js';

/**
 * CombatEngine 결과(경험치/승리) 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). this 교차호출은 호출 시점 바인딩 → 객체 any.
 */
export const outcomeMethods: any = {
    applyExpGain(player: Player, expGained: any) {
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
            logs.push({ type: 'system', text: MSG.LEVEL_UP(p.level, BALANCE.ATK_PER_LEVEL, BALANCE.HP_PER_LEVEL) });

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

    handleVictory(player: Player, enemy: Monster, passiveBonus: any, liveConfig: any) {
        const p: any = { ...player };
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
        const expMult = (1 + (relics.find((r: any) => r.effect === 'exp_mult')?.val || 0) + (passiveBonus.expMult || 0))
            * eventMult * seasonXpMult;
        const goldMult = (1 + (relics.find((r: any) => r.effect === 'gold_mult')?.val || 0) + (passiveBonus.goldMult || 0))
            * seasonGoldMult;
        // 챌린지 모디파이어 보상 스케일링 (3개 이상 → 1.5배, rank≥7 풀 스택 4개 → 2.0배)
        const challengeMods = p.challengeModifiers || [];
        const challengeScale: { threshold?: number; mult?: number; fullThreshold?: number; fullMult?: number } = (BALANCE as any).CHALLENGE_REWARD_SCALING || {};
        const challengeRewardMult =
            challengeScale.fullThreshold && challengeMods.length >= challengeScale.fullThreshold ? (challengeScale.fullMult || 2.0)
            : challengeMods.length >= (challengeScale.threshold || 3) ? (challengeScale.mult || 1.5)
            : 1;
        // 유물: 처치 보너스 (kill_bonus)
        const killBonusRelic = relics.find((r: any) => r.effect === 'kill_bonus');
        const killExpMult = killBonusRelic ? (1 + (killBonusRelic.val?.exp || 0)) : 1;
        const killGoldMult = killBonusRelic ? (1 + (killBonusRelic.val?.gold || 0)) : 1;
        // feat/prestige-rank-ladder: rank≥9 "심연 사냥꾼" — 정예(isElite) 처치 시 EXP/골드 +25%.
        //   보스는 별도 보상 체계(초회 토벌 보너스 등)가 있으므로 정예 한정, 비퇴행 순수 보너스.
        const eliteRewardMult = enemy.isElite ? getPrestigeUnlocks(p.meta?.prestigeRank).eliteRewardMult : 1;
        // 레벨 차이 골드 스케일링: 플레이어가 몬스터보다 10레벨 이상 높으면 골드 감소 (최소 30%)
        const playerLevel = p.level || 1;
        const enemyLevel = enemy.level || 1;
        const levelGap = Math.max(0, playerLevel - enemyLevel - 9);
        const levelPenalty = Math.max(0.3, 1 - levelGap * 0.07);
        const expGained = Math.floor((enemy.exp ?? 0) * expMult * killExpMult * challengeRewardMult * eliteRewardMult);
        const noGold = p.challengeModifiers?.includes('noGold');
        const goldGained = Math.floor((enemy.gold ?? 0) * goldMult * killGoldMult * levelPenalty * (noGold ? 0.5 : 1) * challengeRewardMult * eliteRewardMult);

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
        // PR #8: 프레스티지 rank≥1 해금 — 에센스 획득 +10% (essenceMult).
        // 2026-07 — 에테르 거울: essence_flow 노드(레벨당 +10%)를 rank 배율과 곱연산으로 누적.
        const essenceMult = getPrestigeUnlocks(meta.prestigeRank).essenceMult * getMirrorEffects(meta).essenceFlowMult;
        const essenceGain = Math.max(1, Math.floor((enemy.exp ?? 0) / 8 * essenceMult));
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
        // cycle 236: 시너지 'annihilator'(killStack 0.07) / 'void_dragon'(killStack 0.08)의
        //   killStack 보너스를 perKill에 합산 — silent dead config fix.
        const killStackRelic = relics.find((r: any) => r.effect === 'kill_stack_atk');
        const synergiesForKill = (passiveBonus as any)?.activeSynergies || [];
        const killStackSynergyBonus = synergiesForKill.reduce((acc: number, s: any) =>
            acc + (s.bonus?.killStack || 0), 0);
        if (killStackRelic || killStackSynergyBonus > 0) {
            const perKill = (killStackRelic?.val?.perKill || 0) + killStackSynergyBonus;
            const maxStack = killStackRelic?.val?.max || 1;
            const flags: any = p.combatFlags || {};
            const next = Math.min(maxStack, (flags.killStackAtkBonus || 0) + perKill);
            p.combatFlags = { ...flags, killStackAtkBonus: next };
            const sourceLabel = killStackRelic ? '[허공의 왕좌]' : '[시너지 처형 분노]';
            logs.push({ type: 'event', text: `${sourceLabel} ATK 누적 +${Math.round(next * 100)}% (이번 전투)` });
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
};
