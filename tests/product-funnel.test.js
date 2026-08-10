import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateProductFunnel } from '../scripts/productFunnel.mjs';

const HOUR = 60 * 60 * 1_000;
let sequence = 0;
const event = (cohortId, name, receivedAt, outcome = 'success', sessionId = `${cohortId}-session-0`) => ({
    cohortId,
    name,
    receivedAt,
    serverSequence: ++sequence,
    sessionId,
    releaseId: 'release-1',
    outcome,
});

test('server funnel counts only ordered first-session progression and bounded retention windows', () => {
    const events = [
        event('cohort-a', 'boot', 0, 'ready'),
        event('cohort-a', 'character_created', 1_000),
        event('cohort-a', 'move', 2_000),
        event('cohort-a', 'combat_start', 3_000, 'normal'),
        event('cohort-a', 'safe_expedition_return', 4_000),
        event('cohort-a', 'boot', 25 * HOUR, 'ready', 'cohort-a-session-1'),
        event('cohort-a', 'boot', 169 * HOUR, 'ready', 'cohort-a-session-2'),
        event('cohort-b', 'boot', 0, 'offline'),
        event('cohort-b', 'combat_start', 1_000, 'normal'),
        event('cohort-b', 'move', 2_000),
    ];

    assert.deepEqual(aggregateProductFunnel(events, { releaseId: 'release-1' }), {
        ok: true,
        releaseId: 'release-1',
        sampleSize: 2,
        directionalRetention: true,
        counts: {
            boot: 2,
            characterCreated: 1,
            firstMove: 1,
            firstCombat: 1,
            safeReturn: 1,
            d1: 1,
            d7: 1,
        },
        rates: {
            characterCreated: 0.5,
            firstMove: 0.5,
            firstCombat: 0.5,
            safeReturn: 0.5,
            d1: 0.5,
            d7: 0.5,
        },
    });
});

test('retention windows exclude early, late and same-session launches', () => {
    const events = [
        event('a', 'boot', 0, 'ready'),
        event('a', 'boot', 25 * HOUR, 'ready'),
        event('a', 'boot', 23 * HOUR, 'ready', 'a-session-1'),
        event('a', 'boot', 48 * HOUR, 'ready', 'a-session-2'),
        event('a', 'boot', 167 * HOUR, 'ready', 'a-session-3'),
        event('a', 'boot', 192 * HOUR, 'ready', 'a-session-4'),
    ];
    const result = aggregateProductFunnel(events, { releaseId: 'release-1' });
    assert.equal(result.counts.d1, 0);
    assert.equal(result.counts.d7, 0);
});

test('blocked outcomes and same-timestamp earlier events cannot advance the ordered funnel', () => {
    const sameTime = 2_000;
    const events = [
        event('blocked', 'boot', 0, 'ready'),
        event('blocked', 'character_created', 1_000),
        event('blocked', 'safe_expedition_return', sameTime),
        event('blocked', 'move', sameTime, 'blocked'),
        event('blocked', 'combat_start', sameTime, 'normal'),
    ];
    const result = aggregateProductFunnel(events, { releaseId: 'release-1' });
    assert.deepEqual(result.counts, {
        boot: 1,
        characterCreated: 1,
        firstMove: 0,
        firstCombat: 0,
        safeReturn: 0,
        d1: 0,
        d7: 0,
    });
});

test('funnel requires server order authority for equal-time event tie breaking', () => {
    const invalid = event('a', 'boot', 0, 'ready');
    delete invalid.serverSequence;
    assert.deepEqual(aggregateProductFunnel([invalid], { releaseId: 'release-1' }), {
        ok: false,
        reason: 'event_order_authority_missing',
    });
});

test('funnel rejects duplicate server order tuples within one cohort', () => {
    const boot = event('a', 'boot', 0, 'ready');
    const moved = event('a', 'move', 2_000);
    const combat = event('a', 'combat_start', 2_000, 'normal');
    combat.serverSequence = moved.serverSequence;

    assert.deepEqual(aggregateProductFunnel([boot, moved, combat], { releaseId: 'release-1' }), {
        ok: false,
        reason: 'event_order_authority_missing',
    });
});

test('funnel refuses retention and conversion claims without server identity authority', () => {
    assert.deepEqual(aggregateProductFunnel([
        { name: 'boot', receivedAt: 0, serverSequence: 1, sessionId: 'session-1', releaseId: 'release-1', outcome: 'ready' },
    ], { releaseId: 'release-1' }), {
        ok: false,
        reason: 'identity_authority_missing',
    });
});
