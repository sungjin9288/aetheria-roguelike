import { BALANCE, CONSTANTS } from '../data/constants';
import { DB } from '../data/db';
import { isSignatureItem } from '../data/signatureItems.js';
import { GS, type GameMode } from '../reducers/gameStates';
import { CombatEngine } from '../systems/CombatEngine';
import { getEffectiveMaxHp, getEffectiveMaxMpFull } from '../systems/vitals';
import type { GameEvent } from '../types/session';
import type { Monster, Player, PostCombatResult, Relic } from '../types/index.js';
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
 * - 전투 · 보스 · 정예 · 우두머리가 아니고 일반 공격 **최소 피해로 한 번에 쓰러지는** 적 → 일반 공격(소유자 결정 Q1 (a)).
 *   시험은 전투 턴과 같은 `CombatEngine.attack`을 고정 굴림(분산 최소 · 치명타 없음)으로 부른다 — 피해 식을 다시 쓰지 않는다.
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

/** 고정 굴림 — 첫 굴림(피해 분산)은 최소, 그 뒤(치명타 · 빙결)는 걸리지 않는 값. 부를 때마다 새로 만든다. */
const createMinimumStrikeRoll = (): (() => number) => {
    let draws = 0;
    return () => {
        draws += 1;
        return draws === 1 ? BALANCE.AUTO_EXPLORE_PROBE_VARIANCE_ROLL : BALANCE.AUTO_EXPLORE_PROBE_OTHER_ROLL;
    };
};

/**
 * 일반 공격 최소 피해로 이 적이 한 번에 쓰러지는가 — 전투 턴(`resolveCombatActionTurn`)과 같은 엔진 호출 ·
 * 같은 능력치(`calculateFullStats`)를 고정 굴림으로 부른다. 계산할 수 없으면 false(멈춤 쪽으로 기운다).
 */
export const isOneShotWithMinimumAttack = (player: Player, enemy: Monster): boolean => {
    try {
        const stats = calculateFullStats(player);
        if (!stats) return false;
        const result = CombatEngine.attack(player, enemy, stats, createMinimumStrikeRoll());
        return Boolean(result?.isVictory);
    } catch {
        return false;
    }
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
    return isOneShotWithMinimumAttack(player, enemy) ? { kind: 'attack' } : stop('not_one_shot');
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

/** 다음 걸음 — 탐험 · 일반 공격 · 멈춤(이유). */
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
