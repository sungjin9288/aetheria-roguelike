import { MSG } from '../data/messages.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import type { Monster, Player, RelicSynergy, RelicSynergyBonus, RelicSynergyEffect } from '../types/index.js';

/**
 * 행동 조합(2026-11 H4, 소유자 결정 Q1 ~ Q4 (a)) — 늘 켜진 수치 대신 "어떤 행동을 어떤 순간에 하면 강해지는" 두 조각 조합 6개.
 *
 * 판정은 이 파일 하나가 소유하고 엔진(공격 · 기술 · 소모품 차례 · 적 행동)과 전투 칩이 같이 읽는다. 읽는 것은 켜진 조합,
 * 전투 플래그의 세는 수(`afterSkill` · `beatCount` · `potionReady` · `crossGuard`), 적 상태(기절 · 생명 · 충전)뿐이고 **난수를
 * 쓰지 않는다** — 확정 치명타도 치명 판정 난수 한 번은 그대로 쓴다(뒤의 난수열이 밀리지 않는다). 플래그는 그 조합이 켜져
 * 있을 때만 세운다(조합이 없는 플레이어의 상태는 이전과 같다). 전투 범위다 — 전투 시작과 `endCombatScope`가 비운다.
 */

type CombatFlags = NonNullable<Player['combatFlags']>;

/** 이 파일이 판정하는 조합 효과 6개. */
export type BehaviorComboEffect = Extract<
    RelicSynergyEffect,
    'cross_rhythm' | 'break_strike' | 'void_pursuit' | 'battle_alchemy' | 'third_beat' | 'finisher'
>;

export const BEHAVIOR_COMBO_EFFECTS: readonly BehaviorComboEffect[] = Object.freeze([
    'cross_rhythm', 'break_strike', 'void_pursuit', 'battle_alchemy', 'third_beat', 'finisher',
]);

/** 행동 조합이 쓰는 전투 플래그 — 전투가 끝나면 지운다. */
export const BEHAVIOR_COMBO_FLAG_KEYS = Object.freeze(['afterSkill', 'crossGuard', 'potionReady', 'beatCount'] as const);

/** 켜진 조합 중 그 효과의 보너스(없으면 null). */
export const getBehaviorCombo = (
    synergies: readonly RelicSynergy[] | undefined,
    effect: BehaviorComboEffect,
): RelicSynergyBonus | null => (synergies || []).find((synergy) => synergy.bonus.effect === effect)?.bonus ?? null;

/** 켜진 행동 조합의 이름(효과 → 이름) — 기록 줄 · 칩이 쓴다. */
export const getBehaviorComboLabel = (
    synergies: readonly RelicSynergy[] | undefined,
    effect: BehaviorComboEffect,
): string => (synergies || []).find((synergy) => synergy.bonus.effect === effect)?.label ?? '';

// ── B1 교차 리듬 ─────────────────────────────────────────────────────────────

/** 이번 일반 공격이 교차 리듬을 받는가 — 직전 행동이 기술이었다. 받으면 피해 배율 · 받는 피해 감소율. */
export const getCrossRhythmStrike = (
    synergies: readonly RelicSynergy[] | undefined,
    flags: CombatFlags | undefined,
): { attackMult: number; guard: number } | null => {
    const bonus = getBehaviorCombo(synergies, 'cross_rhythm');
    if (!bonus || !flags?.afterSkill) return null;
    return {
        attackMult: Math.max(1, bonus.afterSkillAttackMult ?? 1),
        guard: Math.max(0, Math.min(1, bonus.afterSkillGuard ?? 0)),
    };
};

/** 이번 적 행동에서 받는 피해 감소율(교차 리듬이 세운 것, 없으면 0). */
export const getCrossGuard = (player: Player): number => Math.max(0, Math.min(1, player.combatFlags?.crossGuard ?? 0));

/** 적 행동 한 번이 끝나면 교차 리듬의 받는 피해 감소를 지운다(세워져 있지 않으면 같은 참조). */
export const spendCrossGuard = (player: Player): Player => {
    if (!player.combatFlags || player.combatFlags.crossGuard === undefined) return player;
    const { crossGuard: _spent, ...rest } = player.combatFlags;
    return { ...player, combatFlags: rest };
};

// ── B2 끊는 일격 ─────────────────────────────────────────────────────────────

