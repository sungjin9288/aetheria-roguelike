import type { ProductEventContext } from './productEvents';

export type ErrorReportSource = 'boundary' | 'window_error' | 'unhandled_rejection';

export interface SanitizedStackFrame {
    functionName: string;
    filename: string;
    line: number;
    column: number;
}

export interface SanitizedErrorReport {
    code: string;
    source: ErrorReportSource;
    releaseId: string;
    runtime: ProductEventContext['runtime'];
    os: ProductEventContext['os'];
    sessionId: string;
    frames: SanitizedStackFrame[];
}

export interface ErrorReporter {
    capture(report: SanitizedErrorReport): void;
}

export const NOOP_ERROR_REPORTER: ErrorReporter = {
    capture: () => undefined,
};

let runtimeErrorReporter: ErrorReporter = NOOP_ERROR_REPORTER;

export const installRuntimeErrorReporter = (reporter: ErrorReporter): void => {
    runtimeErrorReporter = reporter;
};

export const getRuntimeErrorReporter = (): ErrorReporter => runtimeErrorReporter;

/** 여러 리포터에 같은 리포트를 건넨다 — 한 리포터의 실패가 다른 리포터를 막지 않는다. */
export const composeErrorReporters = (
    ...reporters: ReadonlyArray<ErrorReporter | null | undefined>
): ErrorReporter => {
    const active = reporters.filter((reporter): reporter is ErrorReporter => !!reporter);
    return {
        capture: (report) => {
            for (const reporter of active) {
                try {
                    reporter.capture(report);
                } catch {
                    // 다음 리포터는 그대로 받는다.
                }
            }
        },
    };
};

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{2,63}$/;

const sanitizeFilename = (value: string): string => {
    const withoutQuery = value.split(/[?#]/, 1)[0];
    try {
        const pathname = new URL(withoutQuery).pathname.replace(/^\/+/, '');
        return pathname.split('/').slice(-2).join('/').slice(0, 160);
    } catch {
        return withoutQuery.replace(/\\/g, '/').split('/').slice(-2).join('/').slice(0, 160);
    }
};

const normalizeKnownScriptFilenames = (values: readonly string[]): Set<string> => new Set(
    values.map(sanitizeFilename).filter(Boolean),
);

type KnownScriptSource = Pick<Document, 'scripts'> & Partial<Pick<Document, 'querySelectorAll'>>;

/**
 * 앱 코드가 든 스크립트: 진입 스크립트(`<script>`)와 그것이 미리 받는 청크(`<link rel="modulepreload">` —
 * index.html의 정적 import 사슬, 그리고 동적 import를 시작할 때 Vite가 더하는 청크). 게임 화면(GameRoot와 그 의존)은
 * 앱이 뜨자마자 따로 받는 청크라(CH-03) `<script>`만 보면 게임 화면 오류의 위치가 리포트에서 빠진다.
 */
export const readKnownRuntimeScriptFilenames = (
    source: KnownScriptSource | null = typeof document === 'undefined' ? null : document,
): string[] => {
    if (!source) return [];
    const preloaded = source.querySelectorAll
        ? Array.from(source.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]'), (link) => link.href)
        : [];
    return [...Array.from(source.scripts, (script) => script.src), ...preloaded]
        .map(sanitizeFilename)
        .filter(Boolean);
};

export const sanitizeErrorFrames = ({
    cause,
    filename,
    line,
    column,
    knownScriptFilenames = [],
}: {
    cause?: unknown;
    filename?: unknown;
    line?: unknown;
    column?: unknown;
    knownScriptFilenames?: readonly string[];
}): SanitizedStackFrame[] => {
    const frames: SanitizedStackFrame[] = [];
    const knownScripts = normalizeKnownScriptFilenames(knownScriptFilenames);
    const stack = cause instanceof Error ? String(cause.stack || '') : '';
    for (const stackLine of stack.split('\n').slice(1, 13)) {
        const match = stackLine.trim().match(/^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
        if (!match) continue;
        const frameFilename = sanitizeFilename(match[2]);
        if (!frameFilename || !knownScripts.has(frameFilename)) continue;
        frames.push({
            functionName: 'anonymous',
            filename: frameFilename,
            line: Number(match[3]),
            column: Number(match[4]),
        });
    }
    if (frames.length === 0 && filename) {
        const frameFilename = sanitizeFilename(String(filename));
        const frameLine = Number(line);
        const frameColumn = Number(column);
        if (
            frameFilename
            && knownScripts.has(frameFilename)
            && Number.isSafeInteger(frameLine)
            && Number.isSafeInteger(frameColumn)
        ) {
            frames.push({
                functionName: 'anonymous',
                filename: frameFilename,
                line: frameLine,
                column: frameColumn,
            });
        }
    }
    return frames;
};

export const createSanitizedErrorReport = (
    {
        code,
        source,
        cause,
        filename,
        line,
        column,
        knownScriptFilenames,
    }: {
        code: string;
        source: ErrorReportSource;
        cause?: unknown;
        filename?: unknown;
        line?: unknown;
        column?: unknown;
        knownScriptFilenames?: readonly string[];
    },
    context: ProductEventContext,
): SanitizedErrorReport => {
    if (!SAFE_ERROR_CODE.test(code)) throw new Error('Invalid error code');
    if (!['boundary', 'window_error', 'unhandled_rejection'].includes(source)) {
        throw new Error('Invalid error source');
    }
    return {
        code,
        source,
        releaseId: context.releaseId,
        runtime: context.runtime,
        os: context.os,
        sessionId: context.sessionId,
        frames: sanitizeErrorFrames({ cause, filename, line, column, knownScriptFilenames }),
    };
};

interface ErrorEventTarget {
    addEventListener(name: string, listener: (event: unknown) => void): void;
    removeEventListener(name: string, listener: (event: unknown) => void): void;
}

/**
 * `window`의 `error`/`unhandledrejection` 리스너가 받는 값은 실제로는
 * `ErrorEvent`/`PromiseRejectionEvent`이지만, 이 모듈은 DOM lib에 의존하지 않고
 * `unknown`으로만 받는다 — 필드 존재 여부를 `in`으로 좁혀 안전하게 읽는다.
 */
const hasField = <K extends PropertyKey>(value: unknown, field: K): value is Record<K, unknown> => (
    typeof value === 'object' && value !== null && field in value
);

export const bindGlobalErrorReporter = ({
    target,
    context,
    reporter,
    knownScriptFilenames = [],
}: {
    target: ErrorEventTarget;
    context: ProductEventContext;
    reporter: ErrorReporter;
    knownScriptFilenames?: readonly string[];
}) => {
    const onWindowError = (event: unknown) => reporter.capture(createSanitizedErrorReport({
        code: 'window_error',
        source: 'window_error',
        cause: hasField(event, 'error') ? event.error : undefined,
        filename: hasField(event, 'filename') ? event.filename : undefined,
        line: hasField(event, 'lineno') ? event.lineno : undefined,
        column: hasField(event, 'colno') ? event.colno : undefined,
        knownScriptFilenames,
    }, context));
    const onUnhandledRejection = (event: unknown) => reporter.capture(createSanitizedErrorReport({
        code: 'unhandled_rejection',
        source: 'unhandled_rejection',
        cause: hasField(event, 'reason') ? event.reason : undefined,
        knownScriptFilenames,
    }, context));
    target.addEventListener('error', onWindowError);
    target.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
        target.removeEventListener('error', onWindowError);
        target.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
};
