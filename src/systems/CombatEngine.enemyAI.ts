import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { CLASSES } from '../data/classes.js';
import type { FullStats, Monster, Player, Relic, RelicDotScope, RelicSynergy, StatusId } from '../types/index.js';
import { getRelicDotMult } from './CombatEngine.actions.js';
import type { LootLog } from './CombatEngine.loot.js';
import { getEnemyDebuffAtkLabel, getEnemyDebuffAtkMult, getPlayerStatusStacks, getStatusStackMult, isEnemyBlindActive, isEnemyTauntActive } from './CombatEngine.status.js';
import { getEnemyAttackElement, getEquipmentResistMult } from '../utils/equipmentPassives.js';
import {
    getActiveHeavyStatus, getLongFightEnrageBonus, getPhase2Threshold, getPhase3Threshold, getPhaseStatuses,
    isBreathAction, isBreathNext, isResistPierced,
} from './bossMechanics.js';

interface EnemyAttackResult {
    updatedPlayer: Player;
    updatedEnemy: Monster;
    damage: number;
    isDead: boolean;
    isEnemyDead?: boolean;
    isCrit?: boolean;
    logs: LootLog[];
}

interface EscapeResult {
    success: boolean;
    damage?: number;
    logs: LootLog[];
}

interface EnemyTelegraph {
    type: string;
    label: string;
    color: string;
}

/**
 * 이 mixin의 메서드가 `this`로 교차호출하는 CombatEngine 멤버.
 * CombatEngine.status/.relics 패턴과 동일 — 실제로 호출하는 2개만 최소 인터페이스로 선언한다.
 */
interface EnemyAIMixinContext {
    enemyAction(player: Player, enemy: Monster, stats: FullStats, random: () => number): EnemyAttackResult;
    tickEnemyStatus(enemy: Monster, logs: LootLog[], curseAmpMult: number, synergyDotMult: number, relicDotMults?: Partial<Record<RelicDotScope, number>>): { updatedEnemy: Monster; logs: LootLog[] };
    applyFatalProtection(
        player: Player,
        relics: Relic[],
        incomingDamage: number,
        logs: LootLog[],
        activeSynergies?: RelicSynergy[],
    ): { updatedPlayer: Player; isDead: boolean };
}

/** 이 mixin이 CombatEngine에 spread하는 메서드 시그니처. */
interface EnemyAIMixin {
    enemyAttack(player: Player, enemy: Monster, stats: FullStats, rng?: () => number): EnemyAttackResult;
    /** 적 행동 1번(행동 수는 이미 센 적을 받는다) — 소환 하수인의 공격은 `enemyAttack`이 그 뒤에 붙인다. */
    enemyAction(player: Player, enemy: Monster, stats: FullStats, random: () => number): EnemyAttackResult;
    /** 방어 자세 중에 맞은 보스의 반격(Wave 59, `mechanics.guardCounter`). 반격이 없으면 null. */
    resolveGuardCounter(player: Player, enemy: Monster, stats: FullStats): EnemyAttackResult | null;
    attemptEscape(enemy: Monster, stats: FullStats, rng?: () => number): EscapeResult;
    predictEnemyNextAction(enemy: Monster): EnemyTelegraph | null;
}

/** 적 공격 피해(방어 전 → 방어 뒤) — 최소 피해는 방어 전 피해의 ENEMY_MIN_DMG_RATIO(방어력으로 완전히 막지 못한다). */
const enemyHitAfterDefense = (raw: number, def: number) => {
    const minDmg = Math.max(1, Math.floor(raw * BALANCE.ENEMY_MIN_DMG_RATIO));
    return Math.max(minDmg, Math.floor(raw - def));
};

/**
 * 받는 피해 보정 — 원소 저항 장비(Wave 57) → 저주(Wave 59부터 중첩) → 조합의 대가(Wave 50) 순서. 적 공격 · 보스 반격 · 소환 공격이
 * 같은 순서를 쓴다. 저항 무력화 페이즈(`isResistPierced`)에서는 원소 저항이 통하지 않는다. 난수를 쓰지 않는다.
 */