/** 충전한 보스를 끊는 계산에서 준 피해를 몇 배로 세나(조합이 없으면 1). */
export const getChargeBreakMult = (synergies: readonly RelicSynergy[] | undefined): number =>
    Math.max(1, getBehaviorCombo(synergies, 'break_strike')?.chargeBreakMult ?? 1);

/** 충전을 끊었을 때 보스가 기절하는 행동 수(조합이 없으면 0). */
export const getBreakStunTurns = (synergies: readonly RelicSynergy[] | undefined): number =>
    Math.max(0, Math.floor(getBehaviorCombo(synergies, 'break_strike')?.breakStun ?? 0));

// ── B3 추격(공허의 용) ───────────────────────────────────────────────────────

/**
 * 이번 피해 행동이 확정 치명타인가 — 행동 전에 적이 기절 · 빙결(`stunnedTurns`)이거나, 직전 행동을 기절로 넘겼다(`pursuitOpen`).
 * 기절은 적 차례에 줄어서 1턴 기절은 내 다음 행동 전에 이미 0이다 — 넘긴 행동 표시가 없으면 기절 기술 → 큰 기술이 추격이 되지 않는다.
 */
export const isPursuitCrit = (synergies: readonly RelicSynergy[] | undefined, enemy: Monster): boolean =>
    Boolean(getBehaviorCombo(synergies, 'void_pursuit')?.pursuitCrit) && ((enemy.stunnedTurns ?? 0) > 0 || enemy.pursuitOpen === true);

// ── B4 전투 물약술 ───────────────────────────────────────────────────────────

/** 다음 기술이 기력 · 재사용 대기 없이 나가는가(조합이 켜져 있고 전투 중 소모품을 썼다). */
export const isPotionSkillReady = (synergies: readonly RelicSynergy[] | undefined, flags: CombatFlags | undefined): boolean =>
    Boolean(getBehaviorCombo(synergies, 'battle_alchemy')?.potionFreeSkill) && Boolean(flags?.potionReady);

/**
 * 전투 중 소모품 한 번 뒤의 행동 조합 플래그 — 교차 리듬의 '직전 기술'을 지우고, 전투 물약술이면 다음 기술을 준비한다.
 * 조합이 없거나 바꿀 것이 없으면 같은 참조와 빈 기록이다. 켜진 조합은 유물에서 구한다(소모품 차례는 능력치를 받지 않는다).
 */
export const applyConsumableBehaviorCombos = (player: Player): { player: Player; logs: Array<{ type: string; text: string }> } => {
    const synergies = getActiveRelicSynergies(player.relics || []);
    const alchemy = getBehaviorCombo(synergies, 'battle_alchemy')?.potionFreeSkill === true;
    const flags = player.combatFlags;
    if (!alchemy && flags?.afterSkill === undefined) return { player, logs: [] };
    const { afterSkill: _afterSkill, ...rest } = flags || {};
    return {
        player: { ...player, combatFlags: { ...rest, ...(alchemy ? { potionReady: true } : {}) } },
        logs: alchemy ? [{ type: 'event', text: MSG.BEHAVIOR_COMBO_POTION_READY(getBehaviorComboLabel(synergies, 'battle_alchemy')) }] : [],
    };
};

/** 화면용 — 플레이어의 유물로 켜진 조합을 구해 다음 기술이 물약술로 무료인지(전투 기술 칸 · 준비 표시). */
export const isPlayerPotionSkillReady = (player: Player): boolean =>
    isPotionSkillReady(getActiveRelicSynergies(player.relics || []), player.combatFlags);

// ── B5 셋째 박자 ─────────────────────────────────────────────────────────────

/** 셋째 박자 상태 — 센 위력 기술 수 · 주기 · 이번 위력 기술이 강해지는가. 조합이 없으면 null. */
export const getThirdBeat = (
    synergies: readonly RelicSynergy[] | undefined,
    flags: CombatFlags | undefined,
): { count: number; every: number; mult: number; ready: boolean } | null => {
    const bonus = getBehaviorCombo(synergies, 'third_beat');
    if (!bonus) return null;
    const every = Math.max(1, Math.floor(bonus.beatEvery ?? 3));
    const count = Math.max(0, Math.min(every, Math.floor(flags?.beatCount ?? 0)));
    return { count, every, mult: Math.max(1, bonus.beatMult ?? 1), ready: count >= every };
};

/** 위력 기술 한 번 뒤의 셋째 박자 수 — 강해진 기술은 0으로 돌아가고, 아니면 하나 센다. */
export const nextBeatCount = (beat: { count: number; every: number; ready: boolean }): number =>
    (beat.ready ? 0 : Math.min(beat.every, beat.count + 1));

