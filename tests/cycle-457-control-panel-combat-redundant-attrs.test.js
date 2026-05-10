import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 457: ControlPanel <CombatPanel> callsite `compact={false}` / `dense={false}`
 *   명시 attribute redundant 정리
 *   (cycle 222-456 silent dead config 시리즈 213번째 — redundant explicit attribute
 *   cleanup lens, cycle 437 mobileFocused 패턴).
 *
 * 발견 (2 redundant explicit attributes):
 * - src/components/ControlPanel.tsx (line 165-175):
 *     <CombatPanel ... compact={false} dense={false} />
 * - 시그니처 (src/components/tabs/CombatPanel.tsx line 54):
 *     ({ ..., compact = false, dense = false }: CombatPanelProps) => ...
 * - 결과: 명시 전달값이 destructure 기본값과 동일 → 명시 attribute 0 효과.
 *
 * 호출 사이트 분석:
 * - CombatPanel은 ControlPanel.tsx:165 1곳에서만 import / render. 다른 caller 없음.
 * - 이 callsite가 항상 false / false 전달 → 본체의 compact/dense 활성 분기 0건.
 * - 본체 로직 자체는 유지 (향후 다른 caller가 true 전달 가능성 보존).
 *
 * 패턴 (cycle 222-456 시리즈 213번째):
 * - cycle 437: EventPanel default mobileFocused redundant.
 * - cycle 457: <CombatPanel> 명시 false 2건 — 동일 lens (callsite 측).
 *
 * 수정 (src/components/ControlPanel.tsx):
 * - <CombatPanel> JSX에서 compact={false} / dense={false} 두 줄 제거.
 *
 * 회귀 가드:
 * - mobile prop 보존 (truthy 전달).
 * - CombatPanel destructure 기본값 그대로 (다른 caller가 미래에 추가될 때 대비).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 457: <CombatPanel> 호출에서 compact={false} / dense={false} 0건', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<CombatPanel');
    assert.ok(idx >= 0, '<CombatPanel> 호출 존재');
    const jsxEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, jsxEnd);
    assert.ok(!/compact=\{false\}/.test(jsx), 'compact={false} 제거');
    assert.ok(!/dense=\{false\}/.test(jsx), 'dense={false} 제거');
});

test('cycle 457: 정합성 가드 — mobile prop 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const idx = source.indexOf('<CombatPanel');
    const jsxEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, jsxEnd);
    // shorthand `mobile` 또는 `mobile={true}` 형태 모두 허용
    assert.ok(/\bmobile\b/.test(jsx), 'mobile 보존');
    assert.ok(/player=\{player\}/.test(jsx), 'player prop 보존');
    assert.ok(/enemy=\{enemy\}/.test(jsx), 'enemy prop 보존');
});

test('cycle 457: CombatPanel destructure 기본값 보존 (다른 caller 대비)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/compact = false/.test(source), 'compact = false 본체 기본값 보존');
    assert.ok(/dense = false/.test(source), 'dense = false 본체 기본값 보존');
});
