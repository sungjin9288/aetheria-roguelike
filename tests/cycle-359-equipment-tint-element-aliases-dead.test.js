import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 359: ELEMENT_FILTERS 불 / 얼음 / 화염속성 3 unreachable aliases dead 정리
 *   (cycle 222-358 silent dead config 시리즈 126번째 — cleanup lens 연속).
 *
 * 발견 (3 dead element aliases):
 * - equipmentTint.ts ELEMENT_FILTERS 11 keys: 화염 / 불 / 화염속성 / 냉기 / 얼음 /
 *   빛 / 자연 / 대지 / 어둠 / 에테르 / 바람.
 * - src/data/items.ts 모든 아이템의 실제 elem 값: 화염 / 냉기 / 빛 / 자연 / 대지 /
 *   어둠 / 에테르 / 바람 / 물리 8종만 사용. (cycle 223에서 '얼음' → '냉기' 일괄 통일)
 * - 따라서 ELEMENT_FILTERS의 '불' / '얼음' / '화염속성' 3 entries는 unreachable —
 *   item.elem이 이 값을 가지는 경우 0건.
 *
 * 패턴 (cycle 222-358 silent dead config 시리즈 126번째):
 * - cycle 358: TONE_GLOW.steel / TONE_ACCENT.steel 2 unreachable.
 * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
 *
 * 수정 (src/utils/equipmentTint.ts):
 * - ELEMENT_FILTERS에서 불 / 얼음 / 화염속성 3 entries 제거.
 *
 * 회귀 가드:
 * - 활성 8 elem (화염/냉기/빛/자연/대지/어둠/에테르/바람) 보존.
 * - getEquipmentTintFilter 동작 그대로 (lookup hit/miss 패턴 유지).
 * - cycle 223 '얼음' → '냉기' 통일 회귀 가드 (items.ts 검사) 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 359: ELEMENT_FILTERS 불 / 얼음 / 화염속성 0건', async () => {
    const source = await readSrc('src/utils/equipmentTint.ts');
    const fnStart = source.indexOf('const ELEMENT_FILTERS');
    const fnEnd = source.indexOf('const matchHint');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+불:/m.test(block), 'ELEMENT_FILTERS에서 불 0건');
    assert.ok(!/^\s+얼음:/m.test(block), 'ELEMENT_FILTERS에서 얼음 0건');
    assert.ok(!/^\s+화염속성:/m.test(block), 'ELEMENT_FILTERS에서 화염속성 0건');
});

test('cycle 359: ELEMENT_FILTERS 활성 8 elem 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/equipmentTint.ts');
    const fnStart = source.indexOf('const ELEMENT_FILTERS');
    const fnEnd = source.indexOf('const matchHint');
    const block = source.slice(fnStart, fnEnd);
    const activeElems = ['화염', '냉기', '빛', '자연', '대지', '어둠', '에테르', '바람'];
    for (const elem of activeElems) {
        assert.ok(new RegExp(`^\\s+${elem}:`, 'm').test(block), `${elem} 보존`);
    }
});

test('cycle 359: getEquipmentTintFilter 동작 보존 (활성 elem)', async () => {
    const { getEquipmentTintFilter } = await import('../src/utils/equipmentTint.js');
    const fireItem = { name: '화염의 검', tier: 4, elem: '화염' };
    const filter = getEquipmentTintFilter(fireItem);
    assert.ok(filter !== null, 'fire elem 필터 적용');
    assert.ok(/hue-rotate/.test(filter), 'hue-rotate CSS 생성');
});

test('cycle 358 회귀 가드: TONE_GLOW.steel / TONE_ACCENT.steel 0건 보존', async () => {
    const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
    const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(!/^\s+steel:/m.test(overlay), 'cycle 358 TONE_GLOW.steel 0건 보존');
    assert.ok(!/^\s+steel:/m.test(codex), 'cycle 358 TONE_ACCENT.steel 0건 보존');
});
