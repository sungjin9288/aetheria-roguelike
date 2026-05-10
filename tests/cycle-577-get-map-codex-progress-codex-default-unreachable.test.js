import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 577: getMapCodexProgress `codex = {}` default unreachable
 *   (cycle 222-576 silent dead config 시리즈 316번째 — redundant default annotation
 *   청소 메가 시리즈 69번째). utils/ 추가 cleanup.
 *
 * 발견 (1 default unreachable):
 * - src/utils/mapProgress.ts (line 11):
 *     export const getMapCodexProgress = (mapName: any, maps: any,
 *         codex: any = {}) => {
 *         const discoveredSet = new Set(Object.keys(codex?.monsters || {}));
 *         ...
 *     };
 * - 호출 사이트:
 *     · mapProgress.ts:28 — getMapCodexProgress(mapName, maps, codex) 명시.
 *     · tests/map-progress.test.js:22 — getMapCodexProgress('숲', MAPS, {...})
 *       명시.
 *     · 다른 caller 0건.
 * - 결과: codex 항상 명시 전달. default {} 도달 불가. body의 codex?.monsters
 *   || {} defensive guard 보존.
 *
 * 패턴 (cycle 222-576 시리즈 316번째):
 * - cycle 502-576: default 청소 메가 시리즈 75사이클.
 * - cycle 577: utils/mapProgress.ts cleanup.
 *
 * 수정 (src/utils/mapProgress.ts):
 * - signature에서 codex: any = {} → codex: any.
 * - body의 codex?.monsters || {} defensive guard 보존.
 *
 * 회귀 가드:
 * - 1 internal + 1 test callsite 동작 그대로.
 * - body roster filter / Math.max 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 577: getMapCodexProgress signature에서 codex default 0건', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    const fnIdx = source.indexOf('export const getMapCodexProgress');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/codex:\s*any\s*=\s*\{\}/.test(sig),
        'getMapCodexProgress codex default {} 제거');
});

test('cycle 577: 정합성 가드 — internal + test callsite 보존', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(/getMapCodexProgress\(mapName,\s*maps,\s*codex\)/.test(source),
        'internal callsite 보존');

    const test1 = await readSrc('tests/map-progress.test.js');
    assert.ok(/getMapCodexProgress\('숲',\s*MAPS,/.test(test1),
        'test callsite 보존');
});

test('cycle 577: body codex?.monsters defensive guard 보존', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(/codex\?\.monsters \|\| \{\}/.test(source),
        'codex?.monsters || {} defensive guard 보존');
});

test('cycle 577: cycle 502-576 회귀 가드 — default 청소 시리즈 보존', async () => {
    const tv = await readSrc('src/components/TerminalView.tsx');
    assert.ok(!/const TerminalView = \(\{\s*\n\s*logs\s*=\s*\[\]/.test(tv),
        'cycle 576 TerminalView logs default 0건');

    const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(!/const CombatPanel = \({[^}]+enemy\s*=\s*null/.test(cp),
        'cycle 575 CombatPanel enemy default 0건');
});
