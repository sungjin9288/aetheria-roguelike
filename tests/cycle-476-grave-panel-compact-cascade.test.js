import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 476: GravePanel `compact` prop cascade unreachable 정리
 *   (cycle 222-475 silent dead config 시리즈 229번째 — unreachable code path
 *   cascade cleanup, cycle 471-475 paired 6사이클).
 *
 * 발견 (1 prop + 20 ternary 가지 unreachable):
 * - src/components/GravePanel.tsx:
 *     · interface line 15: compact?: boolean.
 *     · destructure line 20: ({ player, actions, compact }).
 *     · 본체 20곳 ternary: text size / icon size / spacing 등.
 * - 호출 사이트:
 *     · Dashboard.tsx:230 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → 모든 ternary false 가지 선택 (full size 그대로).
 *
 * 수정 (src/components/GravePanel.tsx):
 * - interface compact 제거.
 * - destructure compact 제거.
 * - 20 ternary 모두 false 가지로 inline.
 *
 * 회귀 가드:
 * - player / actions prop 보존.
 * - 본체 grave fetch / invade 로직 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 476: GravePanel destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    const fnIdx = source.indexOf('const GravePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 476: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    const ifaceIdx = source.indexOf('interface GravePanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 476: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
});

test('cycle 476: 정합성 가드 — Dashboard <GravePanel> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<GravePanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <GravePanel> compact 전달 0건');
});

test('cycle 476: player / actions / fetchGraves / invade 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(/fetchGraves/.test(source), 'fetchGraves 보존');
    assert.ok(/DAILY_INVADE_LIMIT/.test(source), 'DAILY_INVADE_LIMIT 로직 보존');
    const fnIdx = source.indexOf('const GravePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
});
