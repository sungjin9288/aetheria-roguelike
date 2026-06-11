import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 428: QuestBoardPanel RewardChips default `accent = 'blue'` redundant 정리
 *   (cycle 222-427 silent dead config 시리즈 188번째 — redundant default annotation
 *   lens 회귀, cycle 364-368 패턴).
 *
 * 발견 (1 redundant default value):
 * - src/components/tabs/QuestBoardPanel.tsx RewardChips:
 *     `({ reward, accent = 'blue' }: any) => { ... }`
 * - 호출 사이트 분석 (4 곳, 모두 accent 명시 전달):
 *     line 158: `<RewardChips reward={...} accent="blue" />`
 *     line 196: `<RewardChips reward={...} accent={isComplete ? 'green' : ...} />`
 *     line 250: `<RewardChips reward={...} accent="blue" />`
 *     line 275: `<RewardChips reward={...} accent="blue" />`
 *   → 모든 호출자가 accent 명시 → default 'blue'은 도달 불가 (redundant 정의).
 *
 * 패턴 (cycle 222-427 시리즈 188번째):
 * - cycle 364-368 (5 cycles): redundant default annotation 시리즈.
 * - cycle 419: SignalBadge default `size='sm'` 갱신 (호출 사이트 분석).
 * - cycle 428: RewardChips default `accent='blue'` 제거 — 동일 lens 회귀.
 *
 * 수정 (src/components/tabs/QuestBoardPanel.tsx):
 * - destructure에서 `accent = 'blue'` → `accent` (default 제거).
 *
 * 회귀 가드:
 * - 4 호출자 모두 accent 명시 → 동작 그대로.
 * - accent 'blue' 분기 (else fallback in ternary) 그대로 활성.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 428: RewardChips destructure에서 default accent 'blue' 제거", async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(!/accent = 'blue'/.test(source),
        "RewardChips의 default `accent = 'blue'` 제거됨");
    // slice 20: inline prop 추가 (메타 칩 줄과 보상 칩 줄 통합) — accent 파라미터
    //   보존 가드는 inline 유무와 무관하게 유지.
    assert.ok(/RewardChips = \(\{ reward, accent(?:, inline = false)? \}/.test(source)
        || /RewardChips = \(\{ accent, reward \}/.test(source),
        'destructure에서 accent 파라미터 보존');
});

test('cycle 428: 4 호출 사이트 모두 accent 명시 전달 (정합성 가드)', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const callMatches = source.match(/<RewardChips[^>]*\/?>/g) || [];
    assert.equal(callMatches.length, 4, 'RewardChips 호출 4건');
    for (const call of callMatches) {
        assert.ok(/accent=/.test(call),
            `호출 "${call.slice(0, 80)}"에 accent 명시 전달`);
    }
});

test('cycle 428: ternary 분기 (green/amber/blue fallback) 보존', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(/accent === 'green'/.test(source), 'green 분기 보존');
    assert.ok(/accent === 'amber'/.test(source), 'amber 분기 보존');
    assert.ok(/border-\[#7dd4d8\]/.test(source), 'readable cyan fallback 클래스 보존');
});

test('cycle 427 회귀 가드: SignatureBadge TONE_COLORS rust 보존', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(/^\s+rust:/m.test(block), 'cycle 427 rust tone 보존');
});
