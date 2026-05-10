import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 439: handleEventChoice history record timestamp 출력 dead 정리
 *   (cycle 222-438 silent dead config 시리즈 198번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/435/438 timestamp 시리즈 패턴).
 *
 * 발견 (1 dead output field):
 * - src/hooks/gameActions/eventActions.ts:139 (handleEventChoice 본체):
 *     `{ timestamp: Date.now(), event: currentEvent.desc,
 *        choice: currentEvent.choices?.[idx], outcome: resultText }`
 * - 호출 사이트 (history 기록 consumer) 분석:
 *     · aiEventUtils.ts summarizeHistory / getRecentEventSet:
 *       `entry.event / entry.choice / entry.outcome` 만 read.
 *     · history.timestamp / entry.timestamp read 0건 (전체 src/).
 *   → timestamp 필드 어디로도 흐르지 않는 dead output.
 *
 * 패턴 (cycle 222-438 시리즈 198번째 — timestamp dead 시리즈):
 * - cycle 435: makeBattleRecord ts: Date.now() 출력 dead.
 * - cycle 438: codex 엔트리 obtainedAt: Date.now() 출력 dead (4 producer batch).
 * - cycle 439: handleEventChoice history timestamp: Date.now() — 동일 lens 회귀.
 *
 * 수정 (src/hooks/gameActions/eventActions.ts):
 * - history record entry에서 `timestamp: Date.now()` 라인 제거.
 *
 * 회귀 가드:
 * - event / choice / outcome 필드 보존 (active read fields).
 * - history slice(-50) 윈도우 그대로.
 * - aiEventUtils의 summarizeHistory / getRecentEventSet 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 439: handleEventChoice 본체에서 timestamp 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    const fnIdx = source.indexOf('handleEventChoice');
    const fnEnd = source.indexOf('return updatedPlayer;', fnIdx);
    const block = source.slice(fnIdx, fnEnd > fnIdx ? fnEnd : source.length);
    assert.ok(!/timestamp:/.test(block), 'history record timestamp 0건');
});

test('cycle 439: 활성 필드 (event / choice / outcome) 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    const newHistoryIdx = source.indexOf('newHistory');
    const sliceEnd = source.indexOf('.slice(-50)', newHistoryIdx);
    const block = source.slice(newHistoryIdx, sliceEnd);
    assert.ok(/event: currentEvent\.desc/.test(block), 'event 필드 보존');
    assert.ok(/choice: currentEvent\.choices/.test(block), 'choice 필드 보존');
    assert.ok(/outcome: resultText/.test(block), 'outcome 필드 보존');
});

test('cycle 439: 정합성 가드 — history.timestamp / entry.timestamp read 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    let reads = 0;
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        // history entry timestamp 패턴 read (graveUtils의 grave.timestamp는 별개)
        if (/entry\.timestamp\b|history\[\d+\]\.timestamp\b|h\.timestamp\b/.test(content)) {
            reads += 1;
        }
    }
    assert.equal(reads, 0, 'history entry timestamp read 0건');
});

test('cycle 438 회귀 가드: codex 엔트리 obtainedAt 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/obtainedAt/.test(source), 'cycle 438 obtainedAt 0건 보존');
});
