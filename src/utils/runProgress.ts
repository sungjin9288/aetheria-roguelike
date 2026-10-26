import type { Player } from '../types/player.js';
import { getEssenceLifetime, type EssenceMeta } from '../systems/essenceLedger.js';
import type { JourneyCounterKey } from './journeyScope.js';

export interface CurrentRunProgress {
    startedAt: number | null;
    complete: boolean;
    killsAtStart: number;
    bossKillsAtStart: number;
    totalGoldAtStart: number;
    escapesAtStart: number;
    visitedMapsAtStart: string[];
    maxKillStreak: number;
    /**
     * 2026-10 Wave 108: 여정 범위 진행(업적 · 칭호 · 임무)이 읽는 누적 카운터의 여정 시작 값(`utils/journeyScope.ts`
     * `getJourneyCounter`). 이전 세이브에는 없다 — 그때는 평생 값을 그대로 읽는다.
     */
    countersAtStart?: Partial<Record<JourneyCounterKey, number>>;
    /**
     * 여정 시작 때의 누적 계승 정수(`getEssenceLifetime`) — 사망 화면이 이번 여정에 모은 계승 정수를 센다(`getJourneyEssenceGain`).
     * 이전 세이브에는 없다 — 그때는 모은 양을 그리지 않는다(지어내지 않는다).
     */
    essenceAtStart?: number;
}

const JOURNEY_COUNTER_KEYS: readonly JourneyCounterKey[] = Object.freeze([
    'kills', 'bossKills', 'total_gold', 'escapes', 'explores', 'rests', 'crafts', 'syntheses', 'relicCount', 'bountiesCompleted',
]);

const snapshotJourneyCounters = (stats: Player['stats'] = {}): Record<JourneyCounterKey, number> => (
    Object.fromEntries(JOURNEY_COUNTER_KEYS.map((key) => [key, toCount(stats?.[key])])) as Record<JourneyCounterKey, number>
);

const readCountersAtStart = (value: unknown): Partial<Record<JourneyCounterKey, number>> | undefined => {
    if (!isRecord(value)) return undefined;
    return Object.fromEntries(JOURNEY_COUNTER_KEYS.map((key) => [key, toCount(value[key])])) as Record<JourneyCounterKey, number>;
};

const toCount = (value: unknown) => Math.max(0, Number.isFinite(value) ? Number(value) : 0);

const readEssenceAtStart = (value: unknown): { essenceAtStart: number } | Record<string, never> => (
    Number.isFinite(value) ? { essenceAtStart: Math.floor(toCount(value)) } : {}
);

const toUniqueLocations = (value: unknown) => (
    Array.isArray(value)
        ? [...new Set(value.filter((location): location is string => typeof location === 'string' && location.length > 0))]
        : []
);

/** player.stats처럼 신뢰할 수 없는 저장 데이터 필드를 동적 키로 읽기 위한 narrowing. */
const isRecord = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const createCurrentRunProgress = (
    stats: Player['stats'] = {},
    options: { complete?: boolean; startedAt?: number | null; essenceLifetime?: number } = {},
): CurrentRunProgress => ({
    startedAt: options.startedAt === undefined ? Date.now() : options.startedAt,
    complete: options.complete !== false,
    killsAtStart: toCount(stats.kills),
    bossKillsAtStart: toCount(stats.bossKills),
    totalGoldAtStart: toCount(stats.total_gold),
    escapesAtStart: toCount(stats.escapes),
    visitedMapsAtStart: toUniqueLocations(stats.visitedMaps),
    maxKillStreak: 0,
    countersAtStart: snapshotJourneyCounters(stats),
    ...readEssenceAtStart(options.essenceLifetime),
});

/**
 * W11-C2(B2): `now`는 "currentRun이 아예 없던 저장본에 런을 새로 여는 시각"이다.
 * 생략하면 `createCurrentRunProgress`의 기본값(`Date.now()`)이 그대로 쓰여 기존 동작과 같고,
 * `migrateData(raw, { now })`처럼 시각을 소유한 호출자가 넘기면 그 경로가 결정론적이 된다.
 */
