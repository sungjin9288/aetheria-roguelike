import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 332: getAdventureGuidance secondaryAction 11회 + mpRatio 변수 dead 정리
 *   (cycle 222-331 silent dead config 시리즈 101번째 — cleanup lens 연속).
 *
 * 발견 (dead field cascade from cycle 310):
 * - getAdventureGuidance 11 return statement에서 각각 `secondaryAction: ...` 정의.
 *   cycle 310 FocusPanel 제거 후 src/, tests/ 어디에서도 `guidance.secondaryAction` read 0건.
 * - mpRatio 변수: secondaryAction의 'MP도 회복' 분기 (`mpRatio <= 0.45 ? ...`) 외에서 read 0건.
 *   secondaryAction 제거로 cascade dead.
 *
 * 패턴 (cycle 222-331 silent dead config 시리즈 101번째):
 * - cycle 331: emphasis 11회 dead 일괄 제거.
 * - cycle 332: secondaryAction 11회 + mpRatio 변수 cascade dead.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - 11 secondaryAction 필드 일괄 제거 (sed `/secondaryAction:/d`).
 * - mpRatio 변수 정의 제거 (lint no-unused-vars).
 *
 * 회귀 가드:
 * - getAdventureGuidance title / detail / primaryAction 필드 보존.
 * - 다른 함수의 mpRatio (line 138 getMoveRecommendations) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 332: getAdventureGuidance secondaryAction 0개 (11개 모두 제거)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    // line 246 이후 (getAdventureGuidance 함수)에 secondaryAction 0건.
    const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
    assert.ok(!/secondaryAction:/.test(guidanceFn),
        'getAdventureGuidance에서 secondaryAction 0건');
});

test('cycle 332: mpRatio 변수 getAdventureGuidance에서 제거', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
    assert.ok(!/const mpRatio =/.test(guidanceFn),
        'getAdventureGuidance에서 mpRatio 정의 제거됨');
});

test('cycle 332: getMoveRecommendations의 mpRatio 보존 (line 138)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    // 다른 함수의 mpRatio는 그대로 (function scope 무관).
    const matches = (source.match(/const mpRatio =/g) || []).length;
    assert.equal(matches, 1, 'mpRatio 정의 1개만 남음 (getMoveRecommendations)');
});

test('cycle 332: getAdventureGuidance 동작 보존 (primaryAction 흐름)', async () => {
    const { getAdventureGuidance } = await import('../src/utils/adventureGuide.js');
    const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: {} };
    const stats = { maxHp: 100, maxMp: 50 };
    const guidance = getAdventureGuidance(player, stats, { type: 'safe' }, 'idle');
    assert.ok(guidance, 'guidance 객체 반환');
    assert.equal(guidance.secondaryAction, undefined, 'secondaryAction undefined');
    assert.ok(guidance.primaryAction !== undefined, 'primaryAction 존재');
});

test('cycle 331 회귀 가드: emphasis 제거 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
    assert.ok(!/emphasis:/.test(guidanceFn),
        'cycle 331 emphasis 제거 보존');
});
