import assert from 'node:assert/strict';
import test from 'node:test';

import { composeErrorReporters, createSanitizedErrorReport } from '../src/platform/errorReporter.ts';
import { createProductEventContext } from '../src/platform/productEventContext.ts';
import {
    buildSentryEnvelope,
    createSentryErrorReporter,
    parseSentryDsn,
    SENTRY_MAX_REPORTS_PER_SESSION,
} from '../src/platform/sentryErrorReporter.ts';

const DSN = 'https://0123456789abcdef0123456789abcdef@o42.ingest.sentry.io/4505';
const SESSION_ID = 'session:00000000-0000-4000-8000-000000000042';

const context = createProductEventContext({
    releaseId: 'release-42',
    runtime: 'sandbox',
    os: 'ios',
    sessionId: SESSION_ID,
    startedAt: 1_000,
});

const makeReport = (code = 'react_render_failure', line = 12) => {
    const cause = new Error('nickname=private token=secret');
    cause.stack = [
        'Error: nickname=private token=secret',
        `    at renderGame (https://aetheria.tossmini.com/assets/app.js?token=secret:${line}:34)`,
        '    at mount (https://aetheria.tossmini.com/assets/vendor.js:7:8)',
    ].join('\n');
    return createSanitizedErrorReport({
        code,
        source: 'boundary',
        cause,
        knownScriptFilenames: ['assets/app.js', 'assets/vendor.js'],
    }, context);
};

const makeFetchSpy = () => {
    const calls = [];
    const fetchImpl = (url, init) => {
        calls.push({ url, init });
        return Promise.resolve({ ok: true });
    };
    return { calls, fetchImpl };
};

const parseEnvelope = (body) => body.split('\n').map((line) => JSON.parse(line));

test('DSN parser accepts only https DSNs with a public key and numeric project', () => {
    assert.deepEqual(parseSentryDsn(DSN), {
        publicKey: '0123456789abcdef0123456789abcdef',
        projectId: '4505',
        envelopeUrl: 'https://o42.ingest.sentry.io/api/4505/envelope/?sentry_version=7&sentry_key=0123456789abcdef0123456789abcdef',
    });
    assert.equal(
        parseSentryDsn('https://0123456789abcdef0123456789abcdef@sentry.example.com/relay/7').envelopeUrl,
        'https://sentry.example.com/relay/api/7/envelope/?sentry_version=7&sentry_key=0123456789abcdef0123456789abcdef',
    );
    for (const invalid of [
        undefined,
        '',
        'not a url',
        'http://0123456789abcdef0123456789abcdef@o42.ingest.sentry.io/4505',
        'https://o42.ingest.sentry.io/4505',
        'https://short@o42.ingest.sentry.io/4505',
        'https://0123456789abcdef0123456789abcdef:secret@o42.ingest.sentry.io/4505',
        'https://0123456789abcdef0123456789abcdef@o42.ingest.sentry.io/project',
        'https://0123456789abcdef0123456789abcdef@o42.ingest.sentry.io/4505?x=1',
    ]) {
        assert.equal(parseSentryDsn(invalid), null, String(invalid));
    }
});

test('reporter is absent without a valid DSN or fetch', () => {
    const { fetchImpl } = makeFetchSpy();
    assert.equal(createSentryErrorReporter({ dsn: undefined, fetchImpl }), null);
    assert.equal(createSentryErrorReporter({ dsn: 'https://bad', fetchImpl }), null);
    assert.equal(createSentryErrorReporter({ dsn: DSN, fetchImpl: null }), null);
});

test('envelope carries only the sanitized report fields — no session id, message or query', () => {
    const { calls, fetchImpl } = makeFetchSpy();
    const reporter = createSentryErrorReporter({
        dsn: DSN,
        fetchImpl,
        now: () => 1_700_000_000_000,
        createEventId: () => 'f'.repeat(32),
    });
    reporter.capture(makeReport());

    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, parseSentryDsn(DSN).envelopeUrl);
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.keepalive, true);
    assert.doesNotMatch(init.body, /session|nickname|token|secret|tossmini/);

    const [header, itemHeader, event] = parseEnvelope(init.body);
    assert.deepEqual(header, { event_id: 'f'.repeat(32), sent_at: '2023-11-14T22:13:20.000Z' });
    assert.deepEqual(itemHeader, { type: 'event' });
    assert.deepEqual(event, {
        event_id: 'f'.repeat(32),
        timestamp: 1_700_000_000,
        platform: 'javascript',
        level: 'fatal',
        release: 'release-42',
        environment: 'sandbox',
        tags: { source: 'boundary', runtime: 'sandbox', os: 'ios' },
        exception: {
            values: [{
                type: 'react_render_failure',
                value: 'boundary',
                mechanism: { type: 'boundary', handled: true },
                stacktrace: {
                    // Sentry 규약: 오래된 호출이 먼저다.
                    frames: [
                        { filename: 'app:///assets/vendor.js', abs_path: 'app:///assets/vendor.js', function: 'anonymous', lineno: 7, colno: 8, in_app: true },
                        { filename: 'app:///assets/app.js', abs_path: 'app:///assets/app.js', function: 'anonymous', lineno: 12, colno: 34, in_app: true },
                    ],
                },
            }],
        },
    });
});

test('reports without frames omit the stacktrace and window errors are not fatal', () => {
    const report = createSanitizedErrorReport({ code: 'window_error', source: 'window_error' }, context);
    const [, , event] = parseEnvelope(buildSentryEnvelope(report, 'a'.repeat(32), 0));
    assert.equal(event.level, 'error');
    assert.deepEqual(event.exception.values[0], {
        type: 'window_error',
        value: 'window_error',
        mechanism: { type: 'window_error', handled: false },
    });
});

test('reporter skips release-less reports, repeats and anything past the session cap', () => {
    const { calls, fetchImpl } = makeFetchSpy();
    const reporter = createSentryErrorReporter({ dsn: DSN, fetchImpl });

    reporter.capture({ ...makeReport(), releaseId: '' });
    assert.equal(calls.length, 0);

    reporter.capture(makeReport());
    reporter.capture(makeReport());
    assert.equal(calls.length, 1);

    for (let line = 100; line < 100 + SENTRY_MAX_REPORTS_PER_SESSION * 2; line += 1) {
        reporter.capture(makeReport('react_render_failure', line));
    }
    assert.equal(calls.length, SENTRY_MAX_REPORTS_PER_SESSION);
});

test('transport failures never reach the game', async () => {
    const throwing = createSentryErrorReporter({
        dsn: DSN,
        fetchImpl: () => { throw new Error('offline'); },
    });
    assert.doesNotThrow(() => throwing.capture(makeReport()));

    const rejecting = createSentryErrorReporter({
        dsn: DSN,
        fetchImpl: () => Promise.reject(new Error('blocked')),
    });
    assert.doesNotThrow(() => rejecting.capture(makeReport()));
    await new Promise((resolve) => setImmediate(resolve));
});

test('composed reporters each receive the report even when one throws', () => {
    const received = [];
    const reporter = composeErrorReporters(
        { capture: () => { throw new Error('storage blocked'); } },
        null,
        { capture: (report) => received.push(report.code) },
    );
    assert.doesNotThrow(() => reporter.capture(makeReport()));
    assert.deepEqual(received, ['react_render_failure']);
});
