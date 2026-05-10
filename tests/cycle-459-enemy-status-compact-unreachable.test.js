import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 459: StatusBar `EnemyStatus` `compact` prop unreachable 정리
 *   (cycle 222-458 silent dead config 시리즈 215번째 — unreachable code path
 *   cleanup lens, cycle 357-359/421/425/444/448/449/458 패턴).
 *
 * 발견 (1 prop + 6 ternary 가지 unreachable):
 * - src/components/StatusBar.tsx (line 50):
 *     const EnemyStatus = ({ enemy, mobile = false, compact = false }: any) => {...}
 * - 호출 사이트 분석 (전체 src/):
 *     · StatusBar.tsx:234 — 1 callsite: <EnemyStatus enemy={enemy} mobile />
 *     · 전체 다른 caller 0건 (internal const, export 0건).
 *     · compact 전달 caller 0건 → 항상 false.
 * - 결과:
 *     · destructure default 0 override.
 *     · 본체 6 ternary (`compact ? X : Y`) 모두 Y 선택 (line 58/62/66/67/72/75).
 *     · line 58은 chained `mobile ? A : compact ? B : C` — mobile=true(call shorthand)로
 *       항상 A 선택, compact 가지 진입 0건.
 *
 * 패턴 (cycle 222-458 시리즈 215번째):
 * - cycle 458: StatusMetric inline prop unreachable.
 * - cycle 459: EnemyStatus compact prop unreachable — 동일 lens, 같은 파일 paired.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - destructure에서 `compact = false` 제거.
 * - 본체 6 ternary `compact ? X : Y` → Y만 남김.
 * - line 58 chained `mobile ? A : compact ? B : C` → `mobile ? A : C`.
 *
 * 회귀 가드:
 * - mobile prop / 분기 그대로 (active read).
 * - 1 callsite 동작 변동 0 (mobile=true → first branch 그대로).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 459: EnemyStatus destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 459: EnemyStatus 본체 compact ternary 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/compact\s*\?/.test(block), 'compact ternary 0건');
    assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
});

test('cycle 459: 정합성 가드 — 1 callsite compact 전달 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const callMatches = source.match(/<EnemyStatus[^/]*\/>/g) || [];
    assert.equal(callMatches.length, 1, 'EnemyStatus 호출 1건');
    assert.ok(!/\bcompact\b/.test(callMatches[0]), 'callsite에 compact 전달 0건');
});

test('cycle 459: mobile prop cycle 492 cascade로 prop 자체 제거', async () => {
    // cycle 492가 EnemyStatus mobile prop cascade로 정리. 이전 가드 → cascade
    // 보존 가드로 약화.
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bmobile\b/.test(block), 'cycle 492 cascade로 mobile 제거 보존');
});
