import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 292: normalizeText export → private downgrade
 *   (cycle 222-291 silent dead config 시리즈 62번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/aiEventUtils.ts: normalizeText — aiEventUtils 내부에서 14회 사용,
 *   외부 consumer 0건. 텍스트 정규화 헬퍼.
 *
 * 패턴 (cycle 222-291 silent dead config 시리즈 62번째):
 * - cycle 291: updateStats / getWeaponEquipScore private downgrade.
 * - cycle 292: normalizeText private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - `export const normalizeText` → `const normalizeText` (private).
 *
 * 회귀 가드:
 * - aiEventUtils 다른 active export 유지 (buildEventPackage, classifyChoice 등).
 * - 14회 내부 호출 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 292: normalizeText export 제거 (private)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const normalizeText/.test(source),
        'normalizeText export 제거됨');
    assert.ok(/const normalizeText/.test(source),
        'normalizeText const 정의 유지 (private)');
});

test('cycle 292: aiEventUtils active exports 유지', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const activeExports = ['classifyChoice', 'buildEventPackage', 'pickFallbackEvent', 'summarizeHistory', 'getRecentEventSet', 'getPoolKeyByLocation'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 292: classifyChoice 동작 보존 (회귀 가드 — normalizeText 내부 사용)', async () => {
    const { classifyChoice } = await import('../src/utils/aiEventUtils.js');
    assert.equal(classifyChoice('조심히 접근한다'), 'safe', 'safe 분류');
    assert.equal(classifyChoice('강제로 연다'), 'risky', 'risky 분류');
});

test('cycle 291 회귀 가드: 2 private downgrade 유지', async () => {
    const psSrc = await readSrc('src/utils/playerStateUtils.ts');
    const eqSrc = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/export const updateStats/.test(psSrc), 'updateStats private 유지');
    assert.ok(!/export const getWeaponEquipScore/.test(eqSrc), 'getWeaponEquipScore private 유지');
});
