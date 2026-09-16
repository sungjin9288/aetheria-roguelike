import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.ts';
import { createSanitizedErrorReport } from '../src/platform/errorReporter.ts';
import { createProductEventContext } from '../src/platform/productEventContext.ts';
import {
    clearErrorReports,
    createLocalErrorReporter,
    LOCAL_ERROR_REPORT_STORAGE_KEY,
    readErrorReports,
} from '../src/platform/localErrorReportStore.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const context = createProductEventContext({
    releaseId: 'release-42',
    runtime: 'sandbox',
    os: 'ios',
    sessionId: 'session:00000000-0000-4000-8000-000000000042',
    startedAt: 1_000,
});

const makeReport = (code) => createSanitizedErrorReport({ code, source: 'window_error' }, context);

class MemoryStorage {
    constructor() {
        this.map = new Map();
    }

    getItem(key) {
        return this.map.has(key) ? this.map.get(key) : null;
    }

    setItem(key, value) {
        this.map.set(key, value);
    }

    removeItem(key) {
        this.map.delete(key);
    }
}

class ThrowingStorage {
    getItem() {
        throw new Error('storage unavailable');
    }

    setItem() {
        throw new Error('storage unavailable');
    }

    removeItem() {
        throw new Error('storage unavailable');
    }
}

test('ring buffer overflow drops the oldest report first', () => {
    const storage = new MemoryStorage();
    const reporter = createLocalErrorReporter(storage);

    const totalCaptures = BALANCE.ERROR_REPORT_RING_SIZE + 5;
    for (let i = 0; i < totalCaptures; i += 1) {
        reporter.capture(makeReport(`code_${i}`));
    }

    const stored = readErrorReports(storage);
    assert.equal(stored.length, BALANCE.ERROR_REPORT_RING_SIZE);
    assert.equal(stored[0].report.code, `code_${totalCaptures - BALANCE.ERROR_REPORT_RING_SIZE}`);
    assert.equal(stored[stored.length - 1].report.code, `code_${totalCaptures - 1}`);
});

test('capture() never throws even when storage access throws', () => {
    const reporter = createLocalErrorReporter(new ThrowingStorage());
    assert.doesNotThrow(() => reporter.capture(makeReport('window_error')));
});

test('readErrorReports returns [] when storage throws on read', () => {
    assert.deepEqual(readErrorReports(new ThrowingStorage()), []);
});

test('readErrorReports returns [] on corrupt JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_ERROR_REPORT_STORAGE_KEY, '{not valid json');
    assert.deepEqual(readErrorReports(storage), []);
});

test('readErrorReports returns [] when the stored value is not an array of well-formed entries', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_ERROR_REPORT_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    assert.deepEqual(readErrorReports(storage), []);

    const storageWithBadEntries = new MemoryStorage();
    storageWithBadEntries.setItem(
        LOCAL_ERROR_REPORT_STORAGE_KEY,
        JSON.stringify([{ capturedAt: 'not-a-number', report: { code: 'x' } }]),
    );
    assert.deepEqual(readErrorReports(storageWithBadEntries), []);
});

test('clearErrorReports removes all stored reports and never throws when storage throws', () => {
    const storage = new MemoryStorage();
    const reporter = createLocalErrorReporter(storage);
    reporter.capture(makeReport('window_error'));
    assert.equal(readErrorReports(storage).length, 1);

    clearErrorReports(storage);
    assert.deepEqual(readErrorReports(storage), []);

    assert.doesNotThrow(() => clearErrorReports(new ThrowingStorage()));
});

test('capture() round-trips the sanitized report shape unchanged', () => {
    const storage = new MemoryStorage();
    const reporter = createLocalErrorReporter(storage, () => 12_345);
    const report = makeReport('window_error');
    reporter.capture(report);

    const [stored] = readErrorReports(storage);
    assert.deepEqual(stored.report, report);
    assert.equal(stored.capturedAt, 12_345);
});

test('main.tsx installs the local error reporter before binding the global handlers', () => {
    const mainSource = readFileSync(path.join(__dirname, '../src/main.tsx'), 'utf8');
    const installIndex = mainSource.indexOf('installRuntimeErrorReporter(');
    const bindIndex = mainSource.indexOf('bindGlobalErrorReporter(');

    assert.ok(installIndex >= 0, 'main.tsx must call installRuntimeErrorReporter()');
    assert.ok(bindIndex >= 0, 'main.tsx must call bindGlobalErrorReporter()');
    assert.ok(
        installIndex < bindIndex,
        'installRuntimeErrorReporter() must run before bindGlobalErrorReporter() so no crash report is lost',
    );
});
