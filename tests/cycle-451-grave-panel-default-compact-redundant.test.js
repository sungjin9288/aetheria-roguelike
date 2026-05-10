import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 451: GravePanel default `compact = false` redundant 정리
 *   (cycle 222-450 silent dead config 시리즈 208번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-434/437/441 패턴).
 *
 * 발견 (1 redundant default value):
 * - src/components/GravePanel.tsx:
 *     `({ player, actions, compact = false }: GravePanelProps) => { ... }`
 * - 호출 사이트 분석 (1곳, compact 명시 전달):
 *     Dashboard.tsx:233: `<GravePanel player={player} actions={actions}
 *                         compact={desktopArchiveCompact} />`
 *   → 호출자 명시 → default false 도달 불가.
 *
 * 패턴 (cycle 222-450 시리즈 208번째):
 * - cycle 364-368/428-434/437/441: redundant default annotation 시리즈.
 * - cycle 451: GravePanel default compact — 동일 lens 회귀 (Dashboard 7 panel
 *   children 중 첫 cleanup, 후속 6 panel batch 가능).
 *
 * 수정 (src/components/GravePanel.tsx):
 * - destructure에서 `compact = false` → `compact`.
 *
 * 회귀 가드:
 * - 1 호출자 명시 compact 전달 → 동작 그대로.
 * - compact 기반 UI 조건 분기 (text size / spacing 등) 모두 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 451: GravePanel destructure에서 default compact 제거 (cycle 476 cascade 보존)', async () => {
    // cycle 476이 GravePanel compact prop 자체를 cascade로 제거. compact
    // 파라미터 보존 → cascade 제거 보존 가드로 업데이트.
    const source = await readSrc('src/components/GravePanel.tsx');
    const fnIdx = source.indexOf('const GravePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/compact = false/.test(block), 'default compact 제거됨');
    assert.ok(!/\bcompact\b/.test(block), 'cycle 476 cascade로 compact prop 자체 제거됨');
});

test('cycle 451: 호출 사이트 정합성 가드 (Dashboard GravePanel 호출 존재)', async () => {
    // cycle 471이 Dashboard의 desktop 컴팩트 플래그 + 10 callsite의 compact prop
    // 전달을 일괄 제거. compact 명시 전달 assertion → 호출 존재 가드로 약화.
    const source = await readSrc('src/components/Dashboard.tsx');
    const callMatch = source.match(/<GravePanel[^/]*\/>/);
    assert.ok(callMatch, 'GravePanel 호출 발견');
});

test('cycle 449 회귀 가드: PHYSICAL_ELEMENTS 0건', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(!/PHYSICAL_ELEMENTS/.test(source),
        'cycle 449 PHYSICAL_ELEMENTS 0건 보존');
});
