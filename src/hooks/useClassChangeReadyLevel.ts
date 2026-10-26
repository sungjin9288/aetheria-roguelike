import { useEffect, useState } from 'react';
import { isClassChangeNewlyReady } from '../utils/classChangeReadiness';

/**
 * 레벨 상승 띠의 전직 부제가 머무는 시간 — 레벨 상승 띠(1.8초)보다 조금 길게 잡아 띠가 내려가기 전에 부제가 먼저 사라지지 않게 한다.
 * 표시 연출 값이다(밸런스가 아니다).
 */
export const CLASS_CHANGE_READY_HOLD_MS = 2200;

interface ClassChangeReadyTracking {
    level: number | undefined;
    job: string | undefined;
    epoch: number;
    readyLevel: number | null;
    serial: number;
}

/**
 * 레벨업으로 전직이 새로 열린 순간의 레벨 — 2026-10 (감사 CL-05). 레벨 상승 띠가 그 레벨(이상)을 보이는 동안 부제
 *   '전직할 수 있습니다'를 단다(`isLevelUpClassChangeReady`). 판정은 `isClassChangeNewlyReady`(전직 액션과 같은 조건)이고,
 *   여기는 직전 레벨의 기억과 해제 타이머만 갖는다.
 * 처음 렌더 · 복원(`presentationEpoch`가 바뀐 렌더) · 직업이 바뀐 렌더(전직했다) · 레벨이 내려간 렌더(새 여정)는 알리지 않고 지운다.
 * 이어서 오른 레벨업이 있으면 해제 시간을 다시 잡는다 — 띠가 다음 레벨로 바뀌어도 부제가 함께 남는다.
 * 기록 줄은 더하지 않는다 — 화면의 순간만 더한다(기록 · 자연 플레이 측정은 그대로다).
 */
export const useClassChangeReadyLevel = (
    level: number | undefined,
    job: string | undefined,
    presentationEpoch: number,
): number | null => {
    const [tracking, setTracking] = useState<ClassChangeReadyTracking>(() => ({
        level,
        job,
        epoch: presentationEpoch,
        readyLevel: null,
        serial: 0,
    }));

    // 이전 렌더와 다르면 렌더 중에 바로 갱신한다(React의 "이전 props에서 상태 도출" 패턴).
    if (presentationEpoch !== tracking.epoch || job !== tracking.job) {
        setTracking({ level, job, epoch: presentationEpoch, readyLevel: null, serial: tracking.serial });
    } else if (level !== tracking.level) {
        const previous = tracking.level;
        const rose = typeof level === 'number' && typeof previous === 'number' && level > previous;
        const readyLevel = !rose
            ? null
            : isClassChangeNewlyReady(job, previous, level) ? level : tracking.readyLevel;
        setTracking({
            level,
            job,
            epoch: presentationEpoch,
            readyLevel,
            serial: readyLevel !== null ? tracking.serial + 1 : tracking.serial,
        });
    }

    useEffect(() => {
        if (tracking.readyLevel === null) return undefined;
        const serial = tracking.serial;
        const timer = window.setTimeout(() => {
            setTracking((current) => (current.serial === serial ? { ...current, readyLevel: null } : current));
        }, CLASS_CHANGE_READY_HOLD_MS);
        return () => window.clearTimeout(timer);
    }, [tracking.readyLevel, tracking.serial]);

    return tracking.epoch === presentationEpoch && tracking.job === job ? tracking.readyLevel : null;
};
