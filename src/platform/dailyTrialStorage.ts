import { CONSTANTS } from '../data/constants';
import type { DailyTrialSave } from '../reducers/dailyTrial';
import { isDailyTrialDayKey } from '../systems/dailyTrial';
import type { DailyTrialOutcome, DailyTrialResult } from '../types';
import { hasMigratedPlayer, migrateData } from '../utils/dataMigration';

/**
 * 오늘의 시련의 저장 칸 — 본편 세이브(`gameStorage`)와 다른 칸이다. 시련 중에는 이 칸만 쓴다.
 *
 * 칸은 하나이고 오늘의 판만 남는다(다른 날짜의 칸은 읽을 때 버린다). 저장소가 막힌 환경에서는 이어 하기가 없을 뿐
 * 시련은 그대로 걸을 수 있다 — 실패를 게임으로 전파하지 않는다.
 */

export const DAILY_TRIAL_STORAGE_KEY = 'aetheria.daily-trial.v1';

export type DailyTrialStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const runtimeStorage = (): DailyTrialStorage | null => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
};

const OUTCOMES: ReadonlySet<unknown> = new Set<DailyTrialOutcome>(['cleared', 'dead', 'left']);

const toCount = (value: unknown): number => {
    const numeric = Math.trunc(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const readResult = (value: unknown): DailyTrialResult | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Partial<DailyTrialResult>;
    if (!OUTCOMES.has(raw.outcome)) return null;
    const outcome = raw.outcome as DailyTrialOutcome;
    return { outcome, cleared: outcome === 'cleared', maps: toCount(raw.maps), actions: toCount(raw.actions) };
};

/** 오늘(`dayKey`)의 멈춘 판 — 없거나 다른 날짜이거나 읽을 수 없으면 null이다. */
export const loadDailyTrialSave = (dayKey: string, storage: DailyTrialStorage | null = runtimeStorage()): DailyTrialSave | null => {
    try {
        const text = storage?.getItem(DAILY_TRIAL_STORAGE_KEY);
        if (!text) return null;
        const raw = JSON.parse(text) as { dayKey?: unknown; actions?: unknown; result?: unknown; state?: unknown } | null;
        if (!raw || !isDailyTrialDayKey(raw.dayKey) || raw.dayKey !== dayKey) return null;
        const migrated = migrateData(raw.state);
        if (!hasMigratedPlayer(migrated) || migrated.player.trialRun?.dayKey !== dayKey) return null;
        return { dayKey, actions: toCount(raw.actions), result: readResult(raw.result), state: migrated };
    } catch {
        return null;
    }
};

export const saveDailyTrial = (save: DailyTrialSave, storage: DailyTrialStorage | null = runtimeStorage()): boolean => {
    if (!storage) return false;
    try {
        storage.setItem(DAILY_TRIAL_STORAGE_KEY, JSON.stringify({ ...save, state: { ...save.state, version: CONSTANTS.DATA_VERSION } }));
        return true;
    } catch {
        return false;
    }
};

export const clearDailyTrialSave = (storage: DailyTrialStorage | null = runtimeStorage()): void => {
    try { storage?.removeItem(DAILY_TRIAL_STORAGE_KEY); } catch { /* 저장소가 막힌 환경 — 남길 칸도 없다 */ }
};
