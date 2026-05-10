import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 607: uniqueList `values = []` default unreachable
 *   (cycle 222-606 silent dead config 시리즈 343번째 — redundant default annotation
 *   청소 메가 시리즈 추가, mapProgress.ts).
 *
 * 발견 (1 default unreachable):
 * - src/utils/mapProgress.ts (line 3):
 *     const uniqueList = (values: any = []) => [...new Set(values.filter(Boolean))];
 * - 호출 사이트 (1 caller):
 *     · mapProgress.ts:5 — uniqueList([...(map?.monsters || []), ...(map?.bossMonsters
 *       || []), typeof map?.boss === 'string' ? map.boss : null]) — spread array 명시.
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과: values 항상 spread array 명시 전달. default [] 도달 불가.
 *
 * 패턴 (cycle 222-606 시리즈 343번째):
 * - cycle 502-606: default 청소 메가 시리즈 105사이클.
 * - cycle 607: utils/mapProgress.ts 추가 cleanup. cycle 577과 동일 모듈 paired.
 *
 * 수정 (src/utils/mapProgress.ts):
 * - signature에서 values: any = [] → values: any.
 * - body의 values.filter(Boolean) 처리 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body new Set / filter 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 607: uniqueList signature에서 values default 0건', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(!/const uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(source),
        'uniqueList values default [] 제거');
    assert.ok(/const uniqueList = \(values:\s*any\)/.test(source),
        'uniqueList values 파라미터 자체는 보존');
});

test('cycle 607: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(/uniqueList\(\[\s*\n\s*\.\.\.\(map\?\.monsters \|\| \[\]\)/.test(source),
        'getMapEncounterRoster uniqueList(spread array) callsite 보존');
});

test('cycle 607: body new Set / filter 처리 보존', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(/\[\.\.\.new Set\(values\.filter\(Boolean\)\)\]/.test(source),
        '[...new Set(values.filter(Boolean))] 보존');
});

test('cycle 607: cycle 502-606 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/generateEvent: async \(loc: any, history: any\[\]\s*=\s*\[\]/.test(ai),
        'cycle 606 generateEvent history default 0건');

    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/seedEnhanceScenario:\s*\(\{ gold\s*=\s*500/.test(ut),
        'cycle 605 seedEnhanceScenario gold default 0건');
});
