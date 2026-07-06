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

// ── bossGauge (2026-07 원정 보스 접근 게이지) — 3번째 인자, 하위 호환 ────────

test('getExitBadges: bossGauge 인자 생략 시 기존 2-인자 호출과 동일 (하위 호환)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'), 'bossGauge 인자 없으면 게이지 배지 미표시');
});

test('getExitBadges: bossGauge 값이 0보다 크면 진행도 배지 표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '신성한 호수': 0.42 });
    const gaugeBadge = badges.find((b) => b.id === 'bossGauge');
    assert.ok(gaugeBadge, '게이지 진행도 배지 존재');
    assert.ok(gaugeBadge.label.includes('42'), '진행도 %가 라벨에 포함');
});

test('getExitBadges: bossGauge 값이 0이면 진행도 배지 미표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '신성한 호수': 0 });
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 보스가 이미 격파됐으면 게이지 값이 있어도 게이지 배지 미표시 (boss 배지와 함께 숨김)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, { '고대 호수의 수호신': true }, { '신성한 호수': 0.8 });
    assert.ok(!badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 다른 지역의 게이지 값은 영향 없음 (map.name 키로 조회)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '다른 지역': 0.9 });
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});