const applyIncomingDamageMods = (
    damage: number,
    enemy: Monster,
    player: Player,
    stats: FullStats,
    logs: LootLog[],
    { elemental = true, quiet = false }: { elemental?: boolean; quiet?: boolean } = {},
) => {
    let out = damage;
    if (elemental) {
        // 2026-10 Wave 57: 원소 저항 장비 — 적 공격의 원소는 적 자신의 원소다(소유자 결정). 그 원소를 막는 장비가 있으면
        //   받는 피해 × BALANCE.EQUIP_ELEMENT_RESIST_MULT(50% 감소). 이전에는 장비 설명("불에 강한", "모든 원소를 저항")만 있었다.
        const attackElement = getEnemyAttackElement(enemy);
        const elementResistMult = isResistPierced(enemy) ? 1 : getEquipmentResistMult(stats.elementResists, attackElement);
        if (attackElement && elementResistMult < 1) {
            const before = out;
            out = Math.max(1, Math.floor(out * elementResistMult));
            logs.push({ type: 'success', text: MSG.EQUIP_ELEMENT_RESIST_PROC(attackElement, Math.round((1 - elementResistMult) * 100), before, out) });
        }
    }

    // cycle 108: 플레이어 curse 상태이상 — 받는 피해 증폭 (BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT).
    //   2026-10 Wave 59: 보스 "저주 중첩" — 중첩마다 증폭분이 STATUS_STACK_BONUS만큼 커진다(1중첩은 이전과 같은 +30%).
    const curseStacks = getPlayerStatusStacks(player, 'curse');
    if (curseStacks > 0) {
        const ampMult = 1 + ((BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT || 1.3) - 1) * getStatusStackMult(curseStacks);
        const before = out;
        out = Math.floor(out * ampMult);
        if (!quiet) logs.push({ type: 'warning', text: MSG.PLAYER_CURSE_DMG_AMP(Math.round((ampMult - 1) * 100), before, out) });
    }

    // 2026-09 Wave 50: 조합의 대가 — 받는 피해 증가(statsCalculator가 활성 조합에서 모은 배율). 난수를 쓰지 않는다.
    const synergyDamageTakenMult = stats.damageTakenMult ?? 1;
    if (synergyDamageTakenMult !== 1) out = Math.max(1, Math.floor(out * synergyDamageTakenMult));
    return out;
};

/**
 * 보스가 플레이어에게 상태를 건다(Wave 59) — 페이즈 전환 · 2페이즈 강타 · 브레스가 같은 규칙을 쓴다.
 *  - 저항 유물(`resistChance` > 0)이 있을 때만 난수 1번으로 저항을 판정한다. 이전 페이즈 경로는 유물이 없어도 난수를 썼고,
 *    이미 걸린 상태에서도 저항 로그를 따로 굴렸다.
 *  - `maxStacks`가 없으면 걸려 있지 않을 때만 건다. 있으면 쌓는다 — 빙결은 냉기를 쌓아 그 수에 닿을 때 얼고,
 *    지속 피해 · 저주는 중첩이 올라가며 지속 턴이 처음으로 돌아간다.
 */
const applyBossStatus = (
    player: Player,
    status: StatusId,
    logs: LootLog[],
    appliedText: (label: string) => string,
    { resistChance, maxStacks, random }: { resistChance: number; maxStacks?: number; random: () => number },
): Player => {
    const label = MSG.DOT_LABELS[status] || status;
    const list: StatusId[] = Array.isArray(player.status) ? player.status : [];
    const present = list.includes(status);
    const stackable = typeof maxStacks === 'number' && maxStacks > 1;
    if (present && (!stackable || status === 'freeze')) return player;
    if (resistChance > 0 && random() < resistChance) {
        logs.push({ type: 'success', text: MSG.ANCIENT_SEAL_RESIST });
        return player;
    }
    const statusTurns = { ...(player.statusTurns || {}), [status]: BALANCE.PLAYER_STATUS_DURATION_TURNS };
    if (stackable && status === 'freeze') {
        const frost = (player.combatFlags?.frostStacks ?? 0) + 1;
        if (frost < maxStacks!) {
            logs.push({ type: 'warning', text: MSG.PLAYER_FROST_BUILDUP(frost, maxStacks!) });
            return { ...player, combatFlags: { ...(player.combatFlags || {}), frostStacks: frost } };
        }
        logs.push({ type: 'warning', text: MSG.PLAYER_FROZEN_BY_FROST });
        return { ...player, status: [...list, status], statusTurns, combatFlags: { ...(player.combatFlags || {}), frostStacks: 0 } };
    }
    if (!present) {
        logs.push({ type: 'warning', text: appliedText(label) });
        const next: Player = { ...player, status: [...list, status], statusTurns };
        if (player.statusStacks?.[status] !== undefined) {
            const { [status]: _stale, ...rest } = player.statusStacks;
            next.statusStacks = rest;
        }
        return next;
    }
    const current = getPlayerStatusStacks(player, status);
    const stacks = Math.min(maxStacks!, current + 1);
    // 최대 중첩이면 지속 턴만 처음으로 돌린다(세지지 않으니 알리지 않는다).
    if (stacks > current) logs.push({ type: 'warning', text: MSG.PLAYER_STATUS_STACKED(label, stacks) });
    return { ...player, statusTurns, statusStacks: { ...(player.statusStacks || {}), [status]: stacks } };
};

