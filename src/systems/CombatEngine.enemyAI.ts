import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { CLASSES } from '../data/classes.js';
import type { FullStats, Monster, Player } from '../types/index.js';

/**
 * CombatEngine 적 행동/예측 메서드 (enemyAttack / attemptEscape / predictEnemyNextAction)
 * — mixin으로 CombatEngine에 spread. CombatEngine.ts 분리(행동 보존).
 * this 교차호출(tickEnemyStatus / applyFatalProtection)은 호출 시점 바인딩 → 객체 any.
 */
export const enemyAIMethods: any = {
    enemyAttack(player: Player, enemy: Monster, stats: FullStats, rng?: () => number) {
        const random = typeof rng === 'function' ? rng : Math.random;
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
        const synergyDotMult = activeSynergies.reduce((acc: number, syn) =>
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
                logs: [...logs, { type: 'success', text: MSG.STEALTH_EVADE_PROC(enemy.name) }]
            };
        }

        // cycle 226: 장비 evasion roll — 2 armors(암영 망토 / 공허의 전투 외투)의 evasion 필드가
        //   desc_stat에 '회피+N%'를 표시하지만 dispatch path 0건이던 silent dead config fix.
        //   stealth(skill) 후순위로 평가 — 은신은 명시적 발동, evasion은 passive armor 효과.
        //   cycle 222-225 silent dead config 시리즈 마지막 합류.
        const armorEvasion = (updatedPlayer.equip?.armor as any)?.evasion || 0;
        if (armorEvasion > 0 && random() < armorEvasion) {
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: MSG.ARMOR_EVADE_PROC(enemy.name) }]
            };
        }

        // ── Phase 전환 체크 (보스 + 엘리트 통합) ───────────────────
        if (updatedEnemy.isBoss || updatedEnemy.isElite) {
            const hpRatio = (updatedEnemy.hp ?? 0) / Math.max(1, updatedEnemy.maxHp || (updatedEnemy.hp ?? 1));
            // 2026-09 Wave 6 X2: DOT_LABELS(8종 StatusId) 재사용 — 원래 이 4키만 인식하던
            //   동작(stun/bleed/blind/fear는 fallback으로 원문 그대로 노출)을 그대로 보존한다.
            //   p3/p2.statusEffect가 string(느슨한 타입)이라 statusLabels도 Record<string, string>
            //   그대로 유지 — 값만 DOT_LABELS에서 가져온다.
            const statusLabels: Record<string, string> = {
                burn: MSG.DOT_LABELS.burn, poison: MSG.DOT_LABELS.poison,
                freeze: MSG.DOT_LABELS.freeze, curse: MSG.DOT_LABELS.curse,
            };

            // Phase 3 (원시의 신 등 3페이즈 보스, threshold 25%)
            if (updatedEnemy.phase3 && !updatedEnemy.phase3Triggered) {
                const threshold = updatedEnemy.phase3.threshold ?? 0.25;
                if (hpRatio <= threshold) {
                    const p3 = updatedEnemy.phase3;
                    updatedEnemy = {
                        ...updatedEnemy,
                        name: p3.name,
                        atk: Math.floor((updatedEnemy.atk ?? 0) * (1 + (p3.atkBonus ?? 0))),
                        // cycle 228: 8 phase3 bosses(종말의 마왕 / 절대 공허 등)의 defBonus 10-40을
                        //   적용. 기존엔 atkBonus만 적용되어 phase3 'last stand' 강화 의도 미반영.
                        //   silent dead config 시리즈 7번째.
                        def: ((updatedEnemy.def ?? 0) as number) + ((p3.defBonus ?? 0) as number),
                        pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p3.pattern },
                        phase3Triggered: true,
                    };
                    logs.push({ type: 'critical', text: `💀 ${p3.log}` });
                    if (p3.statusEffect) {
                        const resistRelic = relics.find((r) => r.effect === 'status_resist');
                        const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
                        const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
                        if (!currentStatus.includes(p3.statusEffect) && random() >= resistChance) {
                            updatedPlayer = { ...updatedPlayer, status: [...currentStatus, p3.statusEffect] };
                            logs.push({ type: 'warning', text: MSG.ENEMY_PHASE_STATUS_APPLIED(3, statusLabels[p3.statusEffect] || p3.statusEffect) });
                        } else if (resistRelic && random() < resistChance) {
                            logs.push({ type: 'success', text: MSG.ANCIENT_SEAL_RESIST });
                        }
                    }
                }
            }

            // Phase 2 (threshold: BALANCE.BOSS_PHASE2_THRESHOLD ± 10% 랜덤)
            if (updatedEnemy.phase2 && !updatedEnemy.phase2Triggered) {
                const baseThreshold = updatedEnemy.phase2.threshold ?? BALANCE.BOSS_PHASE2_THRESHOLD;
                const jitter = (random() - 0.5) * 0.2;
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
                        const resistRelic2 = relics.find((r) => r.effect === 'status_resist');
                        const resistChance2 = resistRelic2 ? (resistRelic2.val || 0) : 0;
                        const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
                        if (!currentStatus.includes(p2.statusEffect) && random() >= resistChance2) {
                            updatedPlayer = { ...updatedPlayer, status: [...currentStatus, p2.statusEffect] };
                            logs.push({ type: 'warning', text: MSG.ENEMY_PHASE_STATUS_APPLIED(2, statusLabels[p2.statusEffect] || p2.statusEffect) });
                        } else if (resistRelic2 && random() < resistChance2) {
                            logs.push({ type: 'success', text: MSG.ANCIENT_SEAL_RESIST });
                        }
                    }
                }
            }
        }

        if ((updatedEnemy.stunnedTurns || 0) > 0) {
            updatedEnemy.stunnedTurns! -= 1;
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
        const roll = random();
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
        const critBlockRelic = relics.find((relic) => relic.effect === 'crit_block');
        if (heavy && critBlockRelic && random() < critBlockRelic.val) {
            mult = 1;
            logs.push({ type: 'event', text: MSG.CRIT_BLOCK_PROC });
        }
        const heavyResolved = heavy && mult > 1;

        // 유물: 가시 갑옷 (reflect) — 피격 시 적에게 반사
        const reflectRelic = relics.find((r) => r.effect === 'reflect');
        // cycle 156: 시너지 'absolute_reflect' — 반사율 50%, 스턴 25% 확률. effect-name primary + bonus.reflect fallback.
        const absoluteReflectSyn = activeSynergies.find((s) =>
            s.bonus.effect === 'absolute_reflect' || s.bonus.reflect);
        const reflectMult = absoluteReflectSyn ? (absoluteReflectSyn.bonus.reflect || 0.3) : (reflectRelic ? reflectRelic.val : 0);
        const reflectDmg = (reflectRelic || absoluteReflectSyn) ? Math.floor(stats.def * reflectMult) : 0;
        const enemyHpAfterReflect = reflectDmg > 0 ? Math.max(0, (updatedEnemy.hp ?? 0) - reflectDmg) : (updatedEnemy.hp ?? 0);
        if (reflectDmg > 0) {
            updatedEnemy = { ...updatedEnemy, hp: enemyHpAfterReflect };
            logs.push({ type: 'event', text: MSG.REFLECT_DAMAGE_PROC(reflectDmg) });
            // 스턴 확률
            if (absoluteReflectSyn && random() < (absoluteReflectSyn.bonus.stunOnReflect || 0)) {
                updatedEnemy = { ...updatedEnemy, stunnedTurns: Math.max(updatedEnemy.stunnedTurns ?? 0, 1) };
                logs.push({ type: 'event', text: MSG.ABSOLUTE_REFLECT_STUN_PROC });
            }
        }

        // atkMult: blind / fear / curse에 의한 적 공격력 감소 (#5)
        const enemyAtkMult = updatedEnemy.atkMult ?? 1;
        const rawEnemyAtk = (updatedEnemy.atk ?? 0) * mult * enemyAtkMult;
        // 최소 피해량: 원래 공격력의 10% (DEF 스택으로 완전 무효화 방지, 고DEF 빌드 보상)
        const minEnemyDmg = Math.max(1, Math.floor(rawEnemyAtk * 0.10));
        let enemyDmg = Math.max(minEnemyDmg, Math.floor(rawEnemyAtk - stats.def));
        if (enemyAtkMult < 1 && ((updatedEnemy.blindTurns ?? 0) > 0 || (updatedEnemy.fearTurns ?? 0) > 0 || (updatedEnemy.cursedTurns ?? 0) > 0)) {
            const statusName = (updatedEnemy.blindTurns ?? 0) > 0 ? MSG.DOT_LABELS.blind : (updatedEnemy.fearTurns ?? 0) > 0 ? MSG.DOT_LABELS.fear : MSG.DOT_LABELS.curse;
            logs.push({ type: 'info', text: MSG.ENEMY_ATK_REDUCED_STATUS(statusName, updatedEnemy.name) });
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
            logs.push({ type: 'warning', text: MSG.PLAYER_CURSE_DMG_AMP(pct, before, enemyDmg) });
        }

        // cycle 162: 'titan' 유물 (타이탄의 허리띠) — val.critReduce 0.5 받는 치명타 피해 감소.
        //   cycle 149에서 hp 보너스만 적용했고 critReduce는 별도 사이클로 미뤘던 잔존.
        //   heavyResolved (heavy attack — boss/enemy의 강타) 상황을 enemy crit으로 해석.
        if (heavyResolved) {
            const titanRelic = relics.find((r) => r.effect === 'titan');
            const reduce = titanRelic?.val?.critReduce || 0;
            if (reduce > 0) {
                const before = enemyDmg;
                enemyDmg = Math.max(1, Math.floor(enemyDmg * (1 - reduce)));
                const pct = Math.round(reduce * 100);
                logs.push({ type: 'success', text: MSG.TITAN_CRIT_REDUCE_PROC(pct, before, enemyDmg) });
            }
        }

        // 2026-09 N3: `pattern.statusEffect` + `pattern.statusChance` 분기 제거 — MONSTERS의
        //   pattern 187개 중 두 키를 정의한 것이 0개라 한 번도 실행되지 않았다(조건이
        //   `updatedEnemy.pattern?.statusEffect`에서 단락되어 random()도 소비하지 않았으므로
        //   시드 스트림에도 영향 없음). 일반 적의 상태이상 부여는 아래 statusOnHit 경로가
        //   유일한 살아 있는 구현이다.

        const protectedResult = this.applyFatalProtection(updatedPlayer, relics, enemyDmg, logs, activeSynergies);

        // cycle 227: monster.statusOnHit dispatch — 27 monsters define statusOnHit (poison/curse/
        //   burn/freeze) but no handler. Heavy hit + 미보유 시 status 부여 (cycle 106 phase
        //   pattern과 정합). 일반 hit은 영향 없음 (모든 hit마다 적용은 너무 강함).
        //   status_resist relic 확률로 저항.
        const enemyStatusOnHit = (updatedEnemy as any).statusOnHit;
        if (heavyResolved && enemyStatusOnHit && !protectedResult.isDead) {
            const resistRelic = relics.find((r) => r.effect === 'status_resist');
            const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
            const currentStatus = Array.isArray(protectedResult.updatedPlayer.status) ? protectedResult.updatedPlayer.status : [];
            // A1 (2026-09 감사 G1) 밸런스 가드: spawnEnemy가 statusOnHit을 전파하기 전에는
            //   이 분기가 런타임에서 한 번도 실행되지 않았다(=프로파일 필드가 사장). 전파를
            //   복구하면서 "강타 적중 = 100% 상태이상"이 되면 초반 정예 조우가 과도해진다
            //   (측정: Lv1 정예 거미떼 500회 시뮬에서 시작 물약 2개 소진 13/500 → 73/500).
            //   H1(Wave 3) 이후 플레이어 status는 BALANCE.PLAYER_STATUS_DURATION_TURNS 턴 뒤
            //   tickCombatState에서 해제되므로 누적 부담이 유한하다. 그래도 강타마다 100%는
            //   과하므로 BALANCE.MONSTER_STATUS_ON_HIT_CHANCE로 발동 확률을 게이팅한다.
            //   저항 유물(status_resist)은 발동 이후 단계 그대로.
            if (!currentStatus.includes(enemyStatusOnHit) && random() < BALANCE.MONSTER_STATUS_ON_HIT_CHANCE) {
                if (random() >= resistChance) {
                    const statusLabels = MSG.DOT_LABELS;
                    protectedResult.updatedPlayer = {
                        ...protectedResult.updatedPlayer,
                        status: [...currentStatus, enemyStatusOnHit],
                    };
                    logs.push({
                        type: 'warning',
                        text: MSG.ENEMY_HEAVY_STATUS_ON_HIT(updatedEnemy.name, (statusLabels as Record<string, string>)[enemyStatusOnHit] || enemyStatusOnHit),
                    });
                } else {
                    logs.push({ type: 'success', text: MSG.ANCIENT_SEAL_RESIST });
                }
            }
        }

        // cycle 172: 'counter' (반격 자세) 스킬 — 피격 시 buff.counterChance 확률로 적에게 반격 추가타.
        //   tempBuff에 counterChance 필드가 있고 turn > 0이며 player가 살아있고 적도 살아있을 때만.
        let finalEnemy: any = { ...updatedEnemy, guarding: false };
        const playerBuff = (protectedResult.updatedPlayer as any).tempBuff;
        if (playerBuff?.counterChance > 0 && playerBuff.turn > 0
            && !protectedResult.isDead
            && (finalEnemy.hp ?? 0) > 0
            && random() < playerBuff.counterChance) {
            const counterDmg = Math.max(1, Math.floor(stats.atk));
            finalEnemy = { ...finalEnemy, hp: Math.max(0, (finalEnemy.hp ?? 0) - counterDmg) };
            logs.push({ type: 'event', text: MSG.PLAYER_COUNTER_PROC(playerBuff.name, finalEnemy.name, counterDmg) });
        }

        return {
            updatedPlayer: protectedResult.updatedPlayer,
            updatedEnemy: finalEnemy,
            damage: enemyDmg,
            isDead: protectedResult.isDead,
            isEnemyDead: !protectedResult.isDead && (finalEnemy.hp ?? 0) <= 0,
            isCrit: heavyResolved,
            logs: [...logs, {
                type: heavyResolved ? 'critical' : 'warning',
                text: heavyResolved
                    ? MSG.COMBAT_ENEMY_HEAVY_HIT(updatedEnemy.name, enemyDmg, random)
                    : MSG.COMBAT_ENEMY_HIT(updatedEnemy.name, enemyDmg, random)
            }]
        };
    },

    attemptEscape(enemy: Monster, stats: FullStats, rng?: () => number) {
        const random = typeof rng === 'function' ? rng : Math.random;
        const success = random() > BALANCE.ESCAPE_CHANCE;
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

    /**
     * 적의 다음 행동을 예측하여 텔레그래프 메시지를 반환합니다.
     * CombatPanel에서 UI 경고 표시에 사용.
     */
    predictEnemyNextAction(enemy: Monster) {
        if (!enemy || (enemy.hp ?? 0) <= 0) return null;
        if ((enemy.stunnedTurns || 0) > 0) return { type: 'stunned', label: MSG.ENEMY_TELEGRAPH_STUNNED, color: 'blue' };

        // 보스 Phase 2 전환 임박 체크
        const hpRatio = (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || (enemy.hp ?? 1));
        if (enemy.isBoss && !enemy.phase2Triggered && enemy.phase2 && hpRatio <= BALANCE.BOSS_PHASE2_THRESHOLD + 0.1) {
            return { type: 'phase2_imminent', label: MSG.ENEMY_TELEGRAPH_PHASE2_IMMINENT(enemy.phase2?.name), color: 'purple' };
        }

        const pattern = enemy.taunted
            ? { guardChance: 0, heavyChance: 1.0 }
            : (enemy.pattern || { guardChance: 0.2, heavyChance: 0.2 });

        // 가장 높은 확률 행동을 예측
        // slice 20: heavy 텔레그래프 라벨 '강타' → '맹공' — 플레이어 시작 스킬
        //   '강타'와 같은 화면에서 명칭이 충돌해 적 의도를 내 스킬 확률로 오독하던 문제.
        //   적 heavy hit 로그("맹렬하게 공격합니다")와 용어 통일.
        if (pattern.guardChance >= 0.5) return { type: 'guard', label: MSG.ENEMY_TELEGRAPH_GUARD_HIGH(Math.round(pattern.guardChance * 100)), color: 'blue' };
        if (pattern.heavyChance >= 0.4) return { type: 'heavy', label: MSG.ENEMY_TELEGRAPH_HEAVY_HIGH(Math.round(pattern.heavyChance * 100)), color: 'red' };
        if (pattern.guardChance >= 0.3) return { type: 'guard', label: MSG.ENEMY_TELEGRAPH_GUARD_MED(Math.round(pattern.guardChance * 100)), color: 'blue' };
        if (pattern.heavyChance >= 0.25) return { type: 'heavy', label: MSG.ENEMY_TELEGRAPH_HEAVY_MED(Math.round(pattern.heavyChance * 100)), color: 'orange' };
        return { type: 'normal', label: MSG.ENEMY_TELEGRAPH_NORMAL, color: 'gray' };
    },
};
