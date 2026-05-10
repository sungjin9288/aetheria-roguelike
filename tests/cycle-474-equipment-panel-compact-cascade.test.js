import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 474: EquipmentPanel `compact` prop cascade unreachable 정리
 *   (cycle 222-473 silent dead config 시리즈 227번째 — unreachable code path
 *   cascade cleanup, cycle 471/472/473 paired 4사이클).
 *
 * 발견 (1 prop + 5 ternary 가지 unreachable):
 * - src/components/EquipmentPanel.tsx:
 *     · interface line 19: compact?: boolean.
 *     · destructure line 39: ({ player, stats, actions, compact }).
 *     · line 89/90: className compact ternary 2건.
 *     · line 95: PixelCharacterAvatar size={compact ? 'md' : 'lg'}.
 *     · line 342/343: padding compact ternary 2건.
 * - 호출 사이트:
 *     · Dashboard.tsx:166 — cycle 471이 compact prop 제거. caller 0건.
 *     · 다른 파일 import 0건.
 * - 결과: compact 항상 undefined → 5 ternary 모두 false 가지 선택.
 *
 * 패턴 (cycle 222-473 시리즈 227번째):
 * - cycle 471: Dashboard 10 callsite compact 일괄 제거.
 * - cycle 472: MapNavigator cascade.
 * - cycle 473: AchievementPanel cascade.
 * - cycle 474: EquipmentPanel cascade — 4사이클 paired.
 *
 * 수정 (src/components/EquipmentPanel.tsx):
 * - interface에서 compact?: boolean 제거.
 * - destructure에서 compact 제거.
 * - 5 ternary 모두 false 가지로 inline.
 *   · `space-y-3`
 *   · `border border-white/8 bg-black/18 p-3`
 *   · PixelCharacterAvatar size 'lg'
 *   · `px-3 py-3` (slot padding 2건)
 *
 * 회귀 가드:
 * - player / stats / actions prop 보존.
 * - 본체 레이아웃 / SLOT_CONFIG / SIG_SET_TONE 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 474: EquipmentPanel destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const fnIdx = source.indexOf('const EquipmentPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 474: interface에서 compact 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const ifaceIdx = source.indexOf('interface EquipmentPanelProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    const block = source.slice(ifaceIdx, ifaceEnd);
    assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
});

test('cycle 474: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    assert.ok(!/\bcompact\b/.test(source), '본체 compact 참조 0건');
});

test('cycle 474: 정합성 가드 — Dashboard <EquipmentPanel> compact 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<EquipmentPanel');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <EquipmentPanel> compact 전달 0건');
});

test('cycle 474: player / stats / actions / SLOT_CONFIG / SIG_SET_TONE 보존', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    assert.ok(/SLOT_CONFIG/.test(source), 'SLOT_CONFIG 보존');
    assert.ok(/SIG_SET_TONE/.test(source), 'SIG_SET_TONE 보존');
    const fnIdx = source.indexOf('const EquipmentPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
    assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
});
