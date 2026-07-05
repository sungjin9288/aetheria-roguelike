import test from 'node:test';
import assert from 'node:assert/strict';

import { getExitBadges } from '../src/utils/mapBadges.js';

test('getExitBadges returns a boss badge when the map has an undefeated named boss', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'boss'));
});

test('getExitBadges hides the boss badge once that boss has been defeated', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const areaBossDefeated = { '고대 호수의 수호신': true };
    const badges = getExitBadges(map, areaBossDefeated);
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges shows a boss badge for boolean boss flag maps regardless of defeated map (no name to key on)', () => {
    const map = { boss: true, eventChance: 0.1 };
    const badges = getExitBadges(map, { 아무거나: true });
    assert.ok(badges.some((b) => b.id === 'boss'));
});

test('getExitBadges returns no boss badge when map has no boss', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges returns high-event badge when eventChance meets or exceeds the threshold', () => {
    const highChanceMap = { eventChance: 0.3 };
    const badges = getExitBadges(highChanceMap, {});
    assert.ok(badges.some((b) => b.id === 'highEvent'));

    const lowChanceMap = { eventChance: 0.15 };
    const lowBadges = getExitBadges(lowChanceMap, {});
    assert.ok(!lowBadges.some((b) => b.id === 'highEvent'));
});

test('getExitBadges returns a shop badge when the map has shopBonus', () => {
    const map = { shopBonus: 1.5 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns no shop badge when shopBonus is absent', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(!badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns a grave badge when the map has graveDropBonus', () => {
    const map = { graveDropBonus: 2.0 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'grave'));
});

test('getExitBadges combines multiple applicable badges', () => {
    const map = { boss: '심연의 크라켄', eventChance: 0.35, shopBonus: 1.2, graveDropBonus: 1.5 };
    const badges = getExitBadges(map, {});
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes('boss'));
    assert.ok(ids.includes('highEvent'));
    assert.ok(ids.includes('shop'));
    assert.ok(ids.includes('grave'));
});

test('getExitBadges returns empty array for a plain map with none of the tracked fields', () => {
    const map = { level: 5, type: 'dungeon' };
    const badges = getExitBadges(map, {});
    assert.deepEqual(badges, []);
});

test('getExitBadges handles null/undefined map gracefully', () => {
    assert.deepEqual(getExitBadges(null, {}), []);
    assert.deepEqual(getExitBadges(undefined, {}), []);
});

test('getExitBadges each badge has an id and a label string', () => {
    const map = { boss: '보스', eventChance: 0.5, shopBonus: 1, graveDropBonus: 1 };
    const badges = getExitBadges(map, {});
    for (const badge of badges) {
        assert.equal(typeof badge.id, 'string');
        assert.equal(typeof badge.label, 'string');
        assert.ok(badge.label.length > 0);
    }
});
