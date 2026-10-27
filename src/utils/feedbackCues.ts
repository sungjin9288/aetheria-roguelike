import type { CombatFeedback } from '../types/index.js';
import type { FeedbackCue } from '../platform/feedbackPort';

/**
 * 진동 계기 판정 — 2026-10-26 소유자 결정 D3. 표시 상태 두 장면(직전 · 지금)을 비교해 울릴 계기 하나를 고른다.
 *
 *   - 사망: 쓰러짐 화면으로 들어선 순간
 *   - 레벨 상승: 레벨이 오른 순간(내려가는 것 — 사망 재시작 · 계승 — 은 아니다)
 *   - 치명타: 새 전투 차례에서 내 타격이 치명타
 *   - 맞음: 새 전투 차례에서 적이 행동했고 내 생명이 줄었다
 * 전설 획득은 전설 획득 화면이 뜨는 순간이라 그 화면의 표시 훅이 따로 부른다(`usePresentationHaptic`).
 *
 * 한 장면에 계기가 여럿이면 하나만 — 사망 > 레벨 상승 > 치명타 > 맞음. 첫 장면(마운트)과 복원(`presentationEpoch`가 바뀐 장면)은
 * 기준으로만 잡는다 — 지난 세션의 차례 · 레벨로 울리지 않는다(전투 연출 GF-13과 같은 규칙).
 */
export interface FeedbackMoment {
    readonly epoch: number;
    readonly combatKey: string | null;
    readonly playerCrit: boolean;
    readonly playerHit: boolean;
    readonly level: number;
    readonly dead: boolean;
}

export interface FeedbackMomentInput {
    readonly epoch: number;
    readonly combatFeedback: CombatFeedback | null | undefined;
    readonly level: number | null | undefined;
    readonly dead: boolean;
}

export const toFeedbackMoment = ({ epoch, combatFeedback, level, dead }: FeedbackMomentInput): FeedbackMoment => ({
    epoch,
    combatKey: combatFeedback?.key ?? null,
    playerCrit: Boolean(combatFeedback?.playerCrit),
    playerHit: Boolean(combatFeedback?.enemyActed) && (combatFeedback?.playerHpDelta ?? 0) < 0,
    level: Number.isFinite(level) ? Number(level) : 0,
    dead,
});

export const selectFeedbackCue = (prev: FeedbackMoment | null, next: FeedbackMoment): FeedbackCue | null => {
    if (!prev || prev.epoch !== next.epoch) return null;
    if (next.dead && !prev.dead) return 'death';
    if (next.level > prev.level && prev.level > 0) return 'levelUp';
    const freshTurn = next.combatKey !== null && next.combatKey !== prev.combatKey;
    if (!freshTurn) return null;
    if (next.playerCrit) return 'crit';
    if (next.playerHit) return 'hit';
    return null;
};
