import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 603: summarizeHistory + getRecentEventSet 2 history defaults batch
 *   unreachable (cycle 222-602 silent dead config 시리즈 339번째 — redundant
 *   default annotation 청소 메가 시리즈 추가). aiEventUtils.ts paired cleanup.
 *
 * 발견 (2 history defaults batch):
 * - src/utils/aiEventUtils.ts:
 *     · line 30: summarizeHistory (history: any[] = [], limit = RECENT_HISTORY_LIMIT)
 *     · line 42: getRecentEventSet (history: any[] = [], limit = RECENT_EVENT_LIMIT)
 * - 호출 사이트:
 *     · summarizeHistory: aiService:80/120 + ai-event-utils.test (3 callers).
 *     · getRecentEventSet: aiService:81 + aiEventUtils:545 (2 callers).
 *     · 모두 history 명시 전달.
 * - 결과: history 항상 명시 전달. 두 default `[]` 모두 도달 불가. body의
 *   Array.isArray(history) guard가 undefined/null 안전 처리.
 *
 * Note: limit defaults (RECENT_HISTORY_LIMIT, RECENT_EVENT_LIMIT)는 모든 caller
 *   에서 미전달이라 reachable 보존. partial cleanup pattern (cycle 542 재적용
 *   8번째).
 *
 * 패턴 (cycle 222-602 시리즈 339번째):
 * - cycle 502-602: default 청소 메가 시리즈 101사이클.
 * - cycle 603: aiEventUtils.ts paired cleanup (cycle 522/525/527/561 동일
 *   모듈에 이은 5번째 cleanup).
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - summarizeHistory history default [] 제거.
 * - getRecentEventSet history default [] 제거.
 * - limit defaults 모두 보존 (reachable).
 * - body의 Array.isArray guard 보존.
 *
 * 회귀 가드:
 * - 5 callsite 동작 그대로.
 * - body Array.isArray ternary 보존 (undefined 안전).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 603: summarizeHistory signature에서 history default 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const summarizeHistory');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'summarizeHistory history default [] 제거');
});

test('cycle 603: getRecentEventSet signature에서 history default 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const getRecentEventSet');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'getRecentEventSet history default [] 제거');
});

test('cycle 603: limit defaults 보존 (reachable, partial cleanup)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const sumIdx = source.indexOf('export const summarizeHistory');
    const sumEnd = source.indexOf('=>', sumIdx);
    const sumSig = source.slice(sumIdx, sumEnd);
    assert.ok(/limit\s*=\s*RECENT_HISTORY_LIMIT/.test(sumSig),
        'summarizeHistory limit default RECENT_HISTORY_LIMIT 보존');

    const setIdx = source.indexOf('export const getRecentEventSet');
    const setEnd = source.indexOf('=>', setIdx);
    const setSig = source.slice(setIdx, setEnd);
    assert.ok(/limit\s*=\s*RECENT_EVENT_LIMIT/.test(setSig),
        'getRecentEventSet limit default RECENT_EVENT_LIMIT 보존');
});

test('cycle 603: body Array.isArray guard 보존 (undefined 안전)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(/Array\.isArray\(history\)/.test(source),
        'Array.isArray(history) guard 보존');
});

test('cycle 603: cycle 502-602 회귀 가드 — default 청소 시리즈 보존', async () => {
    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitLootHint = \(items: any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 602 getTraitLootHint items default 0건');

    const su = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/performSynthesis = \(items: any, selectedOutput:\s*any\s*=\s*null/.test(su),
        'cycle 601 performSynthesis selectedOutput default 0건');
});
