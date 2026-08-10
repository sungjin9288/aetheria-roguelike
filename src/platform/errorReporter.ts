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

export const readKnownRuntimeScriptFilenames = (
    source: Pick<Document, 'scripts'> | null = typeof document === 'undefined' ? null : document,
): string[] => {
    if (!source) return [];
    return Array.from(source.scripts)
        .map((script) => sanitizeFilename(script.src))
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
        cause: (event as any)?.error,
        filename: (event as any)?.filename,
        line: (event as any)?.lineno,
        column: (event as any)?.colno,
        knownScriptFilenames,
    }, context));
    const onUnhandledRejection = (event: unknown) => reporter.capture(createSanitizedErrorReport({
        code: 'unhandled_rejection',
        source: 'unhandled_rejection',
        cause: (event as any)?.reason,
        knownScriptFilenames,
    }, context));
    target.addEventListener('error', onWindowError);
    target.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
        target.removeEventListener('error', onWindowError);
        target.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
};
