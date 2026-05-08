import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 339: getSynthesisGroups rarity 출력 필드 dead 정리 + cascade getItemRarity import
 *   (cycle 222-338 silent dead config 시리즈 108번째 — cleanup lens 연속).
 *
 * 발견 (dead output field + cascade):
 * - getSynthesisGroups 그룹 객체에 `rarity: getItemRarity(item)` 필드 추가.
 * - src/, tests/ 어디에서도 group.rarity / grp.rarity read 0건.
 * - CraftingPanel은 type / tier / count / items만 사용.
 * - getItemRarity import는 rarity 필드 제거 후 cascade dead → import 라인도 제거.
 *
 * 패턴 (cycle 222-338 silent dead config 시리즈 108번째):
 * - cycle 338: validateSynthesis type 출력 dead.
 * - cycle 339: getSynthesisGroups rarity 출력 dead + getItemRarity cascade import 정리.
 *
 * 수정 (src/utils/synthesisUtils.ts):
 * - groups[key] 초기화에서 rarity 필드 제거.
 * - getItemRarity import 제거 (cascade dead).
 *
 * 회귀 가드:
 * - type / tier / items / count 필드 보존.
 * - signature item 제외 / tier >= 6 제외 / synthesizable 필터 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 339: getSynthesisGroups rarity 필드 0건', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/rarity:\s*getItemRarity/.test(source),
        'rarity 필드 제거됨');
});

test('cycle 339: getItemRarity import cascade 제거', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/^import \{ getItemRarity \}/m.test(source),
        'getItemRarity import 제거됨');
});

test('cycle 339: getSynthesisGroups 동작 보존', async () => {
    const { getSynthesisGroups } = await import('../src/utils/synthesisUtils.js');
    const inv = [
        { name: '녹슨 단검 1', type: 'weapon', tier: 1 },
        { name: '녹슨 단검 2', type: 'weapon', tier: 1 },
        { name: '녹슨 단검 3', type: 'weapon', tier: 1 },
    ];
    const groups = getSynthesisGroups(inv);
    if (groups.length > 0) {
        assert.equal(groups[0].type, 'weapon');
        assert.equal(groups[0].tier, 1);
        assert.equal(groups[0].count, 3);
        assert.equal(groups[0].rarity, undefined, 'rarity 출력 0건');
    }
});

test('cycle 338 회귀 가드: validateSynthesis type 0건 보존', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/return \{ valid: true,[^}]*\btype,/.test(source),
        'cycle 338 type 출력 제거 보존');
});
