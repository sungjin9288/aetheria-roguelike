import { useEffect, useState } from 'react';
import { getRelicAcquisitionMoment, type RelicAcquisitionMoment } from '../utils/relicSynergyHint';
import type { Relic } from '../types/index.js';

/** 유물 획득 띠가 머무는 시간 — 표시 연출 값(밸런스가 아니다). 감사 GF-08이 제안한 1.4초. */
export const RELIC_ACQUIRED_BANNER_MS = 1400;
/** 조합이 켜진 띠는 대가 한 줄이 더 있어 조금 더 머문다. */
export const RELIC_SYNERGY_BANNER_MS = 2000;

/** 띠 하나 — `serial`은 새 유물마다 오른다. */
export interface RelicAcquisitionBannerMoment extends RelicAcquisitionMoment {
    serial: number;
}

interface RelicMomentTracking {
    relics: readonly Relic[] | null | undefined;
    epoch: number;
    moment: RelicAcquisitionMoment | null;
    serial: number;
}

/**
 * 가진 유물에 새 유물이 들어온 순간 — 2026-10 (감사 GF-08). 고른 유물이 창이 닫히는 것으로 끝나 빌드를 바꾸는 순간이 조용히 지나갔다.
 * 판정은 `getRelicAcquisitionMoment`(빌린 유물 제외 · 켜진 조합은 엔진과 같은 판정)이고, 여기는 직전 목록의 기억과 해제 타이머만 갖는다.
 * 처음 렌더와 복원(`presentationEpoch`가 바뀐 렌더)으로 바뀐 목록은 알리지 않는다 — 받지 않은 유물을 알리지 않는다. 떠 있던 띠도 내린다.
 * 기록 줄은 남기지 않는다(줄 하나가 자연 플레이 측정의 난수열을 밀 수 있다 — Wave 111 · 117).
 */
export const useRelicAcquisitionMoment = (
    relics: readonly Relic[] | null | undefined,
    presentationEpoch: number,
): RelicAcquisitionBannerMoment | null => {
    const [tracking, setTracking] = useState<RelicMomentTracking>(() => ({
        relics,
        epoch: presentationEpoch,
        moment: null,
        serial: 0,
    }));

    // 이전 렌더와 다르면 렌더 중에 바로 갱신한다(React의 "이전 props에서 상태 도출" 패턴).
    if (presentationEpoch !== tracking.epoch) {
        setTracking({ relics, epoch: presentationEpoch, moment: null, serial: tracking.serial });
    } else if (relics !== tracking.relics) {
        const moment = getRelicAcquisitionMoment(tracking.relics, relics);
        setTracking({
            relics,
            epoch: presentationEpoch,
            moment: moment ?? tracking.moment,
            serial: moment ? tracking.serial + 1 : tracking.serial,
        });
    }

    useEffect(() => {
        if (!tracking.moment) return undefined;
        const serial = tracking.serial;
        const holdMs = tracking.moment.synergy ? RELIC_SYNERGY_BANNER_MS : RELIC_ACQUIRED_BANNER_MS;
        const timer = window.setTimeout(() => {
            setTracking((current) => (current.serial === serial ? { ...current, moment: null } : current));
        }, holdMs);
        return () => window.clearTimeout(timer);
    }, [tracking.moment, tracking.serial]);

    if (tracking.epoch !== presentationEpoch || !tracking.moment) return null;
    return { ...tracking.moment, serial: tracking.serial };
};
