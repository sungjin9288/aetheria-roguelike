/** 수가 아니거나 무한이면 0. */
export const toFiniteNumber = (value: number | undefined): number => (
    typeof value === 'number' && Number.isFinite(value) ? value : 0
);

/** 막대 채움 백분율(0 ~ 100, 소수 한 자리). 최대가 0 이하이거나 수가 아니면 0이다. */
export const getGaugePercent = (value: number, max: number): number => {
    const safeMax = toFiniteNumber(max);
    if (safeMax <= 0) return 0;
    const ratio = toFiniteNumber(value) / safeMax;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10;
};
