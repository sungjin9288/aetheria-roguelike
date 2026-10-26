import { useEffect, useState } from 'react';
import { getEncounterBannerOnChange, getEncounterIdentity, type EncounterBanner } from '../utils/encounterBanner';
import type { Monster } from '../types/index.js';

/** 등장 띠가 머무는 시간 — 표시 연출 값(밸런스가 아니다). 감사 GF-09가 제안한 1.2초. */
export const ENCOUNTER_BANNER_MS = 1200;

/** 띠 하나 — `serial`은 새 조우마다 오른다(같은 보스를 다시 만나도 새 띠로 그린다). */
export interface EncounterBannerMoment extends EncounterBanner {
    serial: number;
}

interface EncounterTracking {
    identity: string | null;
    epoch: number;
    banner: EncounterBanner | null;
    serial: number;
}

/**
 * 전투 중인 적이 새 보스 · 우두머리로 바뀐 순간 띠를 잠깐 낸다 — 2026-10 (감사 GF-09).
 * 처음 렌더의 적과 복원(`presentationEpoch`가 바뀐 렌더 — 기기 간 복원 · QA 시드)으로 바뀐 적은 알리지 않는다:
 *   나타나지 않은 조우를 알리지 않는다(`useDamageFlash` · 레벨 상승 배너와 같은 규칙). 떠 있던 띠도 내린다.
 * 판정은 `utils/encounterBanner.ts`, 여기는 직전 정체의 기억과 해제 타이머만 갖는다.
 */
export const useEncounterBanner = (enemy: Monster | null | undefined, presentationEpoch: number): EncounterBannerMoment | null => {
    const [tracking, setTracking] = useState<EncounterTracking>(() => ({
        identity: getEncounterIdentity(enemy),
        epoch: presentationEpoch,
        banner: null,
        serial: 0,
    }));

    // 이전 렌더와 다르면 렌더 중에 바로 갱신한다(React의 "이전 props에서 상태 도출" 패턴) — 효과를 한 번 더 돌리지 않는다.
    const identity = getEncounterIdentity(enemy);
    if (presentationEpoch !== tracking.epoch) {
        setTracking({ identity, epoch: presentationEpoch, banner: null, serial: tracking.serial });
    } else if (identity !== tracking.identity) {
        const banner = getEncounterBannerOnChange(tracking.identity, enemy);
        setTracking({
            identity,
            epoch: presentationEpoch,
            // 전투가 끝나 적이 사라지면 띠도 내린다. 같은 전투에서 일반 적으로 바뀌는 일은 없지만, 그때도 남은 시간만 머문다.
            banner: banner ?? (identity ? tracking.banner : null),
            serial: banner ? tracking.serial + 1 : tracking.serial,
        });
    }

    useEffect(() => {
        if (!tracking.banner) return undefined;
        const serial = tracking.serial;
        const timer = window.setTimeout(() => {
            setTracking((current) => (current.serial === serial ? { ...current, banner: null } : current));
        }, ENCOUNTER_BANNER_MS);
        return () => window.clearTimeout(timer);
    }, [tracking.banner, tracking.serial]);

    if (tracking.epoch !== presentationEpoch || !tracking.banner) return null;
    return { ...tracking.banner, serial: tracking.serial };
};
