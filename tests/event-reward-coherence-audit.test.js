import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { RELICS } from '../src/data/relics.js';
import { STRUCTURED_FALLBACK_TRANSACTIONS } from '../src/data/structuredFallbackEvents.js';
import { EXPLORATION_RHYTHM_PROFILE } from '../src/data/progressionProfiles.js';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { buildScoutEvent } from '../src/utils/scoutEvents.js';
import { buildEventRewardCoherenceReport } from '../src/systems/eventRewardCoherenceAudit.js';

const clone = (value) => structuredClone(value);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_PATH = 'docs/evidence/qa/release-complete-core/event-reward-coherence.json';

const buildReport = (overrides = {}) => buildEventRewardCoherenceReport({
    chains: EVENT_CHAINS,
    boundedEncounters: BOUNDED_ENCOUNTERS,
    fallbackTransactions: STRUCTURED_FALLBACK_TRANSACTIONS,
    campfireEvent: buildCampfireEvent({ maxHp: 200, maxMp: 100 }),
    scoutEvent: buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99),
    maps: DB.MAPS,
    items: DB.ITEMS,
    relics: RELICS,
    frequency: {
        scoutChance: BALANCE.SCOUT_CHANCE,
        campfireChance: BALANCE.CAMPFIRE_CHANCE,
        eventMultiplier: EXPLORATION_RHYTHM_PROFILE.eventMultiplier,
        minimumNarrativeGap: 1,
    },
    ...overrides,
});

test('event reward audit covers every canonical occurrence class without defects', () => {
    const report = buildReport();
    assert.deepEqual(report.catalog, {
        chainCount: 13,
        chainStepCount: 39,
        chainOutcomeCount: 84,
        boundedEncounterCount: 4,
        boundedChoiceCount: 8,
        fallbackTransactionCount: 3,
        campfireChoiceCount: 2,
        scoutChoiceCount: 3,
    });
    assert.deepEqual(report.frequency, {
        scoutChance: 0.15,
        campfireChance: 0.08,
        eventMultiplier: 0.8,
        minimumNarrativeGap: 1,
    });
    assert.equal(report.rows.length, 100);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report, buildReport());
});

test('event reward audit rejects unknown rewards, non-finite values, and under-tier chain gear', () => {
    const chains = clone(EVENT_CHAINS);
    chains[0].steps[0].event.outcomes[0].reward = { type: 'unknown_reward', amount: 1 };
    chains[1].steps[0].event.outcomes[0].reward = { type: 'gold', amount: Number.NaN };
    const finale = chains.find((chain) => chain.id === 'forgotten_commander').steps[2];
    finale.event.outcomes[1].reward = { type: 'item', name: '기사의 흉갑' };
    const shadowMarket = chains.find((chain) => chain.id === 'shadow_guild').steps[1];
    shadowMarket.event.outcomes[0].reward.relicId = 'missing_relic';

    const report = buildReport({ chains });
    assert.ok(report.errors.some((error) => error.startsWith('CHAIN_REWARD_TYPE_INVALID:')));
    assert.ok(report.errors.some((error) => error.startsWith('CHAIN_REWARD_NUMBER_INVALID:')));
    assert.ok(report.errors.includes('CHAIN_ITEM_TIER_TOO_LOW:forgotten_commander:2:1:기사의 흉갑:T2:MIN_T3'));
    assert.ok(report.errors.includes('CHAIN_RELIC_UNKNOWN:shadow_guild:1:0:missing_relic'));
});

test('event reward audit rejects malformed repeatable rewards and frequency authority', () => {
    const boundedEncounters = clone(BOUNDED_ENCOUNTERS);
    boundedEncounters[0].choices[0].outcome.item = '없는 재료';
    boundedEncounters[1].choices[0].cost.hp = Number.POSITIVE_INFINITY;
    const fallbackTransactions = clone(STRUCTURED_FALLBACK_TRANSACTIONS);
    fallbackTransactions[1].netGold = 999;

    const report = buildReport({
        boundedEncounters,
        fallbackTransactions,
        frequency: {
            scoutChance: Number.NaN,
            campfireChance: 0.08,
            eventMultiplier: 0.8,
            minimumNarrativeGap: 0,
        },
    });
    assert.ok(report.errors.includes('BOUNDED_ITEM_UNKNOWN:forest-old-pillars:read-runes:없는 재료'));
    assert.ok(report.errors.includes('BOUNDED_NUMBER_INVALID:forest-mutated-trail:clear-thorns:cost.hp'));
    assert.ok(report.errors.includes('FALLBACK_NET_MISMATCH:fallback:suspicious-merchant-wager:v1'));
    assert.ok(report.errors.includes('FREQUENCY_INVALID:scoutChance'));
    assert.ok(report.errors.includes('FREQUENCY_INVALID:minimumNarrativeGap'));
});

test('event reward verifier binds the canonical report bytes and rejects invalid CLI grammar', () => {
    const verified = spawnSync(process.execPath, [
        '--import',
        'tsx',
        'scripts/verify-event-reward-coherence.mjs',
        '--verify',
        EVIDENCE_PATH,
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /event-reward verify ok:.*errors=0/);

    for (const args of [
        ['--verify'],
        ['--unknown', EVIDENCE_PATH],
        ['--write', EVIDENCE_PATH, '--verify', EVIDENCE_PATH],
        ['--verify', '../event-reward.json'],
    ]) {
        const rejected = spawnSync(process.execPath, [
            '--import',
            'tsx',
            'scripts/verify-event-reward-coherence.mjs',
            ...args,
        ], { cwd: ROOT, encoding: 'utf8' });
        assert.notEqual(rejected.status, 0, `${args.join(' ')} must fail`);
    }
});