// ── B6 마무리(절멸자) ────────────────────────────────────────────────────────

/**
 * 이번 일반 공격이 마무리인가 — 행동 전 적 생명이 문턱 이하. 일반 적은 처치(`kill`), 보스는 피해 배율(`mult`). 조합이 없거나
 * 문턱 위면 null.
 */
export const getFinisherStrike = (
    synergies: readonly RelicSynergy[] | undefined,
    enemy: Monster,
): { kill: boolean; mult: number } | null => {
    const bonus = getBehaviorCombo(synergies, 'finisher');
    if (!bonus) return null;
    const ratio = (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || enemy.hp || 1);
    if ((enemy.hp ?? 0) <= 0 || ratio > (bonus.finisherThreshold ?? 0)) return null;
    return enemy.isBoss
        ? { kill: false, mult: Math.max(1, bonus.finisherBossMult ?? 1) }
        : { kill: true, mult: 1 };
};

// ── 전투 칩 ──────────────────────────────────────────────────────────────────

/** 전투 칩 하나 — `ready`면 지금 조건이 걸렸다, 아니면 세는 중이다. */
export interface BehaviorComboChip {
    effect: BehaviorComboEffect;
    text: string;
    ready: boolean;
}

/**
 * 지금 걸린 행동 조합 조건 하나(없으면 null) — 엔진이 다음 행동에 실제로 쓰는 판정 그대로다. 적 상태(마무리 · 추격 · 끊기)가
 * 먼저이고, 그다음 준비된 플래그(물약술 · 교차 리듬), 마지막이 셋째 박자의 세는 수다. 무엇을 하라고 권하지 않는다(Wave 88).
 */
export const getBehaviorComboChip = (player: Player, enemy: Monster | null | undefined): BehaviorComboChip | null => {
    const synergies = getActiveRelicSynergies(player.relics || []);
    if (!synergies.some((synergy) => (BEHAVIOR_COMBO_EFFECTS as readonly string[]).includes(synergy.bonus.effect))) return null;
    const flags = player.combatFlags;
    const label = (effect: BehaviorComboEffect) => getBehaviorComboLabel(synergies, effect);
    if (enemy && (enemy.hp ?? 0) > 0) {
        if (getFinisherStrike(synergies, enemy)) return { effect: 'finisher', text: MSG.BEHAVIOR_CHIP_FINISHER(label('finisher')), ready: true };
        if (isPursuitCrit(synergies, enemy)) return { effect: 'void_pursuit', text: MSG.BEHAVIOR_CHIP_PURSUIT(label('void_pursuit')), ready: true };
        const breakMult = getChargeBreakMult(synergies);
        if (breakMult > 1 && enemy.mechanics?.charge && enemy.chargeArmed) {
            return { effect: 'break_strike', text: MSG.BEHAVIOR_CHIP_BREAK_STRIKE(label('break_strike'), breakMult), ready: true };
        }
    }
    if (isPotionSkillReady(synergies, flags)) return { effect: 'battle_alchemy', text: MSG.BEHAVIOR_CHIP_POTION_READY(label('battle_alchemy')), ready: true };
    if (getCrossRhythmStrike(synergies, flags)) return { effect: 'cross_rhythm', text: MSG.BEHAVIOR_CHIP_CROSS_RHYTHM(label('cross_rhythm')), ready: true };
    const beat = getThirdBeat(synergies, flags);
    if (beat) {
        return beat.ready
            ? { effect: 'third_beat', text: MSG.BEHAVIOR_CHIP_THIRD_BEAT_READY(label('third_beat')), ready: true }
            : { effect: 'third_beat', text: MSG.BEHAVIOR_CHIP_THIRD_BEAT(label('third_beat'), beat.count, beat.every), ready: false };
    }
    return null;
};

// ── 범위 ─────────────────────────────────────────────────────────────────────

/** 행동 조합의 전투 플래그를 지운다(없으면 같은 참조) — 전투가 끝나는 모든 경로(`endCombatScope`). */
export const endBehaviorComboScope = (player: Player): Player => {
    const flags = player.combatFlags;
    if (!flags || !BEHAVIOR_COMBO_FLAG_KEYS.some((key) => flags[key] !== undefined)) return player;
    const { afterSkill: _a, crossGuard: _g, potionReady: _p, beatCount: _b, ...rest } = flags;
    return { ...player, combatFlags: rest };
};
