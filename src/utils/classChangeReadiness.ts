import { CLASSES } from '../data/classes';

/**
 * 전직이 열렸는가 — 2026-10 (감사 CL-05): 전직은 이 게임에서 가장 큰 '강해졌다' 순간인데, 레벨업이 다음 직업의 레벨에 닿아도
 *   기록 · 배너가 아무 말도 하지 않았다(마을 시설 상태 '전직 가능'만). 판정은 전직 액션(`characterActions.jobChange` —
 *   지금 직업의 `next`에 있고 그 직업의 `reqLv` 이상)과 같은 조건이다. 규칙은 그대로이고 알림만 더한다.
 */
export const canChangeClassAt = (job: string | undefined, level: number): boolean => {
    const nextClasses = (job ? CLASSES[job]?.next : undefined) || [];
    return nextClasses.some((name) => {
        const target = CLASSES[name];
        return Boolean(target) && level >= (target.reqLv || 1);
    });
};

/** fromLevel → toLevel 레벨업으로 전직이 새로 열렸다(전에는 못 했고 지금은 할 수 있다). 이미 열려 있던 전직은 다시 알리지 않는다. */
export const isClassChangeNewlyReady = (job: string | undefined, fromLevel: number, toLevel: number): boolean => (
    toLevel > fromLevel && canChangeClassAt(job, toLevel) && !canChangeClassAt(job, fromLevel)
);

/**
 * 지금 떠 있는 레벨 상승 띠가 전직 부제를 다는가 — 띠의 레벨이 전직이 새로 열린 레벨(`useClassChangeReadyLevel`) 이상일 때.
 * 띠가 없거나(null) 새로 열린 전직이 없으면 false다.
 */
export const isLevelUpClassChangeReady = (bannerLevel: number | null | undefined, readyLevel: number | null | undefined): boolean => (
    typeof bannerLevel === 'number' && typeof readyLevel === 'number' && bannerLevel >= readyLevel
);
