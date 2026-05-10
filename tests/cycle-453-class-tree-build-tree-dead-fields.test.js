import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 453: ClassTree buildTree `nodes` / `edges` 출력 dead 정리
 *   (cycle 222-452 silent dead config 시리즈 210번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/442/443/445/446/447 패턴).
 *
 * 발견 (2 dead output fields):
 * - src/components/ClassTree.tsx buildTree (line 19+):
 *     `return { nodes, edges, tiers }`
 * - 호출 사이트 분석:
 *     · ClassTree.tsx:78: `const { tiers } = useMemo(() => buildTree(), [])`
 *     · `tiers`만 destructure, `nodes` / `edges` read 0건.
 * - 결과: nodes / edges는 buildTree 내부에서 build되지만 어디로도 흐르지 않는 dead.
 *   nodes는 tiers 그룹핑용 internal const로만 사용. edges는 push되지만 consumer 0건.
 *
 * 패턴 (cycle 222-452 시리즈 210번째):
 * - cycle 333-356/442/443/445/446/447: 함수 출력 dead 필드 cleanup.
 * - cycle 453: ClassTree buildTree 2 출력 dead — 동일 lens 회귀.
 *
 * 수정 (src/components/ClassTree.tsx):
 * - buildTree return에서 `nodes` / `edges` 제거 → `tiers`만 노출.
 * - nodes는 tiers 계산용 local const로 보존.
 * - edges는 push 자체 제거 (consumer 0건).
 *
 * 회귀 가드:
 * - tiers 보존 (활성 read 필드).
 * - 4 tier 그룹핑 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 453: buildTree return에서 nodes / edges 0건', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    const fnIdx = source.indexOf('const buildTree =');
    // buildTree 함수 끝 (TreeNode 시작 직전)까지 슬라이스.
    const fnEnd = source.indexOf('const TreeNode', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    const returnIdx = block.lastIndexOf('return ');
    const returnBlock = block.slice(returnIdx);
    assert.ok(!/\bnodes\b/.test(returnBlock), 'return에 nodes 0건');
    assert.ok(!/\bedges\b/.test(returnBlock), 'return에 edges 0건');
    assert.ok(/\btiers\b/.test(returnBlock), 'tiers 보존');
});

test('cycle 453: 정합성 가드 — buildTree() 호출자가 tiers만 destructure', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');
    assert.ok(/const \{ tiers \} = useMemo\(\(\) => buildTree\(\)/.test(source),
        'tiers만 destructure');
    // edges/nodes external read 0건 검증
    const fnEndIdx = source.indexOf('const TreeNode');
    const consumerSource = source.slice(fnEndIdx);
    assert.ok(!/\bedges\b/.test(consumerSource), '본체 edges 참조 0건');
});

test('cycle 453: tier 4 그룹 (T0/T1/T2/T3) 동작 보존', async () => {
    // ClassTree는 React 컴포넌트 — runtime 검증은 어려우니 source-level 가드
    const source = await readSrc('src/components/ClassTree.tsx');
    assert.ok(/tiers: Record<number, any\[\]> = \{ 0: \[\], 1: \[\], 2: \[\], 3: \[\] \}/.test(source),
        '4 tier 그룹 보존');
});

test('cycle 452 회귀 가드: Dashboard 6 panel default compact 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const fnIdx = source.indexOf('const EquipmentPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/compact = false/.test(block), 'cycle 452 EquipmentPanel default 제거 보존');
});
