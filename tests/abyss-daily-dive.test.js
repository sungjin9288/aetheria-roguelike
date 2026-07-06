import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAbyssDailyDive } from '../src/utils/abyssDailyDive.js';
import { BALANCE } from '../src/data/constants.js';

test('resolveAbyssDailyDive activates the bonus on first dive of the day (no prior record)', () => {
    const player = { stats: { abyssDailyDive: null } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');

    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', used: true });
});

test('resolveAbyssDailyDive activates the bonus when stored date is a previous day', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-05', used: true } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');

    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', used: true });
});

test('resolveAbyssDailyDive does not re-activate the bonus once already used today', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-06', used: true } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');

    assert.equal(result.multiplierActive, false);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', used: true });
});

test('resolveAbyssDailyDive treats same-day-but-unused record as still eligible (defensive)', () => {
    // Should not normally occur (we always set used:true when activating), but
    // if a corrupt/partial save has used:false for today, the bonus should still fire.
    const player = { stats: { abyssDailyDive: { date: '2026-07-06', used: false } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');

    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', used: true });
});

test('resolveAbyssDailyDive handles missing player.stats entirely (defensive)', () => {
    const player = {};
    const result = resolveAbyssDailyDive(player, '2026-07-06');

    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', used: true });
});

test('BALANCE.ABYSS_DAILY_DIVE_MULT is defined and equals 1.5', () => {
    assert.equal(BALANCE.ABYSS_DAILY_DIVE_MULT, 1.5);
});
