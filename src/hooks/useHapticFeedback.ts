import { useEffect, useRef } from 'react';
import { playFeedbackCue, type FeedbackCue } from '../platform/feedbackPort';
import { selectFeedbackCue, toFeedbackMoment, type FeedbackMoment, type FeedbackMomentInput } from '../utils/feedbackCues';

/**
 * 진동을 부르는 표시 훅 — 2026-10-26 소유자 결정 D3. 계기 판정은 `utils/feedbackCues.ts`, 울리는 방법은 `platform/feedbackPort.ts`다.
 * 리듀서 · 전투 엔진은 진동을 모른다(순수 유지) — 여기서 화면에 보이는 상태의 변화를 보고 부른다.
 * 기록 탭 설정의 '진동'이 꺼져 있으면 부르지 않는다(감소된 동작 설정과는 별개다).
 */
type PlayCue = (cue: FeedbackCue) => void;

interface GameFeedbackHapticsInput extends FeedbackMomentInput {
    readonly enabled: boolean;
}

/** 맞음 · 치명타 · 레벨 상승 · 사망 — 사망 화면에서도 살아 있는 곳(App)에서 부른다. */
export const useGameFeedbackHaptics = (
    { enabled, epoch, combatFeedback, level, dead }: GameFeedbackHapticsInput,
    play: PlayCue = playFeedbackCue,
): void => {
    const previousRef = useRef<FeedbackMoment | null>(null);
    const moment = toFeedbackMoment({ epoch, combatFeedback, level, dead });
    const { combatKey, playerCrit, playerHit } = moment;
    const momentLevel = moment.level;
    useEffect(() => {
        const next: FeedbackMoment = { epoch, combatKey, playerCrit, playerHit, level: momentLevel, dead };
        const cue = selectFeedbackCue(previousRef.current, next);
        previousRef.current = next;
        if (cue && enabled) play(cue);
    }, [enabled, epoch, combatKey, playerCrit, playerHit, momentLevel, dead, play]);
};

/**
 * 화면 하나가 새 대상으로 뜨는 순간에 울린다(전설 획득 화면). 마운트 때 이미 떠 있던 대상은 울리지 않는다 —
 * 복원 뒤 재발화는 그 화면의 대기열(`useLegendaryDropDetector`)이 이미 막는다.
 */
export const usePresentationHaptic = (
    cue: FeedbackCue,
    presentedKey: unknown,
    enabled: boolean,
    play: PlayCue = playFeedbackCue,
): void => {
    const previousRef = useRef<unknown>(presentedKey);
    useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = presentedKey;
        if (presentedKey == null || presentedKey === previous || !enabled) return;
        play(cue);
    }, [cue, presentedKey, enabled, play]);
};
