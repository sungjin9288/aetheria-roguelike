import { BALANCE, CONSTANTS } from '../data/constants';
import { DB } from '../data/db';
import { isSignatureItem } from '../data/signatureItems.js';
import { GS, type GameMode } from '../reducers/gameStates';
import { CombatEngine } from '../systems/CombatEngine';
import { isDamagingSkill } from '../systems/skillPower';
import { getEffectiveMaxHp, getEffectiveMaxMpFull } from '../systems/vitals';
import type { GameEvent } from '../types/session';
import type { Monster, Player, PostCombatResult, Relic } from '../types/index.js';
import { hasChallengeModifier } from './challengeRules';
import { getJobSkills } from './gameUtils';
import { getInventoryCapacity } from './inventoryCapacity';
import { isSwiftPostCombat } from './outcomeAnalysis';
import { calculateFullStats } from './statsCalculator';

/**
 * 연속 탐험 — 한 걸음의 판정(2026-11 H1, docs/EXECUTION_SKETCH_H1_2026-11.md §3).
 *
 * 상태만 읽고 게임 난수를 쓰지 않는다. 걸음은 수동 탭과 같은 액션(`actions.explore` · `actions.combat('attack')`)이고,
 * 상태 전이 · 게이트는 그 액션이 소유한다 — 여기서는 "다음에 무엇을 누를지 / 왜 멈추는지"만 정한다.
 *
 * - 대기 · 사냥 지역 · 멈춤 조건 없음 → 탐험(접힌 결과 카드 위면 '계속 탐험'과 같다).
 * - 전투 · 보스 · 정예 · 우두머리가 아니고 **최소 피해로 한 번에 쓰러지는** 적 → 일반 공격, 일반 공격으로 안 되면
 *   지금 고른 기술(소유자 결정 Q1 (c), 2026-11-12 — (a) 일반 공격만은 연속 탐험 몫 1 ~ 3%였다, 원장 §172).
 *   기술은 플레이어가 고른 그 기술이다 — 고른 기술을 바꾸지 않는다. 위력 없는 기술 · '뒤섞인 기술' 회차는 기술로 치지 않는다.
 *   시험은 전투 턴과 같은 `CombatEngine.attack` · `performSkill`을 고정 굴림(분산 최소 · 치명타 · 확률 효과 · 무료 기술 없음)으로
 *   부른다 — 피해 식을 다시 쓰지 않는다. 쓸 수 없는 기술(기력 · 재사용 대기)은 엔진이 거부하므로 한 방이 아니다.
 * - 그 밖 → 멈춤 + 이유. 판단할 거리(이벤트 · 유물 · 접히지 않은 결과 카드 · 생명 · 기력 · 가방 · 위험한 적)가 생기면 반드시 멈춘다.
 */

export type AutoExploreStopReason =
    | 'locked'
    | 'safe_zone'
    | 'mode'
    | 'event'
    | 'relic_choice'
    | 'decision_card'
    | 'hp_low'
    | 'mp_low'
    | 'bag_full'
    | 'boss'
    | 'elite'
    | 'champion'
    | 'not_one_shot'
    | 'status'
    | 'defeat';

export type AutoExploreStep =
    | { kind: 'explore' }
    | { kind: 'attack' }
    | { kind: 'skill' }
    | { kind: 'stop'; reason: AutoExploreStopReason };

/** 판정이 읽는 게임 상태 — `GameState`의 부분집합. */
export interface AutoExploreState {
    gameState: GameMode;
    player: Player | null | undefined;
    enemy: Monster | null | undefined;
    currentEvent: GameEvent | null | undefined;
    pendingRelics: Relic[] | null | undefined;
    postCombatResult: PostCombatResult | null | undefined;
    isAiThinking: boolean;
}

/** 일반 공격을 막거나 빗나가게 하는 상태이상 — 걸려 있으면 "한 번에 쓰러진다"를 보장할 수 없다. */
const ATTACK_DISRUPTING_STATUSES: readonly string[] = ['freeze', 'stun', 'blind', 'fear'];

const stop = (reason: AutoExploreStopReason): AutoExploreStep => ({ kind: 'stop', reason });

