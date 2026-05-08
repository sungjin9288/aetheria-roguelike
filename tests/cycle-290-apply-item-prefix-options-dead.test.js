import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 290: applyItemPrefix options 매개변수 dead 정리
 *   (cycle 222-289 silent dead config 시리즈 60번째 — cleanup lens 연속).
 *
 * 발견 (dead parameter):
 * - src/utils/itemPrefixUtils.ts: applyItemPrefix(item, options = {}) — options 매개변수.
 * - options.chance / options.force 분기는 정의돼 있지만 호출 사이트(CombatEngine.loot.ts × 3)
 *   모두 applyItemPrefix(baseItem)만 호출 — options 0건 dispatch.
 *
 * 패턴 (cycle 222-289 silent dead config 시리즈 60번째):
 * - cycle 289: CLASS_BUILD_IDENTITIES 145 lines 데이터 정리.
 * - cycle 290: applyItemPrefix dead 매개변수 정리 (함수 시그니처 단순화).
 *
 * 수정 (src/utils/itemPrefixUtils.ts):
 * - applyItemPrefix(item, options) → applyItemPrefix(item).
 * - options.chance / options.force 분기 제거, BALANCE.ITEM_PREFIX_CHANCE만 사용.
 *
 * 회귀 가드:
 * - CombatEngine.loot.ts 3 호출 사이트 모두 정상 (인자 1개).
 * - prefix 적용 동작 자체는 동일 (chance 비교 + 후보 선택).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 290: applyItemPrefix options 매개변수 제거', async () => {
    const source = await readSrc('src/utils/itemPrefixUtils.ts');
    assert.ok(!/applyItemPrefix\s*=\s*\([^)]*options[^)]*\)/.test(source),
        'applyItemPrefix options 매개변수 제거됨');
    assert.ok(!/options\.chance|options\.force/.test(source),
        'options.chance / options.force 분기 제거됨');
});

test('cycle 290: applyItemPrefix BALANCE.ITEM_PREFIX_CHANCE 직접 사용', async () => {
    const source = await readSrc('src/utils/itemPrefixUtils.ts');
    assert.ok(/BALANCE\.ITEM_PREFIX_CHANCE/.test(source),
        'BALANCE.ITEM_PREFIX_CHANCE 참조 유지');
});

test('cycle 290: CombatEngine.loot.ts 3 호출 사이트 인자 1개', async () => {
    const source = await readSrc('src/systems/CombatEngine.loot.ts');
    const matches = source.match(/applyItemPrefix\([^)]*\)/g) || [];
    assert.ok(matches.length >= 3, `applyItemPrefix 호출 ${matches.length}회 (최소 3)`);
    matches.forEach((call) => {
        // 인자 1개 — 콤마 0개
        assert.ok(!call.includes(','), `${call} 인자 1개`);
    });
});

test('cycle 290: applyItemPrefix 동작 보존 (회귀 가드)', async () => {
    const { applyItemPrefix } = await import('../src/utils/itemPrefixUtils.js');
    // prefix 후보 없는 item (type 미지원) → 그대로 반환.
    const noOpItem = { type: 'consumable', name: '약', val: 1 };
    const result = applyItemPrefix(noOpItem);
    assert.equal(result.name, '약', 'prefix 미적용 그대로 반환');
});

test('cycle 289 회귀 가드: CLASS_BUILD_IDENTITIES 0건 유지', async () => {
    const source = await readSrc('src/data/traits.ts');
    assert.ok(!/export const CLASS_BUILD_IDENTITIES/.test(source),
        'cycle 289 cleanup 유지');
});
