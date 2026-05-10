import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 454: Codex legendaryCount.pct 출력 dead 정리
 *   (cycle 222-453 silent dead config 시리즈 211번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/442/443/445/446/447/453 패턴).
 *
 * 발견 (1 dead output field):
 * - src/components/Codex.tsx legendaryCount (line 78+):
 *     `return { total, discovered, pct }`
 * - 호출 사이트 분석:
 *     · Codex.tsx:166: `{legendaryCount.discovered}/{legendaryCount.total}` 만 read.
 *     · `legendaryCount.pct` read 0건 (전체 src/).
 * - 결과: pct 필드는 useMemo가 계산하지만 어디로도 흐르지 않는 dead.
 *
 * 패턴 (cycle 222-453 시리즈 211번째):
 * - cycle 333-356/442/443/445/446/447/453: 함수 출력 dead 필드 cleanup.
 * - cycle 454: legendaryCount.pct — 동일 lens 회귀.
 *
 * 수정 (src/components/Codex.tsx):
 * - legendaryCount return에서 `pct` 필드 제거 → `{ total, discovered }`.
 * - 100% 계산 식 제거.
 *
 * 회귀 가드:
 * - total / discovered (활성 read 필드) 보존.
 * - signature 도감 진척 표시 (discovered/total) 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 454: legendaryCount return에서 pct 0건', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const memoIdx = source.indexOf('const legendaryCount = useMemo');
    const memoEnd = source.indexOf('}, [codex]);', memoIdx);
    const block = source.slice(memoIdx, memoEnd);
    assert.ok(!/\bpct\b/.test(block), 'legendaryCount 본체에 pct 0건');
});

test('cycle 454: 활성 필드 (total / discovered) 보존', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const memoIdx = source.indexOf('const legendaryCount = useMemo');
    const memoEnd = source.indexOf('}, [codex]);', memoIdx);
    const block = source.slice(memoIdx, memoEnd);
    assert.ok(/\btotal\b/.test(block), 'total 보존');
    assert.ok(/\bdiscovered\b/.test(block), 'discovered 보존');
    assert.ok(/return \{[^}]*total[^}]*\}/.test(block), 'return에 total/discovered');
});

test('cycle 454: 정합성 가드 — legendaryCount.pct read 0건', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.ok(!/legendaryCount\.pct/.test(source), 'legendaryCount.pct read 0건');
});

test('cycle 453 회귀 가드: ClassTree buildTree nodes/edges 0건', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    const fnIdx = source.indexOf('const buildTree =');
    const fnEnd = source.indexOf('const TreeNode', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    const returnIdx = block.lastIndexOf('return ');
    const returnBlock = block.slice(returnIdx);
    assert.ok(!/\bnodes\b/.test(returnBlock), 'cycle 453 nodes 출력 0건 보존');
    assert.ok(!/\bedges\b/.test(returnBlock), 'cycle 453 edges 출력 0건 보존');
});
