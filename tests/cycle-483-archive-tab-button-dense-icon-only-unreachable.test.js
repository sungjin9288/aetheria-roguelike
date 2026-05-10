import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 483: ArchiveTabButton `dense` + `iconOnly` props unreachable 정리
 *   (cycle 222-482 silent dead config 시리즈 235번째 — unreachable code path
 *   cleanup lens, cycle 458/459/461/463/464 unreachable prop 패턴 회귀).
 *
 * 발견 (2 props + 다수 ternary 가지 unreachable):
 * - src/components/ArchiveTabButton.tsx (line 6):
 *     const ArchiveTabButton = ({ icon, label, active = false, onClick,
 *         compact = false, rail = false, dense = false, iconOnly = false, ... })
 *     → frameClass / heightClass / className / Icon size / span / iconOnly 분기
 * - 호출 사이트 분석 (전체 src/):
 *     · Dashboard.tsx:245 — compact rail testId / {...getTabExtras}.
 *     · Dashboard.tsx:394 — compact rail testId / {...getTabExtras}.
 *     · Dashboard.tsx:571 — compact testId / {...getTabExtras}.
 *     · Dashboard.tsx:585 — compact testId / {...getTabExtras}.
 *     · 4 callsite 모두 dense / iconOnly 전달 0건. getTabExtras도 badge/badgeTitle만 emit.
 * - 결과: dense / iconOnly 항상 false → frameClass의 dense 분기 + iconOnly 중첩
 *   분기 + Icon size dense 가지 + span tracking dense 가지 + iconOnly span 모두
 *   unreachable.
 *
 * 패턴 (cycle 222-482 시리즈 235번째):
 * - cycle 458: StatusMetric inline prop unreachable.
 * - cycle 459/461/463/464/465/466: 다양한 unreachable prop cleanup.
 * - cycle 483: ArchiveTabButton 2 unreachable props 한꺼번에 정리.
 *
 * 수정 (src/components/ArchiveTabButton.tsx):
 * - destructure에서 dense = false, iconOnly = false 제거.
 * - frameClass: rail ? A : dense ? (iconOnly ? B : C) : D → rail ? A : D.
 * - heightClass: rail || dense → rail. (dense=false라 rail || dense ≡ rail)
 * - className에서 dense ? 'px-1 py-1' : 'px-2 py-1.5' → 'px-2 py-1.5'.
 * - Icon size: rail ? 11 : dense ? (iconOnly ? 11 : 12) : 14 → rail ? 11 : 14.
 * - {iconOnly ? <sr-only> : <span>} → 직접 <span>.
 * - span tracking: rail ? A : dense ? B : C → rail ? A : C.
 *
 * 회귀 가드:
 * - icon / label / active / onClick / compact / rail / testId / badge /
 *   badgeTitle props 보존.
 * - 4 callsite 동작 변동 0 (dense/iconOnly 전달 0건이라 결과 동일).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 483: ArchiveTabButton destructure에서 dense / iconOnly 0건', async () => {
    const source = await readSrc('src/components/ArchiveTabButton.tsx');
    const fnIdx = source.indexOf('const ArchiveTabButton =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
    assert.ok(!/\biconOnly\b/.test(sig), 'destructure에 iconOnly 0건');
});

test('cycle 483: 본체 dense / iconOnly 참조 0건', async () => {
    const source = await readSrc('src/components/ArchiveTabButton.tsx');
    assert.ok(!/\bdense\b/.test(source), 'dense 참조 0건');
    assert.ok(!/\biconOnly\b/.test(source), 'iconOnly 참조 0건');
});

test('cycle 483: 정합성 가드 — 4 callsite dense / iconOnly 전달 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    // 모든 <ArchiveTabButton...> 호출에서 dense / iconOnly 0건
    const matches = source.match(/<ArchiveTabButton[\s\S]*?\/>/g) || [];
    assert.ok(matches.length >= 4, 'ArchiveTabButton 호출 4건 이상');
    matches.forEach((m, i) => {
        assert.ok(!/\bdense\b/.test(m), `callsite ${i}에 dense 전달 0건`);
        assert.ok(!/\biconOnly\b/.test(m), `callsite ${i}에 iconOnly 전달 0건`);
    });
});

test('cycle 483: icon / label / active / onClick / compact / rail / testId / badge prop 보존', async () => {
    const source = await readSrc('src/components/ArchiveTabButton.tsx');
    const fnIdx = source.indexOf('const ArchiveTabButton =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bicon\b/.test(sig), 'icon 보존');
    assert.ok(/\blabel\b/.test(sig), 'label 보존');
    assert.ok(/active/.test(sig), 'active 보존');
    assert.ok(/onClick/.test(sig), 'onClick 보존');
    assert.ok(/compact/.test(sig), 'compact 보존');
    assert.ok(/rail/.test(sig), 'rail 보존');
    assert.ok(/testId/.test(sig), 'testId 보존');
    assert.ok(/\bbadge\b/.test(sig), 'badge 보존');
});
