import assert from 'node:assert/strict';
import test from 'node:test';

import { FatalErrorBoundary } from '../src/components/app/FatalErrorBoundary.tsx';
import {
    bindGlobalErrorReporter,
    createSanitizedErrorReport,
    readKnownRuntimeScriptFilenames,
} from '../src/platform/errorReporter.ts';
import { createProductEventContext } from '../src/platform/productEventContext.ts';

const context = createProductEventContext({
    releaseId: 'release-42',
    runtime: 'sandbox',
    os: 'ios',
    sessionId: 'session:00000000-0000-4000-8000-000000000042',
    startedAt: 1_000,
});

test('error reporter exposes controlled codes and strips every raw error surface', () => {
    const cause = new Error('nickname=private token=secret');
    cause.stack = 'Error: nickname=private token=secret\n    at renderGame (https://aetheria.tossmini.com/assets/app.js?token=secret:12:34)';
    const report = createSanitizedErrorReport({
        code: 'react_render_failure',
        source: 'boundary',
        cause,
        knownScriptFilenames: ['assets/app.js'],
    }, context);
    assert.deepEqual(report, {
        code: 'react_render_failure',
        source: 'boundary',
        releaseId: 'release-42',
        runtime: 'sandbox',
        os: 'ios',
        sessionId: 'session:00000000-0000-4000-8000-000000000042',
        frames: [{ functionName: 'anonymous', filename: 'assets/app.js', line: 12, column: 34 }],
    });
    assert.equal(JSON.stringify(report).includes('message'), false);
    assert.equal(JSON.stringify(report).includes('token=secret'), false);
    assert.equal(JSON.stringify(report).includes('user'), false);
    assert.throws(
        () => createSanitizedErrorReport({ code: 'token=secret', source: 'boundary' }, context),
        /error code/i,
    );
});

test('known app scripts are the entry script and the chunks it preloads — game screen frames stay in the report', () => {
    // 게임 화면(GameRoot)은 따로 받는 청크다(CH-03). Vite는 그 청크와 의존을 modulepreload 링크로 미리 받는다.
    const source = {
        scripts: [{ src: 'https://aetheria.tossmini.com/assets/index-a1.js' }, { src: '' }],
        querySelectorAll: (selector) => (selector === 'link[rel="modulepreload"]'
            ? [
                { href: 'https://aetheria.tossmini.com/assets/vendor-react-b2.js' },
                { href: 'https://aetheria.tossmini.com/assets/GameRoot-c3.js' },
            ]
            : []),
    };
    const known = readKnownRuntimeScriptFilenames(source);
    assert.deepEqual(known, ['assets/index-a1.js', 'assets/vendor-react-b2.js', 'assets/GameRoot-c3.js']);
    assert.deepEqual(
        readKnownRuntimeScriptFilenames({ scripts: [{ src: 'https://aetheria.tossmini.com/assets/app.js' }] }),
        ['assets/app.js'],
    );

    const cause = new Error('render failed');
    cause.stack = [
        'Error: render failed',
        '    at Panel (https://aetheria.tossmini.com/assets/GameRoot-c3.js:3:7)',
        '    at inject (chrome-extension://private-extension/inject.js:1:1)',
        '    at render (https://aetheria.tossmini.com/assets/vendor-react-b2.js:9:2)',
    ].join('\n');
    const report = createSanitizedErrorReport({
        code: 'react_render_failure',
        source: 'boundary',
        cause,
        knownScriptFilenames: known,
    }, context);
    assert.deepEqual(report.frames, [
        { functionName: 'anonymous', filename: 'assets/GameRoot-c3.js', line: 3, column: 7 },
        { functionName: 'anonymous', filename: 'assets/vendor-react-b2.js', line: 9, column: 2 },
    ]);
    assert.equal(JSON.stringify(report).includes('private-extension'), false);
});

test('multiline error messages cannot inject nickname or private path as a stack frame', () => {
    const cause = new Error(
        'ordinary failure\n    at PRIVATE_NICKNAME (https://aetheria.tossmini.com/private/PRIVATE_NICKNAME.js?token=SECRET:7:9)',
    );
    const report = createSanitizedErrorReport({
        code: 'window_error',
        source: 'window_error',
        cause,
        knownScriptFilenames: ['assets/app.js'],
    }, context);
    assert.deepEqual(report.frames, []);
    assert.equal(JSON.stringify(report).includes('PRIVATE_NICKNAME'), false);
    assert.equal(JSON.stringify(report).includes('SECRET'), false);
});

test('global error bindings ignore raw Error and Promise rejection values', () => {
    const listeners = new Map();
    const target = {
        addEventListener: (name, listener) => listeners.set(name, listener),
        removeEventListener: (name, listener) => {
            if (listeners.get(name) === listener) listeners.delete(name);
        },
    };
    const reports = [];
    const unbind = bindGlobalErrorReporter({
        target,
        context,
        knownScriptFilenames: ['assets/main.js'],
        reporter: { capture: (report) => reports.push(report) },
    });

    const windowError = new Error('nickname=private token=secret');
    windowError.stack = 'Error: nickname=private token=secret\n    at boot (https://aetheria.tossmini.com/assets/main.js?uid=private:4:9)';
    listeners.get('error')({ error: windowError });
    listeners.get('unhandledrejection')({ reason: { request: { body: 'private' } } });
    assert.deepEqual(reports.map((report) => report.code), [
        'window_error',
        'unhandled_rejection',
    ]);
    assert.deepEqual(reports[0].frames, [{ functionName: 'anonymous', filename: 'assets/main.js', line: 4, column: 9 }]);
    assert.equal(JSON.stringify(reports).includes('private'), false);
    assert.equal(JSON.stringify(reports).includes('secret'), false);
    unbind();
    assert.equal(listeners.size, 0);
});

test('fatal boundary reports and advances the product fatal receipt exactly once', () => {
    const reports = [];
    const fatalEvents = [];
    const boundary = new FatalErrorBoundary({
        children: 'game',
        context,
        knownScriptFilenames: ['assets/game.js'],
        reporter: { capture: (report) => reports.push(report) },
        onFatal: (event) => fatalEvents.push(event),
    });

    const boundaryError = new Error('raw nickname and token');
    boundaryError.stack = 'Error: raw nickname and token\n    at GameRoot (https://aetheria.tossmini.com/assets/game.js:8:13)';
    boundary.componentDidCatch(boundaryError, { componentStack: 'private stack' });
    boundary.componentDidCatch(new Error('second raw error'), { componentStack: 'second stack' });

    assert.equal(reports.length, 1);
    assert.equal(reports[0].code, 'react_render_failure');
    assert.deepEqual(reports[0].frames, [{ functionName: 'anonymous', filename: 'assets/game.js', line: 8, column: 13 }]);
    assert.deepEqual(fatalEvents, [{
        name: 'fatal_error_boundary',
        fields: { job: 'unknown', level: 1, outcome: 'caught' },
    }]);
    assert.equal(JSON.stringify({ reports, fatalEvents }).includes('nickname'), false);
    assert.deepEqual(FatalErrorBoundary.getDerivedStateFromError(), { failed: true });
});