/**
 * CombatEngine 적 행동/예측 메서드 (enemyAttack / attemptEscape / predictEnemyNextAction)
 * — mixin으로 CombatEngine에 spread. CombatEngine.ts 분리(행동 보존).
 * this 교차호출(tickEnemyStatus / applyFatalProtection)은 위 EnemyAIMixinContext로 명시하고,
 * 실제 바인딩은 CombatEngine.ts가 이 mixin을 spread하는 시점에 이뤄진다(ThisType 마커).
 */
export const enemyAIMethods: EnemyAIMixin & ThisType<EnemyAIMixinContext> = {
    enemyAttack(player, enemy, stats, rng) {
        const random = typeof rng === 'function' ? rng : Math.random;
        // 2026-10 Wave 59: 이번 행동을 센다 — 브레스 주기 · 장기전이 읽는다(기절 · 방어 턴도 행동이다).
        const actingEnemy: Monster = { ...enemy, actionCount: (enemy.actionCount ?? 0) + 1 };
        const result = this.enemyAction(player, actingEnemy, stats, random);

        // 소환된 하수인(망자)이 함께 친다 — 이번 행동 전에 있던 수만큼(이번 행동에 깨어난 하수인은 다음 행동부터).
        const summons = Math.max(0, enemy.summons ?? 0);
        const summon = result.updatedEnemy.mechanics?.summon;
        if (!summon || summons === 0 || result.isDead || result.isEnemyDead) return result;
        const logs = [...result.logs];
        const perHit = enemyHitAfterDefense((result.updatedEnemy.atk ?? 0) * summon.hitMult, stats.def);
        const total = applyIncomingDamageMods(perHit * summons, result.updatedEnemy, result.updatedPlayer, stats, logs, { elemental: false, quiet: true });
        const protectedResult = this.applyFatalProtection(result.updatedPlayer, stats.relics || [], total, logs, stats.activeSynergies || []);
        logs.push({ type: 'warning', text: MSG.ENEMY_SUMMON_HIT(summon.name, summons, total) });
        return {
            ...result,
            updatedPlayer: protectedResult.updatedPlayer,
            damage: result.damage + total,
            isDead: protectedResult.isDead,
            logs,
        };
    },

    resolveGuardCounter(player, enemy, stats) {
        const counter = enemy.mechanics?.guardCounter;
        if (!counter || (enemy.hp ?? 0) <= 0) return null;
        const logs: LootLog[] = [];
        const raw = (enemy.atk ?? 0) * counter.mult * getEnemyDebuffAtkMult(enemy) * (1 + getLongFightEnrageBonus(enemy));
        const damage = applyIncomingDamageMods(enemyHitAfterDefense(raw, stats.def), enemy, player, stats, logs);
        const protectedResult = this.applyFatalProtection(player, stats.relics || [], damage, logs, stats.activeSynergies || []);
        logs.push({ type: 'critical', text: MSG.ENEMY_GUARD_COUNTER_HIT(enemy.name, damage) });
        return {
            updatedPlayer: protectedResult.updatedPlayer,
            updatedEnemy: enemy,
            damage,
            isDead: protectedResult.isDead,
            isCrit: true,
            logs,
        };
    },

    enemyAction(player, enemy, stats, random) {
        let updatedEnemy: Monster = { ...enemy };
        let updatedPlayer: Player = { ...player };
        const logs: LootLog[] = [];
        // relics 선언을 함수 상단으로 (Phase 전환 블록에서 use-before-declaration 방지).
        const relics = stats.relics || [];

        // ── 적 상태이상 틱 처리 (#5) ──────────────────────────────────────
        // curse_amp 패시브: 무당/시간술사 직업 보너스
        const curseAmpPassive = CLASSES[player.job as string]?.skills?.find((s) => s.passive && s.effect === 'curse_amp');
        const curseAmpMult = curseAmpPassive ? (curseAmpPassive.val || 1) : 1;
        // cycle 153: 시너지 'death_oracle' — dotMult DoT 피해 증폭.
        const activeSynergies = stats.activeSynergies || [];
        const synergyDotMult = activeSynergies.reduce((acc: number, syn) =>
            (syn.bonus.effect === 'death_oracle' ? acc + (syn.bonus.dotMult || 0)
                : syn.bonus.dotMult ? acc + syn.bonus.dotMult
                : acc),
            1);
        // 2026-09 Wave 44: 약화(실명 · 공포 · 저주 · 도발)는 틱 전 상태로 이번 행동에 적용한다 — "N턴"은
        //   영향받는 적 행동 N번이다. 틱 뒤 상태로 읽던 동안 "3턴" 공포는 공격 2번, "2턴" 연막탄은 1번만 줄였다
        //   (기절은 이미 N번 — 행동 판정에서 줄인다).
        const debuffAtkMult = getEnemyDebuffAtkMult(enemy);
        const debuffAtkLabel = getEnemyDebuffAtkLabel(enemy);
        const tauntActive = isEnemyTauntActive(enemy);
        const blindActive = isEnemyBlindActive(enemy);
        // 2026-10 Wave 56: 지속 피해 유물은 틱에도 붙는다(대상별 — 죽음의 낙인은 독 · 화상만).
        const relicDotMults = {
            burn: getRelicDotMult(relics, 'burn'), poison: getRelicDotMult(relics, 'poison'),
            bleed: getRelicDotMult(relics, 'bleed'), curse: getRelicDotMult(relics, 'curse'),
        };
        const enemyTickResult = this.tickEnemyStatus(updatedEnemy, [], curseAmpMult, synergyDotMult, relicDotMults);
        updatedEnemy = enemyTickResult.updatedEnemy;
        enemyTickResult.logs.forEach((l) => logs.push(l));
        // DoT로 인해 이미 사망한 경우
        if ((updatedEnemy.hp ?? 0) <= 0) {
            return { updatedPlayer, updatedEnemy, damage: 0, isDead: false, isEnemyDead: true, logs };
        }

        // cycle 226: 장비 evasion roll — 2 armors(암영 망토 / 공허의 전투 외투)의 evasion 필드가
        //   desc_stat에 '회피+N%'를 표시하지만 dispatch path 0건이던 silent dead config fix.
        //   stealth(skill) 후순위로 평가 — 은신은 명시적 발동, evasion은 passive armor 효과.
        //   cycle 222-225 silent dead config 시리즈 마지막 합류.
        //   2026-10 Wave 53: 은신은 적의 방어 자세 판정 뒤에서 실제 공격만 막는다 — 은신 중에는 여기서 장비 회피를
        //   굴리지 않고 은신 판정 뒤로 넘긴다(은신 우선 순서 유지). 은신이 아닐 때의 난수 순서는 그대로다.
        const armorEvasion = updatedPlayer.equip?.armor?.evasion || 0;
        // 2026-10 Wave 56: 그림자 망토의 첫 공격 회피도 은신처럼 방어 자세 판정 뒤에서 확정 회피한다 — 그 앞의 장비 회피는 굴리지 않는다.
        const cloakPending = Boolean(updatedPlayer.combatFlags?.cloakEvadePending)
            && relics.some((relic) => relic.effect === 'first_turn_evade');
        const stealthActive = (updatedPlayer.combatFlags?.stealthHits ?? 0) > 0 || Boolean(updatedPlayer.nextHitEvaded) || cloakPending;
        if (!stealthActive && armorEvasion > 0 && random() < armorEvasion) {
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: MSG.ARMOR_EVADE_PROC(enemy.name) }]
            };
        }

        // ── Phase 전환 체크 (보스 + 엘리트 통합) ───────────────────
        // 2026-10 Wave 59: 문턱은 데이터 값 그대로이고(2페이즈 기본 50% — 이전에는 적 행동마다 40~60%를 새로 뽑았다),
        //   2페이즈를 먼저 · 3페이즈를 뒤에 적용한다 — 한 행동에 두 문턱을 함께 넘으면 3페이즈의 이름 · 패턴이 남는다(이전에는
        //   3페이즈를 먼저 적용한 뒤 2페이즈가 덮어써 "종말의 마왕"이 "분노한 마왕"의 강타 확률로 싸웠다).
        if (updatedEnemy.isBoss || updatedEnemy.isElite) {
            const hpRatio = (updatedEnemy.hp ?? 0) / Math.max(1, updatedEnemy.maxHp || (updatedEnemy.hp ?? 1));
            const relicResist = relics.find((r) => r.effect === 'status_resist')?.val || 0;
            const applyPhaseStatuses = (phase: NonNullable<Monster['phase2']>, phaseNo: number) => {
                getPhaseStatuses(phase).forEach((status) => {
                    updatedPlayer = applyBossStatus(
                        updatedPlayer,
                        status,
                        logs,
                        (label) => MSG.ENEMY_PHASE_STATUS_APPLIED(phaseNo, label),
                        { resistChance: phase.pierceResist ? 0 : relicResist, random },
                    );
                });
            };

            if (updatedEnemy.phase2 && !updatedEnemy.phase2Triggered
                && hpRatio <= getPhase2Threshold(updatedEnemy, BALANCE.BOSS_PHASE2_THRESHOLD)) {
                const p2 = updatedEnemy.phase2;
                updatedEnemy = {
                    ...updatedEnemy,
                    name: p2.name,
                    atk: Math.floor((updatedEnemy.atk ?? 0) * (1 + (p2.atkBonus ?? 0))),
                    pattern: { ...(updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 }), ...p2.pattern },
                    phase2Triggered: true,
                };
                logs.push({ type: 'warning', text: `⚡ ${p2.log}` });
                // Wave 59 "망자 소환" — 2페이즈 전환 때 깨어나 다음 행동부터 함께 친다.
                const summon = updatedEnemy.mechanics?.summon;
                if (summon) {
                    updatedEnemy = { ...updatedEnemy, summons: summon.count };
                    logs.push({ type: 'critical', text: MSG.ENEMY_SUMMON(updatedEnemy.name, summon.name, summon.count) });
                }
                applyPhaseStatuses(p2, 2);
            }

            // Phase 3 (원시의 신 등 3페이즈 보스, 기본 문턱 25%)
            if (updatedEnemy.phase3 && !updatedEnemy.phase3Triggered && hpRatio <= getPhase3Threshold(updatedEnemy)) {
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
                applyPhaseStatuses(p3, 3);
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
        const effectivePattern = tauntActive
            ? { guardChance: 0, heavyChance: 1.0 }
            : (updatedEnemy.pattern || { guardChance: 0.2, heavyChance: 0.2 });

        const pattern = effectivePattern;
        const mechanics = updatedEnemy.mechanics;
        // 2026-10 Wave 59 "브레스" — `every`번째 행동은 방어 판정 없이 브레스다(행동 판정 난수는 그대로 1번 쓴다).
        const breathTurn = isBreathAction(updatedEnemy);
        const roll = random();
        if (!breathTurn && roll < pattern.guardChance) {
            let guardEnemy: Monster = { ...updatedEnemy, guarding: true };
            const guardLogs: LootLog[] = [...logs, {
                type: 'warning',
                // Wave 59 "강한 카운터" — 반격하는 보스는 방어 자세가 곧 반격 자세다(지금 공격하면 반격당한다).
                text: mechanics?.guardCounter
                    ? MSG.ENEMY_GUARD_COUNTER_STANCE(updatedEnemy.name)
                    : MSG.COMBAT_ENEMY_GUARD(updatedEnemy.name),
            }];
            // Wave 59 "회복 압박" — 방어 자세마다 최대 생명의 guardHeal만큼 회복한다.
            const healRatio = mechanics?.guardHeal ?? 0;
            const maxHp = guardEnemy.maxHp || guardEnemy.hp || 0;
            if (healRatio > 0 && (guardEnemy.hp ?? 0) < maxHp) {
                const before = guardEnemy.hp ?? 0;
                const healed = Math.min(maxHp, before + Math.max(1, Math.floor(maxHp * healRatio)));
                guardEnemy = { ...guardEnemy, hp: healed };
                guardLogs.push({ type: 'warning', text: MSG.ENEMY_GUARD_HEAL(guardEnemy.name, healed - before) });
            }
            return {
                updatedPlayer,
                updatedEnemy: guardEnemy,
                damage: 0,
                isDead: false,
                logs: guardLogs,
            };
        }

        // ── 그림자 망토 (Wave 56) — 이번 전투의 첫 실제 공격을 반드시 피한다. 은신보다 먼저 쓴다(은신 횟수를 아낀다).
        if (cloakPending) {
            updatedPlayer = { ...updatedPlayer, combatFlags: { ...(updatedPlayer.combatFlags || {}), cloakEvadePending: false } };
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: MSG.CLOAK_EVADE_PROC(enemy.name) }]
            };
        }

        // ── 은신 회피 (Wave 53) ─────────────────────────────────────────────
        // "적 공격 N번"은 실제 공격만 센다 — 기절 · 방어 자세 턴은 은신을 쓰지 않는다(이전에는 그 턴에도 회피가
        //   소진됐다). 첫 공격은 반드시 피하고, 그 뒤는 `stealthChance` 확률이다(1이면 난수를 쓰지 않는다).
        const playerFlags = updatedPlayer.combatFlags || {};
        if ((playerFlags.stealthHits ?? 0) > 0) {
            const chance = playerFlags.stealthChance ?? 1;
            const evaded = playerFlags.stealthFirstPending !== false || chance >= 1 || random() < chance;
            updatedPlayer = {
                ...updatedPlayer,
                combatFlags: { ...playerFlags, stealthHits: (playerFlags.stealthHits ?? 0) - 1, stealthFirstPending: false },
            };
            if (evaded) {
                return {
                    updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                    logs: [...logs, { type: 'success', text: MSG.STEALTH_EVADE_PROC(enemy.name) }]
                };
            }
            logs.push({ type: 'warning', text: MSG.STEALTH_EVADE_MISS(enemy.name) });
            // 은신이 들킨 공격에도 장비 회피는 그대로 기회가 있다(은신 → 장비 순서).
            if (armorEvasion > 0 && random() < armorEvasion) {
                return {
                    updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                    logs: [...logs, { type: 'success', text: MSG.ARMOR_EVADE_PROC(enemy.name) }]
                };
            }
        } else if (updatedPlayer.nextHitEvaded) {
            // 이전 저장(Wave 53 전)의 1회 회피 표시 — 새로 세우는 곳은 없다.
            updatedPlayer = { ...updatedPlayer, nextHitEvaded: false };
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: MSG.STEALTH_EVADE_PROC(enemy.name) }]
            };
        }

        // 2026-10 Wave 55: 실명은 명중률 하락이다 — 이번 공격이 BLIND_ENEMY_MISS_CHANCE 확률로 빗나간다(틱 전 상태로 판정).
        //   이전에는 공격력 ×0.65였다(기대 피해는 같다). 방어 자세 · 은신 판정 뒤라 실제 공격에만 굴린다.
        if (blindActive && random() < BALANCE.BLIND_ENEMY_MISS_CHANCE) {
            return {
                updatedPlayer, updatedEnemy, damage: 0, isDead: false,
                logs: [...logs, { type: 'success', text: MSG.ENEMY_BLIND_MISS(enemy.name) }]
            };
        }

        const heavy = breathTurn || roll < pattern.guardChance + pattern.heavyChance;
        let mult = breathTurn ? (mechanics?.breath?.mult ?? 1.4) : heavy ? 1.4 : 1;
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

        // blind / fear / curse에 의한 적 공격력 감소 (#5) — 이번 행동 시작 때 걸려 있던 약화 중 가장 강한 것.
        const enemyAtkMult = debuffAtkMult;
        // 2026-10 Wave 59 "장기전은 손해" — afterActions번째 행동 뒤로 행동마다 공격력이 오른다(시작할 때와 상한에 닿을 때 알린다).
        const enrageBonus = getLongFightEnrageBonus(updatedEnemy);
        if (enrageBonus > 0) {
            const previousBonus = getLongFightEnrageBonus({ ...updatedEnemy, actionCount: (updatedEnemy.actionCount ?? 1) - 1 });
            const enrageMax = mechanics?.longFightEnrage?.max ?? enrageBonus;
            if (previousBonus === 0 || (enrageBonus >= enrageMax && previousBonus < enrageMax)) {
                logs.push({ type: 'warning', text: MSG.ENEMY_LONG_FIGHT_ENRAGE(updatedEnemy.name, Math.round(enrageBonus * 100)) });
            }
        }
        const rawEnemyAtk = (updatedEnemy.atk ?? 0) * mult * enemyAtkMult * (1 + enrageBonus);
        // 최소 피해량: 원래 공격력의 10% (DEF 스택으로 완전 무효화 방지, 고DEF 빌드 보상)
        let enemyDmg = enemyHitAfterDefense(rawEnemyAtk, stats.def);
        if (enemyAtkMult < 1 && debuffAtkLabel) {
            logs.push({ type: 'info', text: MSG.ENEMY_ATK_REDUCED_STATUS(MSG.DOT_LABELS[debuffAtkLabel], updatedEnemy.name) });
        }

        // 원소 저항 장비 → 저주 → 조합의 대가(Wave 59에 보스 반격 · 소환 공격과 같은 함수로 묶었다 — 순서 · 로그는 그대로).
        enemyDmg = applyIncomingDamageMods(enemyDmg, updatedEnemy, updatedPlayer, stats, logs);

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

        // 2026-10 Wave 56: 운명의 거울 "받은 피해의 30%를 적에게" — 이전에는 읽는 곳이 없었다(치명타 확률만 동작).
        //   절대 반사 조합(거울 + 가시 갑옷)의 "반사 피해 50%"는 두 반사 모두의 비율이다. 난수를 쓰지 않는다.
        const mirrorRelic = relics.find((r) => r.effect === 'reflect_crit');
        if (mirrorRelic && enemyDmg > 0 && (updatedEnemy.hp ?? 0) > 0) {
            const mirrorRatio = absoluteReflectSyn ? (absoluteReflectSyn.bonus.reflect || mirrorRelic.val.reflect) : mirrorRelic.val.reflect;
            const mirrorDmg = Math.floor(enemyDmg * mirrorRatio);
            if (mirrorDmg > 0) {
                updatedEnemy = { ...updatedEnemy, hp: Math.max(0, (updatedEnemy.hp ?? 0) - mirrorDmg) };
                logs.push({ type: 'event', text: MSG.MIRROR_REFLECT_PROC(mirrorDmg) });
            }
        }

        const protectedResult = this.applyFatalProtection(updatedPlayer, relics, enemyDmg, logs, activeSynergies);

        // cycle 227: monster.statusOnHit dispatch — 27 monsters define statusOnHit (poison/curse/
        //   burn/freeze) but no handler. Heavy hit + 미보유 시 status 부여 (cycle 106 phase
        //   pattern과 정합). 일반 hit은 영향 없음 (모든 hit마다 적용은 너무 강함).
        //   status_resist relic 확률로 저항.
        const enemyStatusOnHit = updatedEnemy.statusOnHit;
        if (heavyResolved && enemyStatusOnHit && !protectedResult.isDead) {
            const resistRelic = relics.find((r) => r.effect === 'status_resist');
            const resistChance = resistRelic ? (resistRelic.val || 0) : 0;
            const currentStatus: StatusId[] = Array.isArray(protectedResult.updatedPlayer.status) ? protectedResult.updatedPlayer.status : [];
            // statusOnHit: string(Monster 실측은 StatusId 부분집합 — monsters.ts 27종은 poison/
            //   curse/burn/freeze만 정의하지만 필드 자체는 도메인을 좁히지 않는다).
            const hitStatus = enemyStatusOnHit as StatusId;
            // A1 (2026-09 감사 G1) 밸런스 가드: spawnEnemy가 statusOnHit을 전파하기 전에는
            //   이 분기가 런타임에서 한 번도 실행되지 않았다(=프로파일 필드가 사장). 전파를
            //   복구하면서 "강타 적중 = 100% 상태이상"이 되면 초반 정예 조우가 과도해진다
            //   (측정: Lv1 정예 거미떼 500회 시뮬에서 시작 물약 2개 소진 13/500 → 73/500).
            //   H1(Wave 3) 이후 플레이어 status는 BALANCE.PLAYER_STATUS_DURATION_TURNS 턴 뒤
            //   tickCombatState에서 해제되므로 누적 부담이 유한하다. 그래도 강타마다 100%는
            //   과하므로 BALANCE.MONSTER_STATUS_ON_HIT_CHANCE로 발동 확률을 게이팅한다.
            //   저항 유물(status_resist)은 발동 이후 단계 그대로.
            if (!currentStatus.includes(hitStatus) && random() < BALANCE.MONSTER_STATUS_ON_HIT_CHANCE) {
                if (random() >= resistChance) {
                    const statusLabels = MSG.DOT_LABELS;
                    protectedResult.updatedPlayer = {
                        ...protectedResult.updatedPlayer,
                        status: [...currentStatus, hitStatus],
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

        // 2026-10 Wave 59: 보스의 2페이즈 강타가 거는 상태("누적 · 연속 기절 · 제어")와 브레스의 상태.
        const pierced = isResistPierced(updatedEnemy);
        const relicResistChance = pierced ? 0 : (relics.find((r) => r.effect === 'status_resist')?.val || 0);
        const heavyStatus = getActiveHeavyStatus(updatedEnemy);
        if (heavyResolved && heavyStatus && !protectedResult.isDead
            && (heavyStatus.chance >= 1 || random() < heavyStatus.chance)) {
            protectedResult.updatedPlayer = applyBossStatus(
                protectedResult.updatedPlayer,
                heavyStatus.status,
                logs,
                (label) => MSG.ENEMY_HEAVY_STATUS_ON_HIT(updatedEnemy.name, label),
                { resistChance: relicResistChance, maxStacks: heavyStatus.maxStacks, random },
            );
        }
        const breathStatus = breathTurn ? mechanics?.breath?.status : undefined;
        if (breathStatus && !protectedResult.isDead) {
            protectedResult.updatedPlayer = applyBossStatus(
                protectedResult.updatedPlayer,
                breathStatus,
                logs,
                (label) => MSG.ENEMY_HEAVY_STATUS_ON_HIT(updatedEnemy.name, label),
                { resistChance: relicResistChance, random },
            );
        }

        // cycle 172: 'counter' (반격 자세) 스킬 — 피격 시 buff.counterChance 확률로 적에게 반격 추가타.
        //   tempBuff에 counterChance 필드가 있고 turn > 0이며 player가 살아있고 적도 살아있을 때만.
        let finalEnemy: Monster = { ...updatedEnemy, guarding: false };
        const playerBuff = protectedResult.updatedPlayer.tempBuff;
        if ((playerBuff?.counterChance ?? 0) > 0 && (playerBuff?.turn ?? 0) > 0
            && !protectedResult.isDead
            && (finalEnemy.hp ?? 0) > 0
            && random() < (playerBuff?.counterChance ?? 0)) {
            const counterDmg = Math.max(1, Math.floor(stats.atk));
            finalEnemy = { ...finalEnemy, hp: Math.max(0, (finalEnemy.hp ?? 0) - counterDmg) };
            // playerBuff는 위 조건(counterChance > 0)이 참일 때만 여기 도달 — 실존 보장.
            logs.push({ type: 'event', text: MSG.PLAYER_COUNTER_PROC(String(playerBuff!.name), finalEnemy.name, counterDmg) });
        }

        return {
            updatedPlayer: protectedResult.updatedPlayer,
            updatedEnemy: finalEnemy,
            damage: enemyDmg,
            isDead: protectedResult.isDead,
            isEnemyDead: !protectedResult.isDead && (finalEnemy.hp ?? 0) <= 0,
            isCrit: heavyResolved,
            logs: [...logs, {
                type: heavyResolved || breathTurn ? 'critical' : 'warning',
                text: breathTurn
                    ? MSG.ENEMY_BREATH_HIT(updatedEnemy.name, enemyDmg)
                    : heavyResolved
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

        // Wave 50: 도주 실패 피해도 적에게 받는 피해다 — 조합의 대가(받는 피해 증가)를 같이 받는다.
        //   Wave 57: 같은 이유로 원소 저항 장비도 적용한다.
        const resistMult = isResistPierced(enemy) ? 1 : getEquipmentResistMult(stats.elementResists, getEnemyAttackElement(enemy));
        const enemyDmg = Math.max(1, Math.floor(Math.max(1, (enemy.atk ?? 0) - stats.def) * (stats.damageTakenMult ?? 1) * resistMult));
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

        // 보스 페이즈 전환 임박 — 문턱 + 10% 안이면 알린다. 다음 행동이 두 문턱을 함께 넘으면(또는 이미 2페이즈면) 3페이즈를 알린다
        //   (Wave 59: 이전에는 3페이즈 문턱에서도 2페이즈 값을 보였는데 다음 행동은 3페이즈 값으로 굴렀다).
        const hpRatio = (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || (enemy.hp ?? 1));
        const phase2Pending = Boolean(enemy.phase2 && !enemy.phase2Triggered);
        const phase3Pending = Boolean(enemy.phase3 && !enemy.phase3Triggered);
        const phase3Threshold = getPhase3Threshold(enemy);
        if (enemy.isBoss && phase3Pending && hpRatio <= phase3Threshold + 0.1 && (!phase2Pending || hpRatio <= phase3Threshold)) {
            return { type: 'phase3_imminent', label: MSG.ENEMY_TELEGRAPH_PHASE3_IMMINENT(enemy.phase3?.name), color: 'purple' };
        }
        if (enemy.isBoss && phase2Pending && hpRatio <= getPhase2Threshold(enemy, BALANCE.BOSS_PHASE2_THRESHOLD) + 0.1) {
            return { type: 'phase2_imminent', label: MSG.ENEMY_TELEGRAPH_PHASE2_IMMINENT(enemy.phase2?.name), color: 'purple' };
        }

        // Wave 59: 다음 행동이 브레스면 브레스를 알린다(행동 판정과 같은 `isBreathNext`).
        if (isBreathNext(enemy)) return { type: 'breath', label: MSG.ENEMY_TELEGRAPH_BREATH, color: 'red' };

        const pattern = isEnemyTauntActive(enemy)
            ? { guardChance: 0, heavyChance: 1.0 }
            : (enemy.pattern || { guardChance: 0.2, heavyChance: 0.2 });

        // 알릴 만한 행동(방어 ≥30% · 맹공 ≥25%) 가운데 확률이 높은 쪽을 예측한다 — 같으면 맹공.
        // slice 20: heavy 텔레그래프 라벨 '강타' → '맹공' — 플레이어 시작 스킬
        //   '강타'와 같은 화면에서 명칭이 충돌해 적 의도를 내 스킬 확률로 오독하던 문제.
        //   적 heavy hit 로그("맹렬하게 공격합니다")와 용어 통일.
        // 2026-10 Wave 59: 이전에는 방어(≥30%)를 맹공(25~40%)보다 먼저 봐서 방어 32% · 맹공 35%인 스핑크스가 "방어 가능 (32%)"였다.
        const guardPct = Math.round(pattern.guardChance * 100);
        const heavyPct = Math.round(pattern.heavyChance * 100);
        const guardLabel = pattern.guardChance >= 0.5 ? MSG.ENEMY_TELEGRAPH_GUARD_HIGH(guardPct)
            : pattern.guardChance >= 0.3 ? MSG.ENEMY_TELEGRAPH_GUARD_MED(guardPct) : null;
        const heavyTelegraph = pattern.heavyChance >= 0.4 ? { label: MSG.ENEMY_TELEGRAPH_HEAVY_HIGH(heavyPct), color: 'red' }
            : pattern.heavyChance >= 0.25 ? { label: MSG.ENEMY_TELEGRAPH_HEAVY_MED(heavyPct), color: 'orange' } : null;
        if (heavyTelegraph && (!guardLabel || pattern.heavyChance >= pattern.guardChance)) {
            return { type: 'heavy', label: heavyTelegraph.label, color: heavyTelegraph.color };
        }
        if (guardLabel) return { type: 'guard', label: guardLabel, color: 'blue' };
        return { type: 'normal', label: MSG.ENEMY_TELEGRAPH_NORMAL, color: 'gray' };
    },
};
