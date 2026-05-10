import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 456: ControlPanel `renderResetControl` 3 default annotation redundant 정리
 *   (cycle 222-455 silent dead config 시리즈 212번째 — redundant default annotation
 *   cleanup lens, cycle 364-368/371-372/428-434/437/441/451/452 패턴).
 *
 * 발견 (3 redundant defaults):
 * - src/components/ControlPanel.tsx (line 118):
 *     const renderResetControl = ({
 *         compact = false,
 *         className = '',
 *         confirmGridClass = ''
 *     }: any = {}) => {...}
 * - 호출 사이트 분석 (전체 ControlPanel.tsx 내부 2건):
 *     · line 331-335: { compact: true, className: '', confirmGridClass: '...' }
 *     · line 338-342: { compact: true, className: '', confirmGridClass: '...' }
 * - 결과: 두 callsite 모두 3 prop을 명시적으로 전달. 기본값 fallback path 0건.
 *
 * 패턴 (cycle 222-455 시리즈 212번째):
 * - cycle 364-368/371-372/428-434/437/441/451/452: 콜러가 항상 명시 전달하는
 *   기본값 annotation 정리.
 * - cycle 456: renderResetControl 3 default — 동일 lens.
 *
 * 수정 (src/components/ControlPanel.tsx):
 * - destructure에서 = false / = '' / = '' 기본값 3개 제거.
 * - `: any = {}` 외부 fallback도 호출 사이트에서 항상 객체를 전달하므로 제거 가능.
 *
 * 회귀 가드:
 * - 함수 본체 동작 그대로.
 * - 두 callsite 명시 전달 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 456: renderResetControl destructure 기본값 3개 제거', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const fnIdx = source.indexOf('const renderResetControl =');
    assert.ok(fnIdx >= 0, 'renderResetControl 선언 존재');
    // 다음 ` => {` 까지 잘라 destructure 시그니처만 검사
    const sigEnd = source.indexOf('=> {', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    assert.ok(!/compact\s*=\s*false/.test(sig), 'compact = false 기본값 0건');
    assert.ok(!/className\s*=\s*''/.test(sig), "className = '' 기본값 0건");
    assert.ok(!/confirmGridClass\s*=\s*''/.test(sig), "confirmGridClass = '' 기본값 0건");
});

test('cycle 456: 정합성 가드 — 두 callsite 모두 3 prop 명시 전달 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    // renderResetControl 호출은 항상 { compact: true, className: ..., confirmGridClass: ... }
    const callMatches = source.match(/renderResetControl\(\{/g) || [];
    assert.equal(callMatches.length, 2, 'renderResetControl 호출은 2건');
    // 각 호출이 3 prop을 모두 포함하는지
    const compactPasses = source.match(/renderResetControl\(\{[\s\S]*?compact:[\s\S]*?className:[\s\S]*?confirmGridClass:/g) || [];
    assert.equal(compactPasses.length, 2, '두 호출 모두 3 prop 명시 전달');
});

test('cycle 456: renderResetControl 함수 본체 보존 (호출 동작 가드)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/const renderResetControl =/.test(source), 'renderResetControl 선언 보존');
});
