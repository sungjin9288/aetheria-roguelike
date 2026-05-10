import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 517: getArmorBodyStyle `fallback = 'coat'` default unreachable
 *   (cycle 222-516 silent dead config 시리즈 262번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 15번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/equipmentArt.ts (line 88):
 *     const getArmorBodyStyle = (item, fallback: any = 'coat') => {...}
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · equipmentArt.ts:148 — getArmorBodyStyle(item, fallbackArmorStyle).
 *     · fallbackArmorStyle은 cycle 513에서 보존된 getEquipmentArtProfile의
 *       fallbackArmorStyle: any = 'coat' default(여전히 활성). 즉 caller에서
 *       이미 string 보장된 값을 명시 전달.
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: fallback 항상 명시 전달. inner default 'coat' 도달 불가.
 *
 * 패턴 (cycle 222-516 시리즈 262번째):
 * - cycle 502-516: util default 청소 메가 시리즈.
 * - cycle 517: getArmorBodyStyle fallback — 동일 lens. 외부 wrapper에 default가
 *   살아있으면 inner fn의 동일 default는 불필요한 redundancy.
 *
 * 수정 (src/utils/equipmentArt.ts):
 * - getArmorBodyStyle signature에서 fallback: any = 'coat' → fallback: any.
 * - body의 if (!item || item.type !== 'armor') return fallback 보존.
 * - getArmorStyleFromItem(item, fallback) 호출 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body return fallback / getArmorStyleFromItem 호출 보존.
 * - 외부 wrapper getEquipmentArtProfile fallbackArmorStyle default 'coat'
 *   유지 — wrapper가 entry point (cycle 513 명시).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 517: getArmorBodyStyle signature에서 fallback default 0건', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fnIdx = source.indexOf('const getArmorBodyStyle');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/fallback:\s*any\s*=\s*'coat'/.test(sig), 'fallback default coat 제거');
    assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
});

test('cycle 517: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/getArmorBodyStyle\(item,\s*fallbackArmorStyle\)/.test(source),
        'internal callsite (item, fallbackArmorStyle) 보존');
});

test('cycle 517: body return fallback / getArmorStyleFromItem 호출 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/if \(!item \|\| item\.type !== 'armor'\) return fallback/.test(source),
        'early return fallback 보존');
    assert.ok(/getArmorStyleFromItem\(item,\s*fallback\)/.test(source),
        'getArmorStyleFromItem(item, fallback) 호출 보존');
});

test('cycle 517: 외부 wrapper getEquipmentArtProfile fallbackArmorStyle default 보존 (cycle 513)', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/fallbackArmorStyle:\s*any\s*=\s*'coat'/.test(source),
        'wrapper getEquipmentArtProfile fallbackArmorStyle default 활성 보존');
});

test('cycle 517: cycle 502-516 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/getEnhanceRequirement[^=]*currentLevel:\s*any\s*=\s*0/.test(eu),
        'cycle 516 getEnhanceRequirement currentLevel default 0건');

    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/advanceExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
        'cycle 515 advanceExploreState stats default 0건');
});
