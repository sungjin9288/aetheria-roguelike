import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import type { CombatFeedback, DefeatedEnemySnapshot, Monster } from '../types/index.js';

/**
 * 전투 연출의 박자와 문구 — 게임 필 감사 GF-01 · 02 · 06 · 11. 순수 함수만 둔다(타이머는 `useCombatFeedbackBeats`).
 *
 * 리듀서는 한 차례를 한 전이에서 끝낸다(§8-1). 여기서 정하는 것은 **보여 주는 순서**뿐이다:
 *   0ms              내 타격 — 적 피격 숫자 · 적 막대 · 내 치명타 금색 비네트 / 처치면 쓰러진 적
 *   counterDelayMs   적 반격 — 내 피격 숫자 · 붉은 테두리 · 적 강타 붉은 비네트와 흔들림
 *   killBeatMs       처치 순간 끝 — 결과 카드 · 유물 선택이 뜬다
 * 모션 감소 설정에서는 박자를 나누지 않고(지연 0) 처치 순간도 짧게 정지 표시한다.
 */
export interface CombatBeatTiming {
    counterDelayMs: number;
    killBeatMs: number;
    pulseMs: number;
    shakeMs: number;
}

export const getCombatBeatTiming = (reducedMotion: boolean): CombatBeatTiming => ({
    counterDelayMs: reducedMotion ? 0 : BALANCE.ENEMY_TURN_DELAY_MS,
    killBeatMs: reducedMotion ? BALANCE.KILL_BEAT_REDUCED_MS : BALANCE.KILL_BEAT_MS,
    pulseMs: BALANCE.COMBAT_PULSE_MS,
    shakeMs: BALANCE.COMBAT_SHAKE_MS,
});

/** 내가 적을 맞혔고 적이 그 뒤에 행동한 차례만 박자를 나눈다 — 앞의 연출(적 피격)이 없으면 기다릴 이유가 없다. */
export const isCounterStaggered = (feedback: CombatFeedback | null | undefined): boolean => Boolean(
    feedback
    && feedback.kind === 'continue'
    && feedback.enemyDamage > 0
    && feedback.enemyActed,
);

/** `useDamageFlash`가 읽는 내 피격 연출 지연 — 같은 차례(key)에 한 번만 쓴다. */
export interface CounterStagger {
    key: string | null;
    delayMs: number;
}

export const getCounterStagger = (
    feedback: CombatFeedback | null | undefined,
    reducedMotion: boolean,
): CounterStagger => ({
    key: feedback?.key ?? null,
    delayMs: isCounterStaggered(feedback) ? getCombatBeatTiming(reducedMotion).counterDelayMs : 0,
});

/** 화면 낭독기용 이번 차례 요약 — 눈으로 보는 숫자 연출과 같은 사실을 말한다(권고 없음). */
export const getCombatAnnouncement = (feedback: CombatFeedback | null | undefined): string => {
    if (!feedback) return '';
    const parts: string[] = [];
    if (feedback.enemyDamage > 0) parts.push(MSG.COMBAT_FEEDBACK_ENEMY_DAMAGE(feedback.enemyDamage, feedback.playerCrit));
    if (feedback.defeatedEnemy) parts.push(MSG.COMBAT_FEEDBACK_KILL(feedback.defeatedEnemy.name));
    if (feedback.playerHpDelta < 0) {
        parts.push(MSG.COMBAT_FEEDBACK_PLAYER_DAMAGE(-feedback.playerHpDelta, feedback.enemyHeavy));
    } else if (feedback.playerHpDelta > 0) {
        parts.push(MSG.COMBAT_FEEDBACK_PLAYER_HEAL(feedback.playerHpDelta));
    }
    if (feedback.kind === 'defeat') parts.push(MSG.COMBAT_FEEDBACK_DEFEAT);
    return parts.join(MSG.COMBAT_FEEDBACK_SEPARATOR);
};

/** 상태 표시줄이 그릴 적 — 싸우는 중이면 살아 있는 적, 처치 순간이면 쓰러진 적(GF-02). */
export interface CombatStageView {
    enemy: Monster | null;
    /** `enemy`가 쓰러진 적이다 — '처치' 도장을 그리고 '전투 중' 표시를 내린다. */
    enemyDefeated: boolean;
    /** 처치 순간 동안 결과 카드 · 유물 선택을 미룬다. */
    holdResultCards: boolean;
}

export const getCombatStageView = (
    liveEnemy: Monster | null | undefined,
    defeatedEnemy: DefeatedEnemySnapshot | null,
): CombatStageView => ({
    enemy: liveEnemy ?? defeatedEnemy,
    enemyDefeated: !liveEnemy && Boolean(defeatedEnemy),
    holdResultCards: Boolean(defeatedEnemy),
});

/**
 * 화면 흔들림 — 리듀서의 'shake'는 전투 차례의 적 강타만 만든다. 그 흔들림은 박자(`shake`)가 대신 걸므로
 * 리듀서 값은 걸러 낸다(내 타격과 같은 프레임에 흔들리지 않게). 다른 효과는 그대로 통과한다.
 */
export const getPresentedVisualEffect = (engineEffect: string | null | undefined, shake: boolean): string | null => {
    if (shake) return 'shake';
    return engineEffect === 'shake' ? null : engineEffect ?? null;
};
