import type { ErrorReporter, SanitizedErrorReport } from './errorReporter';

/**
 * 정리된 오류 리포트(`SanitizedErrorReport`)를 Sentry로 보내는 얇은 전송기.
 *
 * Sentry SDK를 쓰지 않는다 — SDK의 자동 수집(브레드크럼 · 요청 · 사용자 · 화면 녹화)은
 * Phase B 계약(원문 메시지 · 식별자 금지) 밖의 값을 실어 보낸다. 여기서는 리포트가 이미
 * 가진 값(코드 · 출처 · 릴리스 · 런타임 · OS · 알려진 스크립트의 파일 · 줄 · 칸)만
 * 봉투(envelope) 하나로 보낸다. 세션 id는 보내지 않는다.
 *
 * DSN은 빌드 환경(`VITE_SENTRY_DSN`)에서만 온다 — 없거나 형식이 틀리면 아무것도 보내지 않는다.
 * 전송 실패는 게임으로 번지지 않는다(fail-open).
 */

/** 한 페이지 세션에서 보내는 리포트 수 상한 — 오류가 반복되는 화면이 할당량을 태우지 않게 한다. */
export const SENTRY_MAX_REPORTS_PER_SESSION = 10;

const SENTRY_PUBLIC_KEY = /^[a-f0-9]{32}$/;
const SENTRY_PROJECT_ID = /^\d+$/;
const SENTRY_FRAME_PREFIX = 'app:///';

export interface SentryDsn {
    publicKey: string;
    projectId: string;
    envelopeUrl: string;
}

export const parseSentryDsn = (value: unknown): SentryDsn | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.password || url.search || url.hash) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const projectId = segments.pop() ?? '';
    if (!SENTRY_PUBLIC_KEY.test(url.username) || !SENTRY_PROJECT_ID.test(projectId)) return null;
    const pathPrefix = segments.length > 0 ? `/${segments.join('/')}` : '';
    const query = new URLSearchParams({ sentry_version: '7', sentry_key: url.username });
    return {
        publicKey: url.username,
        projectId,
        envelopeUrl: `${url.origin}${pathPrefix}/api/${projectId}/envelope/?${query.toString()}`,
    };
};

/**
 * Sentry 이벤트 본문. 프레임은 Sentry 규약대로 오래된 호출이 먼저다(리포트는 최근 호출이 먼저).
 * 파일 이름은 `app:///` 접두어를 붙여 소스맵을 릴리스별 `--url-prefix app:///`로 올릴 수 있게 한다.
 */
export const buildSentryEvent = (report: SanitizedErrorReport, eventId: string, nowMs: number) => {
    const frames = [...report.frames].reverse().map((frame) => ({
        filename: `${SENTRY_FRAME_PREFIX}${frame.filename}`,
        abs_path: `${SENTRY_FRAME_PREFIX}${frame.filename}`,
        function: frame.functionName,
        lineno: frame.line,
        colno: frame.column,
        in_app: true,
    }));
    return {
        event_id: eventId,
        timestamp: nowMs / 1000,
        platform: 'javascript',
        level: report.source === 'boundary' ? 'fatal' : 'error',
        release: report.releaseId,
        environment: report.runtime,
        tags: { source: report.source, runtime: report.runtime, os: report.os },
        exception: {
            values: [{
                type: report.code,
                value: report.source,
                mechanism: { type: report.source, handled: report.source === 'boundary' },
                ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
            }],
        },
    };
};

export const buildSentryEnvelope = (
    report: SanitizedErrorReport,
    eventId: string,
    nowMs: number,
): string => [
    JSON.stringify({ event_id: eventId, sent_at: new Date(nowMs).toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(buildSentryEvent(report, eventId, nowMs)),
].join('\n');

const createRandomEventId = (): string => {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const reportKey = (report: SanitizedErrorReport): string => {
    const top = report.frames[0];
    return [report.code, report.source, top ? `${top.filename}:${top.line}:${top.column}` : ''].join('|');
};

type SentryFetch = (url: string, init: {
    method: 'POST';
    body: string;
    keepalive: boolean;
    credentials: 'omit';
    referrerPolicy: 'origin';
}) => Promise<unknown>;

export const createSentryErrorReporter = ({
    dsn,
    fetchImpl = typeof fetch === 'function' ? (fetch as unknown as SentryFetch) : null,
    now = () => Date.now(),
    createEventId = createRandomEventId,
    maxReports = SENTRY_MAX_REPORTS_PER_SESSION,
}: {
    dsn: unknown;
    fetchImpl?: SentryFetch | null;
    now?: () => number;
    createEventId?: () => string;
    maxReports?: number;
}): ErrorReporter | null => {
    const target = parseSentryDsn(dsn);
    if (!target || !fetchImpl) return null;
    const sent = new Set<string>();
    return {
        capture: (report) => {
            // 릴리스가 없는 리포트(로컬 · 웹 빌드)는 보내지 않는다 — 운영 증거를 지어내지 않는다.
            if (!report.releaseId || sent.size >= maxReports) return;
            const key = reportKey(report);
            if (sent.has(key)) return;
            sent.add(key);
            try {
                const eventId = createEventId();
                fetchImpl(target.envelopeUrl, {
                    method: 'POST',
                    body: buildSentryEnvelope(report, eventId, now()),
                    keepalive: true,
                    credentials: 'omit',
                    referrerPolicy: 'origin',
                }).catch(() => undefined);
            } catch {
                // 전송 준비 실패도 게임으로 번지지 않는다.
            }
        },
    };
};
