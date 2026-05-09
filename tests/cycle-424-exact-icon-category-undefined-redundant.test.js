import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 424: EXACT_ICON_CATEGORY_BY_TYPE 'undefined' 엔트리 redundant 정리
 *   (cycle 222-423 silent dead config 시리즈 184번째 — defensive fallback redundancy
 *   lens 회귀, cycle 373-388 16-cycle 시리즈 패턴).
 *
 * 발견 (1 redundant entry):
 * - src/utils/itemVisuals.ts EXACT_ICON_CATEGORY_BY_TYPE에
 *     `undefined: 'misc'` 엔트리.
 * - 호출 사이트 (line 105): `EXACT_ICON_CATEGORY_BY_TYPE[item.type] || 'misc'`.
 * - 동작 분석:
 *     · `item.type` undefined → JS 브래킷 룩업 `obj[undefined]`은 문자열 키
 *       `'undefined'`로 coerce → 엔트리 값 'misc' 반환.
 *     · 엔트리 제거 시 `obj[undefined]` returns undefined → `|| 'misc'` fallback이
 *       동일 'misc' 반환.
 *   → 양쪽 path 모두 'misc' 산출. 엔트리는 기능적 잉여.
 *
 * 패턴 (cycle 222-423 시리즈 184번째):
 * - cycle 373-388 시리즈 (16 cycles): defensive fallback redundancy.
 * - cycle 424: EXACT_ICON_CATEGORY_BY_TYPE 'undefined' redundant — 동일 lens 회귀.
 *
 * 수정 (src/utils/itemVisuals.ts):
 * - EXACT_ICON_CATEGORY_BY_TYPE에서 `undefined: 'misc'` 라인 제거.
 *
 * 회귀 가드:
 * - 활성 type 매핑 10종 (weapon/armor/shield/hp/mp/cure/buff/mat/key/all) 보존.
 * - `|| 'misc'` fallback 보존 → recipes 등 type 부재 아이템 'misc' 동일 산출.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 424: EXACT_ICON_CATEGORY_BY_TYPE에서 undefined 엔트리 0건', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+undefined:/m.test(block), 'EXACT_ICON_CATEGORY_BY_TYPE에서 undefined 엔트리 0건');
});

test('cycle 424: 활성 type 매핑 10종 보존', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const activeKeys = ['weapon', 'armor', 'shield', 'hp', 'mp', 'cure', 'buff', 'mat', 'key', 'all'];
    for (const key of activeKeys) {
        const re = new RegExp(`^\\s+${key}:`, 'm');
        assert.ok(re.test(block), `활성 키 ${key} 보존`);
    }
});

test('cycle 424: `|| misc` fallback 보존 → recipes 등 type 부재 아이템 동일 동작', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    assert.ok(/EXACT_ICON_CATEGORY_BY_TYPE\[item\.type\] \|\| 'misc'/.test(source),
        "fallback `|| 'misc'` 보존");
});

test('cycle 424: EXACT_ITEM_ICON_KEYS 빌드 산출물 회귀 — 활성 카테고리 카운트 보존', async () => {
    const { EXACT_ITEM_ICON_KEYS } = await import('../src/utils/itemVisuals.ts');
    const cats = {};
    for (const key of Object.values(EXACT_ITEM_ICON_KEYS)) {
        if (typeof key !== 'string') continue;
        const cat = key.split('-')[1];
        cats[cat] = (cats[cat] || 0) + 1;
    }
    // 활성 카테고리만 산출 (weapon/armor/shield/consumable/material/key/relic 등).
    // 'undefined' 엔트리 제거가 builder 동작에 영향 없음 — 모든 아이템 type 명시되어
    // dedupe 과정에서 'misc' fallback path 진입 0건.
    assert.ok(Object.keys(cats).length > 0, '활성 카테고리 산출');
    assert.ok(!cats.undefined, "'undefined' 카테고리 0건 (체계 정합)");
});

test('cycle 423 회귀 가드: ControlPanel sidebarLabel 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const matches = source.match(/sidebarLabel/g) || [];
    assert.equal(matches.length, 0, 'cycle 423 sidebarLabel 0건 보존');
});
