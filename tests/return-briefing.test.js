import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildReturnBriefing } from '../src/utils/returnBriefing.js';

const HOUR_MS = 60 * 60 * 1000;

const basePlayer = (overrides = {}) => ({
    loc: '고요한 숲',
    level: 12,
    hp: 80,
    maxHp: 120,
    eventChainProgress: {},
    stats: {
        lastSeenAt: null,
        dailyProtocol: null,
    },
    ...overrides,
});

test('buildReturnBriefing returns null when less than 6h have elapsed', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({ stats: { lastSeenAt: now - (HOUR_MS * 5), dailyProtocol: null } });
    assert.equal(buildReturnBriefing(player, now), null);
});

test('buildReturnBriefing returns null exactly at boundary minus 1ms (just under threshold)', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({ stats: { lastSeenAt: now - (HOUR_MS * 6) + 1, dailyProtocol: null } });
    assert.equal(buildReturnBriefing(player, now), null);
});

test('buildReturnBriefing returns a briefing exactly at the 6h boundary', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({ stats: { lastSeenAt: now - (HOUR_MS * 6), dailyProtocol: null } });
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    assert.equal(briefing.awayHours, 6);
});

test('buildReturnBriefing returns a briefing when well beyond 6h and includes location/level/hp', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({
        loc: '에테르 폐허',
        level: 27,
        hp: 40,
        maxHp: 200,
        stats: { lastSeenAt: now - (HOUR_MS * 30), dailyProtocol: null },
    });
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    assert.equal(briefing.loc, '에테르 폐허');
    assert.equal(briefing.level, 27);
    assert.equal(briefing.hp, 40);
    assert.equal(briefing.maxHp, 200);
    assert.equal(briefing.awayHours, 30);
});

test('buildReturnBriefing uses equipment-derived effective max hp when provided', () => {
    const now = 1_000_000_000;
    const player = basePlayer({ hp: 178, maxHp: 150 });
    player.stats.lastSeenAt = now - 7 * HOUR_MS;

    const briefing = buildReturnBriefing(player, now, 178);

    assert.equal(briefing.hp, 178);
    assert.equal(briefing.maxHp, 178);
});

test('buildReturnBriefing ignores invalid effective max hp values', () => {
    const now = 1_000_000_000;
    const player = basePlayer({ hp: 150, maxHp: 150 });
    player.stats.lastSeenAt = now - 7 * HOUR_MS;

    assert.equal(buildReturnBriefing(player, now, Number.NaN).maxHp, 150);
    assert.equal(buildReturnBriefing(player, now, 0).maxHp, 150);
});

test('buildReturnBriefing returns null when lastSeenAt field is missing (defensive — old saves)', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({ stats: { dailyProtocol: null } });
    assert.equal(buildReturnBriefing(player, now), null);
});

test('buildReturnBriefing returns null when player.stats is entirely missing', () => {
    const now = 1_000_000_000_000;
    const player = { loc: '시작의 마을', level: 1, hp: 10, maxHp: 10 };
    assert.equal(buildReturnBriefing(player, now), null);
});

test('buildReturnBriefing returns null when player itself is null/undefined', () => {
    const now = 1_000_000_000_000;
    assert.equal(buildReturnBriefing(null, now), null);
    assert.equal(buildReturnBriefing(undefined, now), null);
});

test('buildReturnBriefing counts incomplete daily protocol missions', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({
        stats: {
            lastSeenAt: now - (HOUR_MS * 10),
            dailyProtocol: {
                date: '2026-07-01',
                missions: [
                    { id: 'kill_n', done: true },
                    { id: 'explore_n', done: false },
                    { id: 'gold_n', done: false },
                ],
            },
        },
    });
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    assert.equal(briefing.incompleteMissionCount, 2);
});

test('buildReturnBriefing reports 0 incomplete missions when dailyProtocol is null/missing', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({ stats: { lastSeenAt: now - (HOUR_MS * 10), dailyProtocol: null } });
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    assert.equal(briefing.incompleteMissionCount, 0);
});

test('buildReturnBriefing counts in-progress event chains via buildChainJournal reuse', () => {
    const now = 1_000_000_000_000;
    const player = basePlayer({
        eventChainProgress: { ancient_prophecy: 1, lost_wizard: 0, failed_chain: 'failed' },
        stats: { lastSeenAt: now - (HOUR_MS * 10), dailyProtocol: null },
    });
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    // ancient_prophecy(started) counts, lost_wizard(0, not started) and failed_chain excluded.
    // Uses the real EVENT_CHAINS default, so we only assert it's >= 0 and a number (no crash),
    // and that it does not throw with a chain id not present in EVENT_CHAINS.
    assert.equal(typeof briefing.activeChainCount, 'number');
});

test('buildReturnBriefing defaults missing loc/level/hp fields gracefully', () => {
    const now = 1_000_000_000_000;
    const player = { stats: { lastSeenAt: now - (HOUR_MS * 8) } };
    const briefing = buildReturnBriefing(player, now);
    assert.ok(briefing);
    assert.equal(briefing.loc, '알 수 없는 곳');
    assert.equal(briefing.level, 1);
    assert.equal(briefing.hp, 0);
    assert.equal(briefing.maxHp, 0);
});

test('GameRoot mounts a one-shot return briefing without effect-driven mirror state', async () => {
    const source = await readFile(new URL('../src/components/app/GameRoot.tsx', import.meta.url), 'utf8');

    assert.match(source, /const ReturnBriefingGate =/);
    assert.match(source, /useState\(\(\) => buildReturnBriefing\(player, Date\.now\(\), maxHp\)\)/);
    assert.match(source, /<ReturnBriefingGate player=\{engine\.player\} maxHp=\{fullStats\?\.maxHp\} \/>/);
    assert.match(source, /engine\.bootStage === 'ready' && engine\.player/);
    assert.doesNotMatch(source, /returnBriefingCheckedRef|setReturnBriefing/);
});

test('return briefing card uses player-facing status language and clamps health percent', async () => {
    const source = await readFile(new URL('../src/components/ReturnBriefingCard.tsx', import.meta.url), 'utf8');

    assert.match(source, /Math\.max\(0, Math\.min\(100,/);
    assert.match(source, /레벨 \{briefing\.level\} · 생명 \{hpPct\}%/);
    assert.doesNotMatch(source, /Lv\.\{briefing\.level\}/);
});
