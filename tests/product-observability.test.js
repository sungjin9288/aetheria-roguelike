import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
    PRODUCT_EVENT_NAMES,
    PRODUCT_EVENT_OUTCOMES,
    buildProductEvent,
    getElapsedBucket,
    getLevelBand,
} from '../src/platform/productEvents.ts';
import {
    createMemorySessionId,
    createProductEventContext,
    readProductReleaseId,
    resolveProductEventOs,
} from '../src/platform/productEventContext.ts';
import { createProductEventClient } from '../src/platform/productEventSink.ts';

const context = createProductEventContext({
    releaseId: 'toss-local-test',
    runtime: 'sandbox',
    os: 'android',
    sessionId: 'session-test-01',
    startedAt: 1_000,
});

test('product observability exposes only the approved soft-launch event vocabulary', () => {
    assert.deepEqual(PRODUCT_EVENT_NAMES, [
        'boot',
        'character_created',
        'first_action',
        'mission_open',
        'move',
        'explore',
        'combat_start',
        'combat_end',
        'safe_expedition_return',
        'save',
        'restore',
        'feedback_submission',
        'fatal_error_boundary',
        'ad_offer',
        'ad_load',
        'ad_show',
        'ad_reward',
        'ad_failure',
    ]);
    assert.deepEqual(PRODUCT_EVENT_OUTCOMES.boot, ['ready', 'offline', 'failed']);
});

test('product events contain only release, runtime, coarse progression and outcome fields', () => {
    assert.deepEqual(buildProductEvent('combat_end', {
        job: '전사',
        level: 12,
        outcome: 'victory',
    }, context, 32_000), {
        name: 'combat_end',
        releaseId: 'toss-local-test',
        runtime: 'sandbox',
        os: 'android',
        sessionId: 'session-test-01',
        job: '전사',
        levelBand: '10-19',
        elapsedBucket: '31-60s',
        outcome: 'victory',
    });
});

test('every canonical event/outcome pair validates without opening arbitrary payload fields', () => {
    for (const [name, outcomes] of Object.entries(PRODUCT_EVENT_OUTCOMES)) {
        for (const outcome of outcomes) {
            const event = buildProductEvent(name, { job: '모험가', level: 1, outcome }, context, 2_000);
            assert.equal(event.name, name);
            assert.equal(event.outcome, outcome);
            assert.equal(Object.keys(event).length, 9);
        }
    }
});

test('product events reject PII, free text and high-cardinality game state before transport', () => {
    for (const field of ['nickname', 'userKey', 'uid', 'message', 'inventory', 'combatLog', 'logs', 'loc', 'nested']) {
        assert.throws(
            () => buildProductEvent('feedback_submission', {
                job: '전사',
                level: 12,
                outcome: 'success',
                [field]: field === 'inventory' || field === 'combatLog' ? [] : 'secret',
            }, context, 2_000),
            /unsupported product event field/i,
        );
    }
});

