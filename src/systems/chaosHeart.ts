import { RELICS, getActiveRelicSynergies } from '../data/relics.js';
import type { Relic, RelicEffect, RelicSynergy } from '../types/index.js';

/**
 * 혼돈의 심장 "전투마다 무작위 유물 효과 발동"(2026-10 Wave 57, 소유자 결정 "조합까지 켜지게").
 *
 * 전투가 시작되면 가지지 않은 유물 하나를 그 전투 동안 빌려 온다. 빌린 유물은 `player.relics`에 실제로 들어가므로
 * 엔진의 모든 유물 판정 · 조합 판정(대가 포함)이 그대로 읽는다. 전투가 끝나는 모든 경로가
 * `endCombatScopedRelics`로 걷어 낸다. 이전 구현은 생명 10% 회복 · 공격력 · 방어력 25%(3턴) 중 하나였다.
 *
 * 무엇을 빌릴 수 있는가 — 전투 안에서 작동하고 전투 밖에 흔적을 남기지 않는 효과만이다. 효과마다 분류를 적는다.
 * `Record<RelicEffect, …>`라 새 유물 효과는 여기서 분류하지 않으면 컴파일되지 않는다.
 * - `combat`: 전투 시작 · 턴 · 공격 · 피격 · 능력치. 빌릴 수 있다.
 * - `victory`: 승리 정산에서만 작동한다. 빌린 유물은 정산 전에 돌려주므로 효과가 없다. 원정 누적(허공의 왕좌) ·
 *   다음 전투 예약(세계 포식자) · 인스턴스 처치 수(영혼 수집가)는 돌려준 뒤에도 남을 수 있어 더욱 안 된다.
 * - `explore`: 탐험 판정이다. 전투에서는 효과가 없다.
 * - `expedition`: 원정 단위 1회 상태(허공의 심장 `voidHeartUsed`)라 전투 플래그를 넘어 남는다.
 * - `abyss-progress`: 돌파한 심연 층 수가 효과를 정한다. 심연에 가 본 적 없으면 효과가 0이다.
 * - `self`: 혼돈의 심장 자신.
 */
export type ChaosHeartEligibility = 'combat' | 'victory' | 'explore' | 'expedition' | 'abyss-progress' | 'self';

export const CHAOS_HEART_ELIGIBILITY: Readonly<Record<RelicEffect, ChaosHeartEligibility>> = Object.freeze({
    // 전투 — 능력치
    glass_cannon: 'combat',
    ancient_power: 'combat',
    stone_skin: 'combat',
    fortress: 'combat',
    mp_mult: 'combat',
    omega: 'combat',
    battle_start_atk: 'combat',
    triple_up: 'combat',
    titan: 'combat',
    genesis: 'combat',
    dual_crit: 'combat',
    chaos_buff: 'combat',
    hp_drain_atk: 'combat',
    // 전투 — 시작
    battle_start_heal: 'combat',
    battle_start_buff: 'combat',
    cursed_power: 'combat',
    first_turn_evade: 'combat',
    // 전투 — 공격 · 기술
    low_hp_atk: 'combat',
    execute_bonus: 'combat',
    double_strike: 'combat',
    skill_lifesteal: 'combat',
    crit_mp_regen: 'combat',
    free_skill: 'combat',
    skill_mult: 'combat',
    combo_stack: 'combat',
    dot_mult: 'combat',
    armor_pen: 'combat',
    execute_atk: 'combat',
    low_hp_dmg: 'combat',
    crit_dmg: 'combat',
    echo_atk: 'combat',
    on_hit_freeze: 'combat',
    spell_stack: 'combat',
    elem_boost: 'combat',
    entropy_tick: 'combat',
    cd_minus: 'combat',
    cooldown_reduce: 'combat',
    // 전투 — 피격 · 턴
    crit_block: 'combat',
    reflect: 'combat',
    reflect_crit: 'combat',
    death_save: 'combat',
    phoenix_revive: 'combat',
    status_resist: 'combat',
    mp_regen_turn: 'combat',
    regen: 'combat',
    // 승리 정산
    on_kill_heal: 'victory',
    gold_mult: 'victory',
    exp_mult: 'victory',
    drop_rate: 'victory',
    kill_bonus: 'victory',
    mp_restore_battle: 'victory',
    kill_stack: 'victory',
    kill_stack_atk: 'victory',
    devour_hp: 'victory',
    // 탐험
    event_chance: 'explore',
    boss_hunter: 'explore',
    // 원정 상태
    void_heart: 'expedition',
    // 심연 진행
    abyss_atk_scale: 'abyss-progress',
    abyss_crit_scale: 'abyss-progress',
    abyss_floor_power: 'abyss-progress',
    // 자신
    chaos_relic: 'self',
});

export const isBorrowedRelic = (relic: Relic | null | undefined): boolean => relic?.borrowed === true;

/** 가진 유물 수 — 혼돈의 심장이 이번 전투에 빌린 유물은 세지 않는다(보유 표시 · 상한 표시용). */
export const countOwnedRelics = (relics: readonly Relic[] | null | undefined): number => (
    (relics || []).filter((relic) => !isBorrowedRelic(relic)).length
);

/**
 * 빌릴 수 있는 유물 — 전투 분류이고, 가진 유물이 아니며, 가진 유물과 효과가 같지 않은 것.
 * 효과가 같은 유물은 엔진이 하나만 읽는 경우가 있어(첫 유물 · 가장 강한 값) 빌려도 아무것도 바뀌지 않을 수 있다.
 */
export const getChaosHeartPool = (owned: readonly Relic[]): Relic[] => RELICS.filter((relic) => (
    relic.effect !== undefined
    && CHAOS_HEART_ELIGIBILITY[relic.effect] === 'combat'
    && !owned.some((mine) => mine.id === relic.id || mine.effect === relic.effect)
));

export interface ChaosHeartBorrow {
    /** 빌린 유물 인스턴스(`borrowed: true`) — 빌릴 것이 없으면 `null`. */
    relic: Relic | null;
    /** 빌린 유물이 이번 전투에 새로 켠 조합(대가 포함). */
    completedSynergies: RelicSynergy[];
}

/**
 * 혼돈의 심장을 가졌으면 유물 하나를 빌린다. 난수는 빌릴 때 한 번만 쓴다(빌릴 것이 없으면 쓰지 않는다).
 * 이미 빌린 유물이 있으면(전투가 끝나지 않은 채 다시 시작하는 경로) 그것을 돌려준 뒤 다시 고른다.
 */
export const borrowChaosHeartRelic = (relics: readonly Relic[], rng: () => number): ChaosHeartBorrow => {
    const owned = relics.filter((relic) => !isBorrowedRelic(relic));
    if (!owned.some((relic) => relic.effect === 'chaos_relic')) return { relic: null, completedSynergies: [] };
    const pool = getChaosHeartPool(owned);
    if (pool.length === 0) return { relic: null, completedSynergies: [] };
    const picked = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
    const relic: Relic = { ...picked, borrowed: true };
    const before = new Set(getActiveRelicSynergies(owned).map((synergy) => synergy.label));
    const completedSynergies = getActiveRelicSynergies([...owned, relic])
        .filter((synergy) => !before.has(synergy.label));
    return { relic, completedSynergies };
};
