import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 313: QuestRewardChips export → private downgrade
 *   (cycle 222-312 silent dead config 시리즈 83번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/components/tabs/QuestTab.tsx:30 QuestRewardChips export.
 *   동일 파일 line 349에서 1회 JSX render. 외부 import 0건.
 *
 * 패턴 (cycle 222-312 silent dead config 시리즈 83번째):
 * - cycle 312: anchorPoints WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private.
 * - cycle 313: QuestTab 내부 컴포넌트 private downgrade.
 *
 * 수정 (src/components/tabs/QuestTab.tsx):
 * - QuestRewardChips export 제거 (private const 유지).
 *
 * 회귀 가드:
 * - QuestTab default export 그대로.
 * - JSX render line 349 동작 동일 (같은 모듈 스코프).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 313: QuestRewardChips export 제거 (private)', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/export const QuestRewardChips\b/.test(source),
        'QuestRewardChips export 제거됨');
    assert.ok(/const QuestRewardChips\b/.test(source),
        'QuestRewardChips const 정의 유지 (private)');
});

test('cycle 313: QuestRewardChips JSX render 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/<QuestRewardChips\b/.test(source),
        'QuestRewardChips JSX render 보존');
});

test('cycle 313: QuestTab default export 유지', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/export default/.test(source),
        'QuestTab default export 유지');
});

test('cycle 312 회귀 가드: anchorPoints 2 placement private 유지', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
        'cycle 312 WEAPON_PLACEMENTS private 유지');
    assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
        'cycle 312 OFFHAND_PLACEMENTS private 유지');
});
