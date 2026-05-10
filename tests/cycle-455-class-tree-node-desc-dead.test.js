import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 455: ClassTree buildTree `node.desc` 출력 dead 정리
 *   (cycle 222-454 silent dead config 시리즈 211번째 — function output dead field
 *   cleanup lens, cycle 333-356/442/443/445/446/447/453 패턴).
 *
 * 발견 (1 dead output field):
 * - src/components/ClassTree.tsx buildTree (line 27):
 *     `nodes[name] = { name, tier: data.tier || 0, reqLv: data.reqLv || 1, desc: data.desc };`
 * - 소비자 분석 (TreeNode + ClassTree 본체):
 *     · TreeNode 내부 read: node.tier, node.name, node.reqLv 만 (line 40-71)
 *     · ClassTree 본체: tiers[tier].map((node) => <TreeNode node={...} />) — node 그대로 전달
 *     · 어디에서도 node.desc / data.desc 읽는 곳 0건.
 * - 결과: data.desc → node.desc로 복사되지만 read 0건 dead 출력 필드.
 *
 * 패턴 (cycle 222-454 시리즈 211번째):
 * - cycle 333-356/442/443/445/446/447/453: 함수 출력 dead 필드 cleanup.
 * - cycle 453은 동일 buildTree에서 nodes/edges 출력 dead 정리. 그때 nodes 내부의
 *   `desc` 필드 자체가 read 0건인 건 미검출 — 이번 사이클이 paired completion.
 *
 * 수정 (src/components/ClassTree.tsx):
 * - buildTree에서 nodes[name] = { name, tier, reqLv } — desc 필드 제거.
 *
 * 회귀 가드:
 * - name / tier / reqLv 보존 (활성 read 필드 3종).
 * - TreeNode 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 455: buildTree node 객체에 desc 필드 0건', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    const fnIdx = source.indexOf('const buildTree =');
    const fnEnd = source.indexOf('const TreeNode', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/desc:\s*data\.desc/.test(block), 'buildTree nodes 객체에 desc 필드 0건');
    assert.ok(!/\bdesc\b/.test(block), 'buildTree 블록 전체에 desc 0건');
});

test('cycle 455: 정합성 가드 — node.desc / data.desc read 0건 (전체 ClassTree)', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    // node.desc 또는 data.desc 참조 0건
    assert.ok(!/node\.desc/.test(source), 'node.desc read 0건');
    assert.ok(!/data\.desc/.test(source), 'data.desc read 0건');
});

test('cycle 455: name / tier / reqLv 활성 read 보존', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    assert.ok(/node\.name/.test(source), 'node.name read 보존');
    assert.ok(/node\.tier/.test(source), 'node.tier read 보존');
    assert.ok(/node\.reqLv/.test(source), 'node.reqLv read 보존');
});

test('cycle 453 회귀 가드: buildTree return은 tiers만 노출', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    const fnIdx = source.indexOf('const buildTree =');
    const fnEnd = source.indexOf('const TreeNode', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    const returnBlock = block.slice(block.lastIndexOf('return '));
    assert.ok(!/\bnodes\b/.test(returnBlock), 'cycle 453 nodes 제거 보존');
    assert.ok(!/\bedges\b/.test(returnBlock), 'cycle 453 edges 제거 보존');
    assert.ok(/\btiers\b/.test(returnBlock), 'tiers 보존');
});
