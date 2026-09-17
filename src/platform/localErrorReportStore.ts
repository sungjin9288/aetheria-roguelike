import { BALANCE } from '../data/constants';
import type { ErrorReporter, SanitizedErrorReport } from './errorReporter';

/**
 * E1 — 런타임 에러 리포트 로컬 링버퍼.
 *
 * 백엔드 에러 수집 엔드포인트가 없으므로(네트워크 전송 금지), 프로덕션에서 발생한
 * 크래시를 기기 안에만 남겨 두는 privacy-preserving sink. `errorReporter.ts`의
 * `installRuntimeErrorReporter()`에 이 모듈의 리포터를 등록해야 실제로 수집된다.
 */
export const LOCAL_ERROR_REPORT_STORAGE_KEY = 'aetheria.platform.error_reports.v1';

export interface StoredErrorReport {
    report: SanitizedErrorReport;
    capturedAt: number;
}

export interface LocalErrorReportStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const resolveDefaultStorage = (): LocalErrorReportStorage | null => {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        // 사생활 보호 모드 등에서 localStorage 접근 자체가 throw할 수 있음
        return null;
    }
};

const isSanitizedStackFrame = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const frame = value as Record<string, unknown>;
    return typeof frame.filename === 'string'
        && typeof frame.functionName === 'string'
        && Number.isFinite(frame.line)
        && Number.isFinite(frame.column);
};

const isStoredErrorReport = (value: unknown): value is StoredErrorReport => {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Record<string, unknown>;
    const report = entry.report as Record<string, unknown> | undefined;
    return Number.isFinite(entry.capturedAt)
        && !!report
        && typeof report === 'object'
        && typeof report.code === 'string'
        && typeof report.source === 'string'
        && typeof report.sessionId === 'string'
        && Array.isArray(report.frames)
        && report.frames.every(isSanitizedStackFrame);
};

/**
 * 저장된 리포트를 읽는다. 손상된 JSON, 저장소 접근 실패, 예상 밖의 구조는 모두
 * 조용히 빈 배열로 취급한다 — 읽기 실패가 화면 렌더링을 막아서는 안 된다.
 */
export const readErrorReports = (
    storage: LocalErrorReportStorage | null = resolveDefaultStorage(),
): StoredErrorReport[] => {
    if (!storage) return [];
    try {
        const raw = storage.getItem(LOCAL_ERROR_REPORT_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isStoredErrorReport);
    } catch {
        return [];
    }
};

export const clearErrorReports = (
    storage: LocalErrorReportStorage | null = resolveDefaultStorage(),
): void => {
    if (!storage) return;
    try {
        storage.removeItem(LOCAL_ERROR_REPORT_STORAGE_KEY);
    } catch {
        // 저장소 접근 실패 시 조용히 무시
    }
};

const writeErrorReports = (
    storage: LocalErrorReportStorage,
    reports: readonly StoredErrorReport[],
): void => {
    try {
        storage.setItem(LOCAL_ERROR_REPORT_STORAGE_KEY, JSON.stringify(reports));
    } catch {
        // 저장소 접근 실패(사생활 보호 모드, 용량 초과 등) — capture()가 던지지 않도록 무시
    }
};

/**
 * `installRuntimeErrorReporter(createLocalErrorReporter())`로 부팅 시 등록한다.
 * `capture()`는 전역 에러 핸들러 체인에서 직접 호출되므로 절대 throw하지 않는다.
 */
export const createLocalErrorReporter = (
    storage: LocalErrorReportStorage | null = resolveDefaultStorage(),
    now: () => number = () => Date.now(),
): ErrorReporter => ({
    capture(report: SanitizedErrorReport): void {
        if (!storage) return;
        try {
            const existing = readErrorReports(storage);
            const next = [...existing, { report, capturedAt: now() }];
            const overflow = next.length - BALANCE.ERROR_REPORT_RING_SIZE;
            const trimmed = overflow > 0 ? next.slice(overflow) : next;
            writeErrorReports(storage, trimmed);
        } catch {
            // capture()는 절대 throw하지 않는다 — window error / unhandledrejection 체인을 보존
        }
    },
});
