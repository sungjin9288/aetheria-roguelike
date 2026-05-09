import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 393: PREMIUM_SHOP entry category/repeatable 출력 dead 정리
 *   (cycle 222-392 silent dead config 시리즈 156번째 — cleanup lens 연속).
 *
 * 발견 (10 dead 필드):
 * - src/data/premiumShop.ts PREMIUM_SHOP 정의:
 *   · invExpand / synthProtect / revive 3 entry — `category: 'utility'` / `repeatable: true`.
 *   · cosmeticTitles 4 entry — `category: 'cosmetic'`.
 * - 유일 consumer (src/components/PremiumShop.tsx)는 entry spread 후 id/name/desc/cost/onBuy/detail
 *   만 read. utilItem.category / .repeatable 분기 0건, title.category 분기 0건.
 * - src/, tests/ 어디에서도 .category / .repeatable read 0건.
 *
 * 패턴 (cycle 222-392 silent dead config 시리즈 156번째):
 * - cycle 354/355/356: 함수 출력 dead 필드 정리.
 * - cycle 367/368: 데이터 redundant default annotation 정리.
 * - cycle 393: PREMIUM_SHOP entry 출력 dead 일괄 정리 (function-output-dead lens 변형 —
 *   data-config-dead, 연속 7 entry × 2 fields + 4 entry × 1 field).
 *
 * 수정 (src/data/premiumShop.ts):
 * - invExpand / synthProtect / revive 3 entry에서 `category` + `repeatable` 6 lines 제거.
 * - cosmeticTitles 4 entry에서 `category` 4 fields 제거.
 *
 * 회귀 가드:
 * - PREMIUM_SHOP / 4 entry 객체 보존.
 * - id / name / desc / cost / cosmeticTitles 배열 보존.
 * - PremiumShop 컴포넌트 spread 동작 그대로 (사용 필드 모두 보존).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 393: PREMIUM_SHOP entry에서 category 0건', async () => {
    const source = await readSrc('src/data/premiumShop.ts');
    assert.ok(!/category:\s*'utility'/.test(source),
        'utility category 0건');
    assert.ok(!/category:\s*'cosmetic'/.test(source),
        'cosmetic category 0건');
});

test('cycle 393: PREMIUM_SHOP entry에서 repeatable 0건', async () => {
    const source = await readSrc('src/data/premiumShop.ts');
    assert.ok(!/repeatable:\s*true/.test(source),
        'repeatable 0건');
});

test('cycle 393: PREMIUM_SHOP 동작 보존 (사용 필드)', async () => {
    const { PREMIUM_SHOP } = await import('../src/data/premiumShop.js');
    assert.equal(PREMIUM_SHOP.invExpand.id, 'inv_expand', 'invExpand.id 유지');
    assert.equal(PREMIUM_SHOP.invExpand.name, '인벤토리 확장', 'invExpand.name 유지');
    assert.ok(typeof PREMIUM_SHOP.invExpand.cost === 'number', 'invExpand.cost 유지');
    assert.equal(PREMIUM_SHOP.synthProtect.id, 'synth_protect', 'synthProtect.id 유지');
    assert.equal(PREMIUM_SHOP.revive.id, 'revive', 'revive.id 유지');
    assert.equal(PREMIUM_SHOP.invExpand.category, undefined, 'invExpand.category 제거');
    assert.equal(PREMIUM_SHOP.invExpand.repeatable, undefined, 'invExpand.repeatable 제거');
});

test('cycle 393: cosmeticTitles 동작 보존', async () => {
    const { PREMIUM_SHOP } = await import('../src/data/premiumShop.js');
    assert.ok(Array.isArray(PREMIUM_SHOP.cosmeticTitles), 'cosmeticTitles 배열 유지');
    assert.equal(PREMIUM_SHOP.cosmeticTitles.length, 4, '4 cosmetic titles 유지');
    for (const title of PREMIUM_SHOP.cosmeticTitles) {
        assert.ok(typeof title.id === 'string', 'title.id 유지');
        assert.ok(typeof title.name === 'string', 'title.name 유지');
        assert.ok(typeof title.cost === 'number', 'title.cost 유지');
        assert.equal(title.category, undefined, 'title.category 제거');
    }
});

test('cycle 392 회귀 가드: ACTION_KIND_TO_BUTTON open_shop 0건', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    assert.ok(!/open_shop:/.test(source),
        'cycle 392 open_shop 매핑 0건 보존');
});