test('runtime source excludes implicit platform analytics and PII-rich error integrations', async () => {
    const sourceRoot = new URL('../src/', import.meta.url);
    const readTree = async (directory) => {
        const entries = await readdir(directory, { withFileTypes: true });
        const sources = [];
        for (const entry of entries) {
            const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
            if (entry.isDirectory()) sources.push(...await readTree(target));
            else if (/\.(?:ts|tsx)$/.test(entry.name)) sources.push(await readFile(target, 'utf8'));
        }
        return sources;
    };
    const source = (await readTree(sourceRoot)).join('\n');
    const packageSource = await readFile(path.resolve('package.json'), 'utf8');
    assert.doesNotMatch(source, /firebase\/analytics|Analytics\.log\s*\(|\.setUser\s*\(|ReplayIntegration/);
    assert.doesNotMatch(packageSource, /@sentry\/replay/);
});

test('product events reject unknown names, invalid outcomes and identifying context values', () => {
    assert.throws(() => buildProductEvent('purchase', {
        job: '전사', level: 12, outcome: 'success',
    }, context, 2_000), /unsupported product event/i);
    assert.throws(
        () => buildProductEvent('combat_end', {
            job: '전사', level: 12, outcome: 'player wrote this',
        }, context, 2_000),
        /unsupported outcome/i,
    );
    assert.throws(
        () => createProductEventContext({ ...context, releaseId: 'release id with spaces' }),
        /release id/i,
    );
    assert.throws(
        () => createProductEventContext({ ...context, sessionId: 'raw/user/key' }),
        /session id/i,
    );
});

test('coarse buckets are deterministic at every launch and progression boundary', () => {
    assert.equal(getLevelBand(1), '1-4');
    assert.equal(getLevelBand(5), '5-9');
    assert.equal(getLevelBand(10), '10-19');
    assert.equal(getLevelBand(20), '20-44');
    assert.equal(getLevelBand(45), '45-59');
    assert.equal(getLevelBand(60), '60-74');
    assert.equal(getLevelBand(75), '75+');
    assert.equal(getElapsedBucket(10_000), '0-10s');
    assert.equal(getElapsedBucket(10_001), '11-30s');
    assert.equal(getElapsedBucket(30_001), '31-60s');
    assert.equal(getElapsedBucket(60_001), '1-3m');
    assert.equal(getElapsedBucket(300_001), '5-10m');
    assert.equal(getElapsedBucket(1_800_001), '30m+');
});

test('runtime context uses deploymentId for Toss and never persists a raw identity', () => {
    assert.equal(readProductReleaseId({
        runtime: 'sandbox',
        readTossDeploymentId: () => 'deployment-123',
    }), 'deployment-123');
    assert.equal(readProductReleaseId({
        runtime: 'toss',
        readTossDeploymentId: () => { throw new Error('SDK unavailable'); },
    }), null);
    assert.equal(readProductReleaseId({ runtime: 'web', buildReleaseId: 'local' }), null);
    assert.equal(resolveProductEventOs({ nativePlatform: 'web', userAgent: 'Mozilla Android' }), 'android');
    assert.equal(createMemorySessionId(() => '00000000-0000-4000-8000-000000000001'),
        'session:00000000-0000-4000-8000-000000000001');
});

test('transport failure is fail-open for gameplay and never receives a second enriched payload', async () => {
    const received = [];
    const errors = [];
    const client = createProductEventClient({
        context,
        sink: {
            send: async (event) => {
                received.push(event);
                throw new Error('collector unavailable');
            },
        },
        onError: (reason) => errors.push(reason),
        now: () => 2_000,
    });

    assert.equal(client.track('boot', { job: 'unknown', level: 1, outcome: 'ready' }), undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(received.length, 1);
    assert.deepEqual(Object.keys(received[0]), [
        'name',
        'releaseId',
        'runtime',
        'os',
        'sessionId',
        'job',
        'levelBand',
        'elapsedBucket',
        'outcome',
    ]);
    assert.deepEqual(errors, ['transport_failure']);
});

test('a synchronously throwing transport is also isolated from gameplay', async () => {
    const errors = [];
    const client = createProductEventClient({
        context,
        sink: { send: () => { throw new Error('sync transport failure'); } },
        onError: (reason) => errors.push(reason),
        now: () => 2_000,
    });
    assert.doesNotThrow(() => client.track('boot', {
        job: 'unknown', level: 1, outcome: 'ready',
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(errors, ['transport_failure']);
});

test('clock rollback and event validation failure are isolated from gameplay', async () => {
    const errors = [];
    const client = createProductEventClient({
        context,
        sink: { send: async () => undefined },
        onError: (reason) => errors.push(reason),
        now: () => 999,
    });
    assert.doesNotThrow(() => client.track('boot', {
        job: 'unknown', level: 1, outcome: 'ready',
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(errors, ['event_validation_failure']);
});
