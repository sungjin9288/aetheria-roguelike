import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 478: BuildAdvicePanel `compact` prop cascade unreachable 정리
 *   (cycle 222-477 silent dead config 시리즈 231번째 — unreachable code path
 *   cascade cleanup, cycle 471-477 paired 8사이클).
 *
 * 발견 (1 prop + 19 ternary 가지 unreachable):
 * - src/components/BuildAdvicePanel.tsx:
 *     · interface line 10: compact?: boolean.
 *     · destructure line 52: ({ player, compact }).
 *     · 본체 19곳 ternary: padding / text size / spacing / 라벨 변형 / `!compact &&`
 *       conditional UI 등.
 * - 호출 사이트:
 *     · Dashboard.tsx:200 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → 모든 ternary false 가지 (full size) 선택.
 *
 * 수정 (src/components/BuildAdvicePanel.tsx):
 * - interface compact 제거.
 * - destructure compact 제거.
 * - 19 ternary 모두 false 가지로 inline.
 * - `compact && !open` 조건 제거 (false 가지 ChevronDown 항상 사용).
 * - `{!compact && <desc>}` 조건들 → 직접 <desc> 렌더.
 * - `compact ? trait.passiveLabel : trait.desc` → trait.desc 사용.
 * - `compact ? 'Build' : '빌드 조언 —'` → '빌드 조언 —' 사용.
 *
 * 회귀 가드:
 * - player prop 보존.
 * - 본체 trait / recommended / open 토글 / RELICS / TRAIT_DEFINITIONS 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 478: BuildAdvicePanel destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/BuildAdvicePanel.tsx');
    const fnIdx = source.indexOf('const BuildAdvicePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 478: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/BuildAdvicePanel.tsx');
    const ifaceIdx = source.indexOf('interface BuildAdvicePanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 478: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/BuildAdvicePanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 478: 정합성 가드 — Dashboard <BuildAdvicePanel> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<BuildAdvicePanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <BuildAdvicePanel> compact 전달 0건');
});

test('cycle 478: player / open 토글 / 추천 유물 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/BuildAdvicePanel.tsx');
    assert.ok(/getRecommendedRelics/.test(source), 'getRecommendedRelics 보존');
    assert.ok(/TRAIT_DEFINITIONS/.test(source), 'TRAIT_DEFINITIONS 보존');
    assert.ok(/setOpen/.test(source), 'open 토글 보존');
    const fnIdx = source.indexOf('const BuildAdvicePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
});
