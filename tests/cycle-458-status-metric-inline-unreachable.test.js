import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 458: StatusBar `StatusMetric` `inline` prop + `if (inline)` 분기 unreachable 정리
 *   (cycle 222-457 silent dead config 시리즈 214번째 — unreachable code path
 *   cleanup lens, cycle 357-359/361-363/421/425/444/448/449 패턴).
 *
 * 발견 (1 prop + 1 분기 unreachable):
 * - src/components/StatusBar.tsx (line 25):
 *     const StatusMetric = ({ ..., inline = false }: any) => {
 *         ...
 *         if (inline) { return <inline-render>; }   // line 31-46
 *         return <default-render>;                   // line 48+
 *     }
 * - 호출 사이트 분석 (전체 src/ tsx):
 *     · StatusBar.tsx:243-245 — 3 callsite 모두 `compact` 만 전달, `inline` 0건.
 *     · 다른 파일 import 0건 (StatusMetric은 internal const).
 * - 결과: inline은 항상 false → if (inline) 본체 unreachable. 16줄 dead.
 *
 * 패턴 (cycle 222-457 시리즈 214번째):
 * - cycle 357-359/361-363/421/425/444/448/449: 내부 분기 / lookup이 production
 *   진입 0건이라 unreachable.
 * - cycle 458: StatusMetric inline 분기 — caller 0건 → 분기 자체 unreachable.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - destructure에서 `inline = false` 제거.
 * - if (inline) { ... } 블록 (line 31-46) 제거.
 * - default render만 남김.
 *
 * 회귀 가드:
 * - compact / dense / variant 본체 분기 그대로.
 * - 3 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 458: StatusMetric destructure에서 inline 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\binline\b/.test(sig), 'destructure에 inline 0건');
});

test('cycle 458: if (inline) 분기 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/if\s*\(\s*inline\s*\)/.test(block), 'if (inline) 분기 제거');
});

test('cycle 458: 정합성 가드 — 3 callsite inline 전달 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const callMatches = source.match(/<StatusMetric[^/]*\/>/g) || [];
    assert.equal(callMatches.length, 3, 'StatusMetric 호출 3건');
    callMatches.forEach((call, i) => {
        assert.ok(!/\binline\b/.test(call), `callsite ${i}에 inline 전달 0건`);
    });
});

test('cycle 458: variant 매핑 보존 (cycle 491이 compact/dense ternary cascade 정리)', async () => {
    // cycle 491이 StatusMetric의 compact / dense props cascade로 ternary 자체 제거.
    // 이전 ternary 보존 가드 → variant 매핑만 보존 가드로 약화.
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/METER_THEME\[variant\]/.test(source), 'variant 매핑 보존');
});