/** 첫 전직 뒤에만 쓸 수 있다(소유자 결정 Q2 (b)). */
export const isAutoExploreUnlocked = (player: Pick<Player, 'job'> | null | undefined): boolean => (
    Boolean(player?.job) && player?.job !== CONSTANTS.DEFAULT_JOB
);

/** 설정에서 고른 생명 멈춤 문턱(30 · 50 · 70%) — 없거나 목록 밖이면 기본 50%. */
export const getAutoExploreHpSetting = (player: Pick<Player, 'settings'> | null | undefined): number => {
    const value = player?.settings?.autoExploreHpStop;
    const options: readonly number[] = BALANCE.AUTO_EXPLORE_HP_STOP_OPTIONS;
    return typeof value === 'number' && options.includes(value) ? value : BALANCE.AUTO_EXPLORE_HP_STOP_DEFAULT;
};

/** 실제로 멈추는 생명 비율 — 설정값이 결과 카드의 낮은 생명 문턱보다 낮아도 그 문턱 아래로 내려가지 않는다(Q3 해석). */
export const getAutoExploreHpStopRatio = (player: Pick<Player, 'settings'> | null | undefined): number => (
    Math.max(getAutoExploreHpSetting(player), BALANCE.POST_COMBAT_HP_LOW_RATIO)
);

const signatureLootCount = (result: PostCombatResult): number => (
    (Array.isArray(result.items) ? result.items : []).filter((name) => typeof name === 'string' && isSignatureItem({ name })).length
);

/** 결과 카드가 접힌 카드(판단할 거리 없는 승리)인가 — 카드와 같은 판정(`isSwiftPostCombat`). */
const isSwiftResult = (result: PostCombatResult): boolean => {
    const signatures = signatureLootCount(result);
    const items = Array.isArray(result.items) ? result.items.length : 0;
    return isSwiftPostCombat(result, { signatureLootCount: signatures, nonSignatureLootCount: items - signatures });
};

/** 피해 굴림 한 번(분산 · 치명타) — 분산은 최소, 치명타는 걸리지 않는 값. `calculateDamage`를 부를 때마다 새로 만든다. */
const createMinimumDamageRoll = (): (() => number) => {
    let draws = 0;
    return () => {
        draws += 1;
        return draws === 1 ? BALANCE.AUTO_EXPLORE_PROBE_VARIANCE_ROLL : BALANCE.AUTO_EXPLORE_PROBE_OTHER_ROLL;
    };
};

/**
 * 시험용 엔진 — 피해 굴림(`calculateDamage`)만 최소 분산 · 치명타 없음으로 바꾼 같은 엔진이다. 연속 타격은 타격마다 최소 분산이고,
 * 확정 치명타(조합 추격 — `critChance: 1`)는 그대로 걸린다. 나머지 굴림(무료 기술 · 확률 효과 · 빙결 유물 · 추가 행동)은
 * 바깥 굴림 `AUTO_EXPLORE_PROBE_OTHER_ROLL`이 걸리지 않게 한다 — 판정이 굴림 순서를 알 필요가 없다.
 */
const probeEngine: typeof CombatEngine = Object.create(CombatEngine, {
    calculateDamage: {
        value: (stats: Parameters<typeof CombatEngine.calculateDamage>[0], options: Parameters<typeof CombatEngine.calculateDamage>[1]) => (
            CombatEngine.calculateDamage(stats, { ...options, rng: createMinimumDamageRoll() })
        ),
    },
});

const probeOtherRoll = (): number => BALANCE.AUTO_EXPLORE_PROBE_OTHER_ROLL;

type StrikeSkill = Parameters<typeof CombatEngine.performSkill>[3];

/**
 * 최소 피해로 이 적이 한 번에 쓰러지는가 — 전투 턴(`resolveCombatActionTurn`)과 같은 엔진 호출 · 같은 능력치(`calculateFullStats`).
 * 기술을 주면 그 기술(`performSkill`), 없으면 일반 공격. 계산할 수 없으면 false(멈춤 쪽으로 기운다).
 */
export const isOneShotWithMinimumStrike = (player: Player, enemy: Monster, skill?: StrikeSkill): boolean => {
    try {
        const stats = calculateFullStats(player);
        if (!stats) return false;
        const result = skill
            ? probeEngine.performSkill(player, enemy, stats, skill, probeOtherRoll)
            : probeEngine.attack(player, enemy, stats, probeOtherRoll);
        return Boolean(result?.isVictory);
    } catch {
        return false;
    }
};

