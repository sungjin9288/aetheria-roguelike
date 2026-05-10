import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 449: PHYSICAL_ELEMENTS 배열 + 필터 unreachable 정리
 *   (cycle 222-448 silent dead config 시리즈 207번째 — unreachable code path lens
 *   회귀, cycle 421/425/444/448 패턴, 호출 사이트 producer 분석).
 *
 * 발견 (1 dead array + 1 redundant filter):
 * - src/utils/statsCalculator.ts:
 *     `const PHYSICAL_ELEMENTS: any = ['물리', 'physical'];`
 *     `const isMagic = MAGIC_JOBS.includes(...)
 *                     || (weaponElem && !PHYSICAL_ELEMENTS.includes(weaponElem));`
 * - 호출 사이트 (consumer) 분석:
 *     · weaponElem = item.elem (Korean: 화염/냉기/대지/바람/빛/어둠/에테르/자연 8 종).
 *     · '물리' / 'physical' elem 가진 아이템 0건 (정합성 가드 검증).
 *   → `!PHYSICAL_ELEMENTS.includes(weaponElem)` 항상 true (truthy weaponElem).
 *   → `weaponElem && true` ≡ `Boolean(weaponElem)`. 필터는 무의미한 redundant.
 *
 * 패턴 (cycle 222-448 시리즈 207번째):
 * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
 * - cycle 448: ELEMENT_COLOR_MAP '물리' unreachable.
 * - cycle 449: PHYSICAL_ELEMENTS unreachable filter — 동일 lens 회귀.
 *
 * 수정 (src/utils/statsCalculator.ts):
 * - PHYSICAL_ELEMENTS 배열 정의 제거.
 * - isMagic 체크에서 `!PHYSICAL_ELEMENTS.includes(weaponElem)` 제거 →
 *   `weaponElem && true` → 단순히 `Boolean(weaponElem)`로 단순화.
 *
 * 회귀 가드:
 * - MAGIC_JOBS 활성 path 그대로.
 * - weaponElem 있는 무기는 isMagic = true (이전과 동일 동작).
 * - weaponElem 없는 무기는 MAGIC_JOBS path만 활성 (이전과 동일).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 449: PHYSICAL_ELEMENTS 정의 0건', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(!/PHYSICAL_ELEMENTS/.test(source),
        'PHYSICAL_ELEMENTS 배열 정의/사용 0건');
});

test('cycle 449: MAGIC_JOBS 활성 path 보존', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/MAGIC_JOBS/.test(source), 'MAGIC_JOBS 보존');
    assert.ok(/MAGIC_JOBS\.includes\(player\.job/.test(source),
        'MAGIC_JOBS 활성 사용 보존');
});

test("cycle 449: 정합성 가드 — items.ts에 elem='물리' / 'physical' 0건", async () => {
    const source = await readSrc('src/data/items.ts');
    const physical = (source.match(/(\s|,)elem: ['"](?:물리|physical)['"]/g) || []).length;
    assert.equal(physical, 0, "items.ts에 물리/physical elem 0건");
});

test('cycle 449: calculateFullStats runtime — isMagic 동작 보존', async () => {
    const { calculateFullStats: getFullStats } = await import('../src/utils/statsCalculator.ts');
    // 마법사 직업 → MAGIC_JOBS 활성, 무기 없어도 isMagic = true
    const mage = {
        job: '마법사', name: 'M', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
        equip: { weapon: null, armor: null, offhand: null }, relics: [],
        atk: 5, def: 5, gold: 0,
    };
    const mageStats = getFullStats(mage);
    assert.equal(mageStats.isMagic, true, 'magic job → isMagic=true');

    // 전사 직업 + 화염 무기 → weaponElem path → isMagic = true
    const warrior = {
        job: '전사', name: 'W', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
        equip: { weapon: { elem: '화염', val: 10, type: 'weapon' }, armor: null, offhand: null }, relics: [],
        atk: 5, def: 5, gold: 0,
    };
    const warriorStats = getFullStats(warrior);
    assert.equal(warriorStats.isMagic, true, '화염 무기 → isMagic=true');

    // 전사 직업 + elem 없는 무기 → 두 path 모두 fail → isMagic = false (또는 falsy)
    const physicalWarrior = {
        job: '전사', name: 'W2', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
        equip: { weapon: { val: 10, type: 'weapon' }, armor: null, offhand: null }, relics: [],
        atk: 5, def: 5, gold: 0,
    };
    const physicalStats = getFullStats(physicalWarrior);
    assert.ok(!physicalStats.isMagic, 'elem 없는 무기 + non-magic 직업 → isMagic falsy');
});

test('cycle 448 회귀 가드: ELEMENT_COLOR_MAP 물리 0건', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+물리:/m.test(block), 'cycle 448 물리 엔트리 0건 보존');
});
