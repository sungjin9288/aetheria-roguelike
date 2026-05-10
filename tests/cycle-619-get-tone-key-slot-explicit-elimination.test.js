import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 619: getToneKey slot default 'weapon' explicit elimination
 *   (cycle 222-618 silent dead config 시리즈 358번째 — explicit
 *   default-elimination pattern 11번째 적용, 이중자릿수 진입 후 첫 사이클).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/utils/equipmentArt.ts (line 58):
 *     const getToneKey = (item: Item | null | undefined, slot: any = 'weapon') => {...}
 * - 호출 사이트 6개 모두 명시 인자 전달:
 *     · line 156: getToneKey(item, 'armor')
 *     · line 172: getToneKey(item, 'offhand')
 *     · line 185: getToneKey(item, 'weapon')
 *     · line 200: getToneKey(item, slotHint || item.type)
 *     · line 201: getToneKey(item, slotHint || item.type)
 *     · line 202: getToneKey(item, slotHint || item.type)
 * - default 'weapon' 도달 불가 (이미 unreachable).
 *
 * 패턴 (cycle 222-618 시리즈 358번째):
 * - cycle 502-618: default 청소 메가 시리즈 116사이클.
 * - cycle 619: explicit default-elimination 11번째 (cycle 618 10th 이중자릿수
 *   진입 후 첫 적용). 6 callsite 모두 명시인 상태에서 signature 정리.
 *
 * 수정:
 * - equipmentArt.ts:58 — slot default 'weapon' 제거.
 *
 * 회귀 가드:
 * - 6 internal callsite 동작 그대로 (이미 명시).
 * - body branch 처리 보존 (armor/offhand/weapon 분기).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 619: getToneKey signature에서 slot default 'weapon' 0건", async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(source),
        "getToneKey slot default 'weapon' 제거");
    assert.ok(/const getToneKey = \(item:[^)]+slot:\s*any\)/.test(source),
        'getToneKey slot 파라미터 보존 (default 없이)');
});

test('cycle 619: 6 callsite slot 명시 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/getToneKey\(item,\s*'armor'\)/.test(source), "armor caller 보존");
    assert.ok(/getToneKey\(item,\s*'offhand'\)/.test(source), "offhand caller 보존");
    assert.ok(/getToneKey\(item,\s*'weapon'\)/.test(source), "weapon caller 보존");
    const slotHintCount = (source.match(/getToneKey\(item,\s*slotHint\s*\|\|\s*item\.type\)/g) || []).length;
    assert.equal(slotHintCount, 3, 'slotHint || item.type caller 3건 보존');
});

test('cycle 619: cycle 502-618 회귀 가드 — default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(!/getISOWeekNumber = \(date\s*=\s*new Date\(\)\)/.test(eu),
        'cycle 618 getISOWeekNumber date default 0건');
    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/safeList = \(items: any, fallback:\s*any\s*=\s*'\[item\]'\)/.test(ut),
        "cycle 617 safeList fallback default 0건");
});
