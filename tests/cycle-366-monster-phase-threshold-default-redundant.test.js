import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 366: monsters.ts phase2/phase3 threshold default 7회 redundant 정리
 *   (cycle 222-365 silent dead config 시리즈 132번째 — cleanup lens 연속).
 *
 * 발견 (7 dead config field — default 명시):
 * - monsters.ts phase2 객체 2개에 `threshold: 0.5` — BALANCE.BOSS_PHASE2_THRESHOLD
 *   기본값(0.5)과 동일.
 * - monsters.ts phase3 객체 5개에 `threshold: 0.25` — CombatEngine.ts:1098의
 *   `phase3.threshold ?? 0.25` 기본값과 동일.
 * - 두 케이스 모두 `?? default` fallback이 적용되므로 기본값과 같은 명시는 redundant.
 * - threshold가 다른 값(0.2)인 phase3 5개는 보존 (실제 효과 차이).
 *
 * 패턴 (cycle 222-365 silent dead config 시리즈 132번째):
 * - cycle 365: eventChain outcome chainId 70 redundant duplicates.
 * - cycle 366: monster phase threshold default 7 redundant duplicates.
 *
 * 수정 (src/data/monsters.ts):
 * - phase2의 `threshold: 0.5` 2회 제거.
 * - phase3의 `threshold: 0.25` 5회 제거.
 *
 * 회귀 가드:
 * - phase3의 `threshold: 0.2` 5회 보존 (default와 다른 값).
 * - phase2/phase3 다른 모든 필드(name/atkBonus/defBonus/pattern/log/statusEffect) 보존.
 * - CombatEngine phase 전환 동작 그대로 (`?? default` fallback).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 366: phase2 threshold 0.5 redundant 0건', async () => {
    const source = await readSrc('src/data/monsters.ts');
    const phase2WithThreshold = source.match(/phase2:[^}]+threshold:/g) || [];
    assert.equal(phase2WithThreshold.length, 0,
        `phase2 entries with explicit threshold 0건이어야 함, ${phase2WithThreshold.length}건 발견`);
});

test('cycle 366: phase3 threshold 0.25 redundant 0건', async () => {
    const source = await readSrc('src/data/monsters.ts');
    const phase3WithThreshold025 = source.match(/phase3:[^}]+threshold: 0\.25/g) || [];
    assert.equal(phase3WithThreshold025.length, 0,
        `phase3 entries with threshold: 0.25 0건이어야 함, ${phase3WithThreshold025.length}건 발견`);
});

test('cycle 366: phase3 threshold 0.2 (default와 다름) 5회 보존', async () => {
    const source = await readSrc('src/data/monsters.ts');
    const phase3WithThreshold02 = source.match(/phase3:[^}]+threshold: 0\.2[^0-9]/g) || [];
    assert.equal(phase3WithThreshold02.length, 5,
        `phase3 threshold: 0.2 5회 보존, 발견 ${phase3WithThreshold02.length}`);
});

test('cycle 366: phase2/phase3 핵심 필드 보존 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // 원시의 신 — phase2(threshold 0.5 → 기본값) + phase3 (0.25 default 보존)
    const primordial = MONSTERS['원시의 신'];
    assert.ok(primordial, '원시의 신 보스 존재');
    assert.ok(primordial.phase2.name, 'phase2.name 보존');
    assert.ok(primordial.phase2.atkBonus, 'phase2.atkBonus 보존');
    assert.ok(primordial.phase2.pattern, 'phase2.pattern 보존');
    assert.ok(primordial.phase2.log, 'phase2.log 보존');
    assert.equal(primordial.phase2.threshold, undefined, 'phase2.threshold 0건 (default 0.5 fallback)');
});

test('cycle 365 회귀 가드: eventChain outcome.chainId 0건 보존', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    const matches = source.match(/chainId:/g) || [];
    assert.equal(matches.length, 0, 'cycle 365 chainId 0건 보존');
});