/** 일반 공격 최소 피해로 한 번에 쓰러지는가. */
export const isOneShotWithMinimumAttack = (player: Player, enemy: Monster): boolean => isOneShotWithMinimumStrike(player, enemy);

/**
 * 연속 탐험이 쓸 수 있는 기술 — 지금 고른 기술(전투 턴과 같은 고르기)이고 위력이 있어야 한다. '뒤섞인 기술' 회차는 다른 기술이
 * 무작위로 나가므로 없다. 쓸 수 있는지(기력 · 재사용 대기)는 엔진 시험이 판정한다.
 */
export const getAutoExploreSkill = (player: Player): StrikeSkill | null => {
    if (hasChallengeModifier(player, 'randomSkills')) return null;
    const skills = getJobSkills(player);
    if (skills.length === 0) return null;
    const selected = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout!.selected as number : 0;
    const skill = skills[((selected % skills.length) + skills.length) % skills.length];
    return isDamagingSkill(skill) ? skill : null;
};

const judgeCombat = (player: Player, enemy: Monster | null | undefined): AutoExploreStep => {
    if (!enemy) return stop('mode');
    if (enemy.isBoss) return stop('boss');
    if (enemy.huntChampion) return stop('champion');
    if (enemy.isElite) return stop('elite');
    const status = Array.isArray(player.status) ? player.status : [];
    if (status.some((id) => ATTACK_DISRUPTING_STATUSES.includes(id))) return stop('status');
    // 적이 이미 행동했다면 판단할 거리가 있는 전투다(접힌 카드가 될 수 없다).
    if ((enemy.actionCount ?? 0) > 0) return stop('not_one_shot');
    if (isOneShotWithMinimumAttack(player, enemy)) return { kind: 'attack' };
    const skill = getAutoExploreSkill(player);
    return skill && isOneShotWithMinimumStrike(player, enemy, skill) ? { kind: 'skill' } : stop('not_one_shot');
};

const judgeIdle = (state: AutoExploreState, player: Player): AutoExploreStep => {
    if (state.pendingRelics && state.pendingRelics.length > 0) return stop('relic_choice');
    if (state.isAiThinking || state.currentEvent) return stop('event');
    if (state.postCombatResult && !isSwiftResult(state.postCombatResult)) return stop('decision_card');
    const map = player.loc ? DB.MAPS[player.loc] : null;
    if (!map) return stop('mode');
    if (map.type === 'safe') return stop('safe_zone');
    if ((player.inv || []).length >= getInventoryCapacity(player)) return stop('bag_full');
    const maxHp = Math.max(1, getEffectiveMaxHp(player));
    if ((Number(player.hp) || 0) / maxHp <= getAutoExploreHpStopRatio(player)) return stop('hp_low');
    const maxMp = Math.max(1, getEffectiveMaxMpFull(player, player.relics || [], Number(player.maxMp) || 1));
    if ((Number(player.mp) || 0) / maxMp <= BALANCE.POST_COMBAT_MP_LOW_RATIO) return stop('mp_low');
    return { kind: 'explore' };
};

/** 다음 걸음 — 탐험 · 일반 공격 · 고른 기술 · 멈춤(이유). */
export const getAutoExploreStep = (state: AutoExploreState): AutoExploreStep => {
    const player = state.player;
    if (!player) return stop('mode');
    if (!isAutoExploreUnlocked(player)) return stop('locked');
    switch (state.gameState) {
        case GS.IDLE:
            return judgeIdle(state, player);
        case GS.COMBAT:
            return judgeCombat(player, state.enemy);
        case GS.EVENT:
        case GS.EVENT_PENDING:
            return stop('event');
        case GS.DEAD:
            return stop('defeat');
        default:
            return stop('mode');
    }
};

/** 연속 탐험을 켤 수 있는가 — 지금 첫 걸음이 탐험이어야 한다(대기 · 사냥 지역 · 멈춤 조건 없음). */
export const canStartAutoExplore = (state: AutoExploreState): boolean => getAutoExploreStep(state).kind === 'explore';
