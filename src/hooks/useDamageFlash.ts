import { useEffect, useRef, useState } from 'react';
import type { CounterStagger } from '../utils/combatPresentation';

const EMPTY_FEEDBACK = {
    damageFlash: false,
    healFlash: false,
    damageAmount: null as { value: number; isHeal: boolean } | null,
};

const FLASH_MS = 500;
const AMOUNT_MS = 1200;

type Timer = ReturnType<typeof setTimeout>;

/** 늦춘 표시와 걷어 내기 타이머 — 렌더와 무관한 한 벌이라 다음 생명 변화가 앞 차례의 표시를 지우지 않는다. */
interface FlashTimers {
    pendingShows: Set<Timer>;
    flash: Timer | undefined;
    amount: Timer | undefined;
}

const clearFlashTimers = (timers: FlashTimers) => {
    timers.pendingShows.forEach(clearTimeout);
    timers.pendingShows.clear();
    clearTimeout(timers.flash);
    clearTimeout(timers.amount);
    timers.flash = undefined;
    timers.amount = undefined;
};

/**
 * 저장 복원은 HP 기준만 교체하고, 같은 epoch의 실제 변화만 연출합니다.
 *
 * 게임 필 감사 GF-06: `stagger`가 있으면 그 차례(`key`)의 생명 변화는 `delayMs` 뒤에 보인다 — 내 타격(적 피격 숫자)이
 * 먼저, 적 반격(내 피격 숫자 · 붉은 테두리)이 그 뒤다. 리듀서 판정은 이미 끝났고 여기서는 보여 주는 순서만 늦춘다.
 * 한 차례의 지연은 한 번만 쓴다 — 그 뒤의 생명 변화(휴식 · 물약 · 다음 차례)는 지연 없이 보인다.
 * 늦춘 표시는 다음 생명 변화가 와도 취소하지 않는다 — 지연 안에 다음 차례를 누르면 두 차례의 숫자가 차례대로 보인다
 * (취소하던 동안 앞 차례의 피격 숫자 · 테두리가 사라졌다). 복원(epoch)과 언마운트만 걷어 낸다.
 */
export const useDamageFlash = (
    currentHp: number | undefined,
    resetEpoch: number,
    stagger: CounterStagger | null = null,
) => {
    const [feedback, setFeedback] = useState({ ...EMPTY_FEEDBACK, epoch: resetEpoch });
    const prevHpRef = useRef(currentHp);
    const epochRef = useRef(resetEpoch);
    const consumedStaggerKeyRef = useRef(stagger?.key ?? null);
    const timersRef = useRef<FlashTimers>({ pendingShows: new Set(), flash: undefined, amount: undefined });

    useEffect(() => {
        const timers = timersRef.current;
        return () => clearFlashTimers(timers);
    }, []);

    useEffect(() => {
        const timers = timersRef.current;
        if (epochRef.current !== resetEpoch) {
            epochRef.current = resetEpoch;
            prevHpRef.current = currentHp;
            consumedStaggerKeyRef.current = stagger?.key ?? null;
            clearFlashTimers(timers);
            setFeedback({ ...EMPTY_FEEDBACK, epoch: resetEpoch });
            return;
        }
        if (typeof currentHp !== 'number') return;

        const prev = prevHpRef.current;
        prevHpRef.current = currentHp;
        if (typeof prev !== 'number') return;

        const delta = currentHp - prev;
        if (delta === 0) return;

        const freshStagger = Boolean(stagger?.key) && stagger?.key !== consumedStaggerKeyRef.current;
        consumedStaggerKeyRef.current = stagger?.key ?? consumedStaggerKeyRef.current;
        const delayMs = freshStagger ? Math.max(0, stagger?.delayMs ?? 0) : 0;

        const isHeal = delta > 0;
        const show = () => {
            setFeedback({
                epoch: resetEpoch,
                damageFlash: !isHeal,
                healFlash: isHeal,
                damageAmount: { value: Math.abs(delta), isHeal },
            });
            clearTimeout(timers.flash);
            clearTimeout(timers.amount);
            timers.flash = setTimeout(() => {
                setFeedback((current) => ({ ...current, damageFlash: false, healFlash: false }));
            }, FLASH_MS);
            timers.amount = setTimeout(() => {
                setFeedback((current) => ({ ...current, damageAmount: null }));
            }, AMOUNT_MS);
        };
        if (delayMs <= 0) {
            show();
            return;
        }
        const pending: Timer = setTimeout(() => {
            timers.pendingShows.delete(pending);
            show();
        }, delayMs);
        timers.pendingShows.add(pending);
    // 지연 값은 생명이 바뀐 그 렌더의 것을 읽는다(같은 전이에서 함께 바뀐다) — 지연만 바뀐 렌더는 연출을 다시 걸지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentHp, resetEpoch]);

    // 생명이 바뀌지 않은 차례(적이 빗나감)의 지연은 여기서 소비한다 — 남겨 두면 뒤의 휴식 · 물약 회복이 늦게 보인다.
    //   위 효과보다 뒤에 선언해 같은 커밋에서는 위 효과가 먼저 그 차례의 지연을 쓴다.
    const staggerKey = stagger?.key ?? null;
    useEffect(() => {
        consumedStaggerKeyRef.current = staggerKey;
    }, [staggerKey]);

    const { epoch, ...visibleFeedback } = feedback;
    return epoch === resetEpoch ? visibleFeedback : EMPTY_FEEDBACK;
};
