import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 293: getAllItems export → private downgrade
 *   (cycle 222-292 silent dead config 시리즈 63번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/gameUtils.ts: getAllItems — findItemByName 내부 1회만 사용,
 *   외부 consumer 0건 (test import 0건, 주석 1건만).
 *
 * 패턴 (cycle 222-292 silent dead config 시리즈 63번째):
 * - cycle 292: normalizeText private downgrade.
 * - cycle 293: getAllItems private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/gameUtils.ts):
 * - `export const getAllItems` → `const getAllItems` (private).
 *
 * 회귀 가드:
 * - findItemByName active export 유지 — 외부 6건 사용.
 * - findItemByName 동작 동일 (내부에서 getAllItems 호출).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 293: getAllItems export 제거 (private)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/export const getAllItems/.test(source),
        'getAllItems export 제거됨');
    assert.ok(/const getAllItems/.test(source),
        'getAllItems const 정의 유지 (private)');
});

test('cycle 293: findItemByName active export 유지', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/export const findItemByName/.test(source),
        'findItemByName export 유지');
});

test('cycle 293: findItemByName 동작 보존 (회귀 가드 — getAllItems 내부 사용)', async () => {
    const { findItemByName } = await import('../src/utils/gameUtils.js');
    // 미존재 아이템 → undefined.
    assert.equal(findItemByName('___not_a_real_item___'), undefined,
        '미존재 lookup undefined');
});

test('cycle 292 회귀 가드: normalizeText private 유지', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const normalizeText/.test(source),
        'cycle 292 normalizeText private 유지');
});