export const normalizeCurrentRunProgress = (
    stats: Player['stats'] = {},
    options: { now?: number } = {},
): CurrentRunProgress => {
    // stats.currentRun은 CurrentRunProgress 타입이지만 이 함수 자체가 구형/손상된
    // 저장 데이터를 방어적으로 정규화하는 경계다 — unknown으로 다시 받아 재검증한다.
    const currentRun: unknown = stats.currentRun;
    if (!isRecord(currentRun)) {
        // 2026-10 Wave 108: 여정 시작을 모르는 이전 세이브에는 카운터 기준점을 찍지 않는다 — 지금 값을 기준점으로
        //   찍으면 진행 중이던 업적 · 칭호 · 임무 진행이 0으로 떨어진다(평생 값 그대로 읽는다).
        const { countersAtStart: _unknownStart, ...legacy } = createCurrentRunProgress(stats, { complete: false, startedAt: options.now });
        return legacy;
    }

    return {
        startedAt: Number.isFinite(currentRun.startedAt) ? Number(currentRun.startedAt) : null,
        complete: currentRun.complete !== false,
        killsAtStart: toCount(currentRun.killsAtStart),
        bossKillsAtStart: toCount(currentRun.bossKillsAtStart),
        totalGoldAtStart: toCount(currentRun.totalGoldAtStart),
        escapesAtStart: toCount(currentRun.escapesAtStart),
        visitedMapsAtStart: toUniqueLocations(currentRun.visitedMapsAtStart),
        maxKillStreak: toCount(currentRun.maxKillStreak),
        ...(readCountersAtStart(currentRun.countersAtStart) ? { countersAtStart: readCountersAtStart(currentRun.countersAtStart) } : {}),
        ...readEssenceAtStart(currentRun.essenceAtStart),
    };
};

/**
 * 이번 여정에 모은 계승 정수 — 누적 정수(소비해도 줄지 않는다) − 여정 시작 기준점. 기준점이 없는 이전 세이브는 `null`
 * (사망 화면이 그 줄을 그리지 않는다).
 */
export const getJourneyEssenceGain = (player: { stats?: Player['stats']; meta?: EssenceMeta | null } | null | undefined): number | null => {
    const currentRun: unknown = player?.stats?.currentRun;
    if (!isRecord(currentRun) || !Number.isFinite(currentRun.essenceAtStart)) return null;
    return Math.max(0, getEssenceLifetime(player?.meta) - Math.floor(toCount(currentRun.essenceAtStart)));
};

export const getCurrentRunSnapshot = (stats: Player['stats'] = {}) => {
    const currentRun = normalizeCurrentRunProgress(stats);
    const visitedAtStart = new Set(currentRun.visitedMapsAtStart);
    const visitedNow = toUniqueLocations(stats.visitedMaps);

    return {
        complete: currentRun.complete,
        kills: Math.max(0, toCount(stats.kills) - currentRun.killsAtStart),
        bossKills: Math.max(0, toCount(stats.bossKills) - currentRun.bossKillsAtStart),
        totalGold: Math.max(0, toCount(stats.total_gold) - currentRun.totalGoldAtStart),
        escapes: Math.max(0, toCount(stats.escapes) - currentRun.escapesAtStart),
        discoveries: visitedNow.filter((location) => !visitedAtStart.has(location)).length,
        maxKillStreak: currentRun.maxKillStreak,
    };
};

export const recordCurrentRunMaxKillStreak = (stats: Player['stats'] = {}, streak: number) => {
    const currentRun = normalizeCurrentRunProgress(stats);
    return {
        ...stats,
        currentRun: {
            ...currentRun,
            maxKillStreak: Math.max(currentRun.maxKillStreak, toCount(streak)),
        },
    };
};
