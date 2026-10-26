import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getCombatAnnouncement, getCombatBeatTiming, isCounterStaggered } from '../utils/combatPresentation';
import type { CombatFeedback, DefeatedEnemySnapshot } from '../types/index.js';

/**
 * 전투 차례 연출의 박자 — 게임 필 감사 GF-01 · 02 · 06 · 11.
 *
 * 리듀서가 남긴 그 차례의 사실(`combatFeedback`)만 읽는다 — 기록 꼬리(마지막 줄의 종류)로 추측하지 않는다.
 *   - 내 치명타: 금빛 비네트 + 금빛 적 피해 숫자(`hitCrit`) — 적 강타에는 붙지 않는다.
 *   - 적 강타: 붉은 비네트 + 흔들림 — 내 타격 뒤 `counterDelayMs`에(박자를 나눌 때만).
 *   - 처치: 쓰러진 적을 `killBeatMs` 동안 그린다 — 결과 카드 · 유물 선택은 그 뒤에 뜬다.
 *
 * 새 차례만 연출한다: 마운트 때와 복원(`presentationEpoch`가 바뀐 렌더)에 있던 기록은 기준으로만 잡는다.
 * 타이머는 표시만 끈다 — 게임 상태 · 입력은 건드리지 않는다(§8-1 판정은 이미 끝났다).
 */
export interface CombatFeedbackBeats {
    /** 내 치명타 금빛 비네트. */
    critPulse: boolean;
    /** 적 강타 붉은 비네트. */
    heavyPulse: boolean;
    /** 적 강타 흔들림. */
    shake: boolean;
    /** 이번 차례 내 타격이 치명타였다 — 적 피해 숫자의 금빛 강조에 쓴다. */
    hitCrit: boolean;
    /** 처치 순간이면 쓰러진 적의 모습, 아니면 null. */
    defeatedEnemy: DefeatedEnemySnapshot | null;
    /** 새 차례의 화면 낭독기 요약(없으면 ''). */
    announcement: string;
    /** 낭독 영역이 같은 문장도 다시 읽도록 바꿔 끼우는 열쇠(새 차례의 영수증 키). */
    announcementKey: string | null;
}

interface BeatMarks {
    key: string | null;
    critOver: boolean;
    heavyOn: boolean;
    heavyOver: boolean;
    shakeOver: boolean;
    killOver: boolean;
}

const NO_MARKS: BeatMarks = {
    key: null,
    critOver: false,
    heavyOn: false,
    heavyOver: false,
    shakeOver: false,
    killOver: false,
};

interface Baseline {
    epoch: number;
    key: string | null;
}

export const useCombatFeedbackBeats = (
    feedback: CombatFeedback | null | undefined,
    resetEpoch: number,
): CombatFeedbackBeats => {
    const reducedMotion = Boolean(useReducedMotion());
    const [baseline, setBaseline] = useState<Baseline>({ epoch: resetEpoch, key: feedback?.key ?? null });
    // 복원이 일어난 렌더에서 기준을 바로 바꾼다(렌더 중 갱신 — 이전 렌더 값을 기억하는 표준 모양).
    const currentBaseline = baseline.epoch === resetEpoch
        ? baseline
        : { epoch: resetEpoch, key: feedback?.key ?? null };
    if (currentBaseline !== baseline) setBaseline(currentBaseline);
    const fresh = feedback && feedback.key !== currentBaseline.key ? feedback : null;

    const [marks, setMarks] = useState<BeatMarks>(NO_MARKS);
    const timing = getCombatBeatTiming(reducedMotion);
    const freshKey = fresh?.key ?? null;
    const counterDelay = isCounterStaggered(fresh) ? timing.counterDelayMs : 0;
    const { pulseMs, shakeMs, killBeatMs } = timing;

    useEffect(() => {
        if (!freshKey) return undefined;
        const mark = (patch: Partial<BeatMarks>) => setMarks((current) => ({
            ...(current.key === freshKey ? current : { ...NO_MARKS, key: freshKey }),
            ...patch,
        }));
        const timers = [
            setTimeout(() => mark({ critOver: true }), pulseMs),
            setTimeout(() => mark({ heavyOn: true }), counterDelay),
            setTimeout(() => mark({ heavyOver: true }), counterDelay + pulseMs),
            setTimeout(() => mark({ shakeOver: true }), counterDelay + shakeMs),
            setTimeout(() => mark({ killOver: true }), killBeatMs),
        ];
        return () => timers.forEach(clearTimeout);
    }, [freshKey, counterDelay, pulseMs, shakeMs, killBeatMs]);

    const current = marks.key === freshKey ? marks : NO_MARKS;
    const heavyActive = Boolean(fresh?.enemyHeavy) && (counterDelay === 0 || current.heavyOn);
    return {
        critPulse: Boolean(fresh?.playerCrit) && !current.critOver,
        heavyPulse: heavyActive && !current.heavyOver,
        shake: heavyActive && !current.shakeOver,
        hitCrit: Boolean(fresh?.playerCrit),
        defeatedEnemy: fresh?.defeatedEnemy && !current.killOver ? fresh.defeatedEnemy : null,
        announcement: getCombatAnnouncement(fresh),
        announcementKey: freshKey,
    };
};
