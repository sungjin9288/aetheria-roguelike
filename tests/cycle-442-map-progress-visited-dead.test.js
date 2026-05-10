import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 442: getMapProgressState `visited` 출력 dead 정리
 *   (cycle 222-441 silent dead config 시리즈 200번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/435/438/439 패턴).
 *
 * 발견 (1 dead output field):
 * - src/utils/mapProgress.ts getMapProgressState (line 24+):
 *     `return { visited, state, isCurrent, progress }`
 * - 호출 사이트 (consumer) 분석:
 *     · MapNavigator.tsx — entry.state / entry.isCurrent / entry.progress만 read.
 *     · production .visited read 0건.
 *     · tests/map-progress.test.js만 visited 어설션 (cycle 442에서 갱신).
 * - 내부 사용:
 *     `visited`는 함수 내부에서 `state` 결정용으로 사용 (line 33+).
 *     출력 필드로의 노출은 dead.
 *
 * 패턴 (cycle 222-441 시리즈 200번째 — 마일스톤 200):
 * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
 * - cycle 435: makeBattleRecord ts 출력 dead.
 * - cycle 438: codex obtainedAt 출력 dead.
 * - cycle 439: history record timestamp 출력 dead.
 * - cycle 442: getMapProgressState visited 출력 dead — 동일 lens 회귀.
 *
 * 수정 (src/utils/mapProgress.ts):
 * - return에서 `visited` 필드 제거 (state/isCurrent/progress만 노출).
 * - 내부 const `visited`는 state 계산용으로 보존.
 * - tests/map-progress.test.js stale assertion 갱신.
 *
 * 회귀 가드:
 * - state / isCurrent / progress (활성 read 필드) 그대로.
 * - state 계산 로직 동일 (visited는 내부 const로 유지).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 442: getMapProgressState return에서 visited 필드 0건', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    const fnIdx = source.indexOf('export const getMapProgressState');
    const returnIdx = source.indexOf('return {', fnIdx);
    const returnEnd = source.indexOf('};', returnIdx);
    const returnBlock = source.slice(returnIdx, returnEnd);
    assert.ok(!/^\s+visited,?\s*$/m.test(returnBlock),
        'return block에 visited 필드 0건');
});

test('cycle 442: 내부 const visited 보존 (state 계산용)', async () => {
    const source = await readSrc('src/utils/mapProgress.ts');
    assert.ok(/const visited = visitedSet\.has/.test(source),
        '내부 const visited 보존');
    assert.ok(/state = visited \?/.test(source),
        'state 계산에서 visited 사용 보존');
});

test('cycle 442: 활성 출력 필드 (state / isCurrent / progress) 보존', async () => {
    const { getMapProgressState } = await import('../src/utils/mapProgress.ts');
    const result = getMapProgressState('시작의 마을',
        { loc: '시작의 마을', stats: { visitedMaps: ['시작의 마을'] } },
        { '시작의 마을': { monsters: [] } }
    );
    assert.equal(typeof result.state, 'string', 'state string 노출');
    assert.equal(typeof result.isCurrent, 'boolean', 'isCurrent boolean 노출');
    assert.equal(typeof result.progress, 'object', 'progress object 노출');
    assert.equal(result.visited, undefined, 'visited 필드 제거');
});

test('cycle 442: 정합성 가드 — production .visited read 0건', async () => {
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
        // entry.visited / state.visited / progress.visited 패턴
        if (/(entry|state|result)\.visited\b/.test(content)) {
            reads += 1;
        }
    }
    assert.equal(reads, 0, 'production .visited read 0건');
});

test('cycle 441 회귀 가드: FocusPanelHeader default backLabel 0건', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const destructIdx = source.indexOf('const FocusPanelHeader');
    const destructEnd = source.indexOf('}: any) => (', destructIdx);
    const block = source.slice(destructIdx, destructEnd);
    assert.ok(!/backLabel = '뒤로'/.test(block), 'cycle 441 default 제거 보존');
});
