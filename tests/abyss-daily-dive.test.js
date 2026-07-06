import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAbyssDailyDive } from '../src/utils/abyssDailyDive.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * 심연 데일리 다이브 — 리뷰 후속으로 "하루 첫 전투 1회"에서
 * "하루 첫 ABYSS_DAILY_DIVE_COMBAT_COUNT(5)전투"로 확장된 카운트 시맨틱 검증.
 * 상태: { date, combats } (구형 { used } 레코드는 같은 날 한정 소진으로 간주).
 */

const COUNT = () => BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT;

test('첫 다이브(기록 없음) → 버프 활성 + 첫 전투 안내 + combats 1', () => {
    const result = resolveAbyssDailyDive({ stats: { abyssDailyDive: null } }, '2026-07-06');
    assert.equal(result.multiplierActive, true);
    assert.equal(result.isFirstOfDay, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', combats: 1 });
});

test('전일 기록 → 날짜 전환으로 리셋되어 버프 활성', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-05', combats: COUNT() } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');
    assert.equal(result.multiplierActive, true);
    assert.equal(result.isFirstOfDay, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', combats: 1 });
});

test('같은 날 카운트 진행: 2번째 전투는 버프 유지, 안내는 첫 전투만', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-06', combats: 1 } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');
    assert.equal(result.multiplierActive, true);
    assert.equal(result.isFirstOfDay, false, '안내 로그는 첫 전투 1회만');
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', combats: 2 });
});

test('카운트 경계: COUNT-1번째까지 활성, COUNT번째 소진 후 비활성', () => {
    const lastActive = resolveAbyssDailyDive(
        { stats: { abyssDailyDive: { date: '2026-07-06', combats: COUNT() - 1 } } }, '2026-07-06');
    assert.equal(lastActive.multiplierActive, true, `${COUNT()}번째 전투까지 활성`);
    assert.equal(lastActive.nextAbyssDailyDive.combats, COUNT());

    const exhausted = resolveAbyssDailyDive(
        { stats: { abyssDailyDive: { date: '2026-07-06', combats: COUNT() } } }, '2026-07-06');
    assert.equal(exhausted.multiplierActive, false, '카운트 소진 후 비활성');
    assert.equal(exhausted.nextAbyssDailyDive.combats, COUNT(), '소진 후 카운트 증가 없음 (dispatch 억제 계약)');
});

test('구형 레코드 하위 호환: 같은 날 { used: true } → 소진으로 간주', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-06', used: true } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');
    assert.equal(result.multiplierActive, false);
});

test('손상 레코드 방어: 같은 날 combats/used 모두 부재 → 첫 전투로 취급', () => {
    const player = { stats: { abyssDailyDive: { date: '2026-07-06' } } };
    const result = resolveAbyssDailyDive(player, '2026-07-06');
    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', combats: 1 });
});

test('stats 자체 부재 방어', () => {
    const result = resolveAbyssDailyDive({}, '2026-07-06');
    assert.equal(result.multiplierActive, true);
    assert.deepEqual(result.nextAbyssDailyDive, { date: '2026-07-06', combats: 1 });
});

test('BALANCE 상수 계약: MULT 1.5 + COMBAT_COUNT 5', () => {
    assert.equal(BALANCE.ABYSS_DAILY_DIVE_MULT, 1.5);
    assert.equal(BALANCE.ABYSS_DAILY_DIVE_COMBAT_COUNT, 5);
});
