import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 429: QuestTab QuestRewardChips default `accent = 'blue'` redundant 정리
 *   (cycle 222-428 silent dead config 시리즈 189번째 — redundant default annotation
 *   lens 회귀, cycle 364-368 패턴 + cycle 428 paired completion).
 *
 * 발견 (1 redundant default value):
 * - src/components/tabs/QuestTab.tsx QuestRewardChips:
 *     `({ reward, accent = 'blue' }: any) => { ... }`
 * - 호출 사이트 분석 (1곳, accent 명시 전달):
 *     line 350: `<QuestRewardChips reward={...} accent={isComplete ? 'green' : isBounty ? 'amber' : 'blue'} />`
 *   → 호출자가 ternary로 accent 명시 → default 'blue'는 도달 불가.
 *
 * 패턴 (cycle 222-428 시리즈 189번째):
 * - cycle 364-368 시리즈: redundant default annotation.
 * - cycle 428: QuestBoardPanel RewardChips default accent 'blue' 제거.
 * - cycle 429: QuestTab QuestRewardChips 동일 패턴 — paired completion.
 *
 * 수정 (src/components/tabs/QuestTab.tsx):
 * - destructure에서 default 값 제거 → `({ reward, accent }: any) =>`.
 *
 * 회귀 가드:
 * - 1 호출자 명시 accent 전달 → 동작 그대로.
 * - ternary 분기 (green/amber/else fallback) 그대로 활성.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 429: QuestRewardChips destructure에서 default accent 값 제거", async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const fnIdx = source.indexOf('const QuestRewardChips');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/accent = 'blue'/.test(block),
        "QuestRewardChips destructure default 제거됨");
    assert.ok(/\{ reward, accent \}/.test(block),
        'destructure에서 accent 파라미터 보존');
});

test('cycle 429: 호출 사이트 accent 명시 전달 (정합성 가드)', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const callMatches = source.match(/<QuestRewardChips[^>]*\/?>/g) || [];
    assert.ok(callMatches.length >= 1, 'QuestRewardChips 호출 1건 이상');
    for (const call of callMatches) {
        assert.ok(/accent=/.test(call),
            `호출에 accent 명시 전달`);
    }
});

test('cycle 429: ternary 분기 (green/amber/blue fallback) 보존', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const fnIdx = source.indexOf('const QuestRewardChips');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/accent === 'green'/.test(block), 'green 분기 보존');
    assert.ok(/accent === 'amber'/.test(block), 'amber 분기 보존');
    assert.ok(/border-cyber-blue/.test(block), 'blue fallback 클래스 보존');
});

test('cycle 428 회귀 가드: QuestBoardPanel RewardChips default accent 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const fnIdx = source.indexOf('const RewardChips');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/accent = 'blue'/.test(block),
        "cycle 428 RewardChips default 제거 보존");
});
