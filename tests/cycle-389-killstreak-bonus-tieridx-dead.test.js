import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 389: computeKillStreakBonus 반환 tierIdx dead 필드 정리
 *   (cycle 222-388 silent dead config 시리즈 153번째 — cleanup lens 연속).
 *
 * 발견 (1 dead output 필드):
 * - src/utils/statsCalculator.ts line 264-272: 내부 helper computeKillStreakBonus가
 *   `{ atkBonus, critBonus, tierIdx }`를 반환.
 * - 유일 consumer (calculateFullStats line 378-394)는 `streak.atkBonus` / `streak.critBonus`만 read.
 * - `streak.tierIdx`는 consumer 0건 — internal scope에서도 read 0건.
 * - tierIdx는 함수 내부에서 atkBonus/critBonus 계산용 lookup index로만 사용.
 *   외부로 expose해야 할 이유 없음.
 * - cycle 278 회귀 가드는 함수 존재 + atkBonus/critBonus 계산 보존만 검증.
 *
 * 패턴 (cycle 222-388 silent dead config 시리즈 153번째):
 * - cycle 388: migrateData killStreak normalization redundant.
 * - cycle 389: computeKillStreakBonus.tierIdx 출력 1 dead 필드 정리
 *   (function output dead lens 변형 — internal helper 출력 cleanup).
 *
 * 수정 (src/utils/statsCalculator.ts):
 * - return { atkBonus, critBonus } (tierIdx 제거).
 * - JSDoc @returns 표기 갱신.
 *
 * 회귀 가드:
 * - tierIdx 변수 자체는 함수 내부 atkBonus/critBonus 계산용으로 유지.
 * - calculateFullStats의 streak.atkBonus / streak.critBonus 동작 그대로.
 * - cycle 278 killStreak raw count 필드 / atkBonus / critBonus 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 389: computeKillStreakBonus 반환에서 tierIdx 필드 제거', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    const fnStart = source.indexOf('const computeKillStreakBonus');
    const fnEnd = source.indexOf('export const calculateFullStats');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/return\s*\{[^}]*tierIdx[^}]*\}/.test(block),
        'computeKillStreakBonus return object에서 tierIdx 필드 제거됨');
});

test('cycle 389: tierIdx 변수는 atkBonus/critBonus 계산용으로 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    const fnStart = source.indexOf('const computeKillStreakBonus');
    const fnEnd = source.indexOf('export const calculateFullStats');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/const tierIdx = BALANCE\.KILL_STREAK_TIERS\.reduce/.test(block),
        'tierIdx 변수 자체는 lookup index로 유지');
    assert.ok(/atkBonus = tierIdx >= 0/.test(block),
        'atkBonus 계산 보존');
    assert.ok(/critBonus = tierIdx >= 0/.test(block),
        'critBonus 계산 보존');
});

test('cycle 389: calculateFullStats streak.atkBonus / streak.critBonus 동작 보존', async () => {
    const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
    const player = {
        name: 'test', job: '모험가', hp: 100, maxHp: 150, mp: 30, maxMp: 50,
        atk: 10, def: 5,
        equip: { weapon: null, armor: null, offhand: null },
        relics: [], inv: [],
        stats: { kills: 0, total_gold: 0, deaths: 0 },
        killStreak: 5,
    };
    const stats = calculateFullStats(player);
    assert.ok(stats, 'calculateFullStats 동작');
    assert.ok(typeof stats.atk === 'number', 'finalAtk 계산');
    assert.ok(typeof stats.critChance === 'number', 'finalCritChance 계산');
});

test('cycle 388 회귀 가드: migrateData killStreak normalization 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/typeof target\.killStreak !== 'number'/.test(block),
        'cycle 388 killStreak normalization 0건 보존');
});
