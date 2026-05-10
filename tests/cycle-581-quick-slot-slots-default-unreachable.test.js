import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 581: QuickSlot `slots = [null, null, null]` default unreachable
 *   (cycle 222-580 silent dead config 시리즈 319번째 — redundant default annotation
 *   청소 메가 시리즈 72번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/QuickSlot.tsx (line 23):
 *     const QuickSlot = ({ slots = [null, null, null], onUse, gameState }: QuickSlotProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · TerminalView.tsx:287 — <QuickSlot slots={quickSlots} onUse={...} gameState={gameState} />
 *     · 다른 caller 0건.
 * - 결과: slots 항상 명시 전달. default [null, null, null] 도달 불가.
 *
 * 패턴 (cycle 222-580 시리즈 319번째):
 * - cycle 502-580: default 청소 메가 시리즈 79사이클.
 * - cycle 581: components/ entry-level cleanup 추가.
 *
 * 수정 (src/components/QuickSlot.tsx):
 * - signature에서 slots = [null, null, null] → slots.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (TerminalView) 동작 그대로.
 * - body canUse / GS 분기 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 581: QuickSlot signature에서 slots default 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const fnIdx = source.indexOf('const QuickSlot = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slots\s*=\s*\[null, null, null\]/.test(sig),
        'QuickSlot slots default [null, null, null] 제거');
});

test('cycle 581: 정합성 가드 — TerminalView callsite 보존', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    assert.ok(/<QuickSlot[\s\S]*?slots=\{quickSlots\}/.test(source),
        'TerminalView <QuickSlot slots={quickSlots} /> callsite 보존');
});

test('cycle 581: cycle 502-580 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ag = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMoveRecommendations[^=]*maps:\s*Record<string,\s*GameMap>\s*=\s*\{\}/.test(ag),
        'cycle 579 getMoveRecommendations maps default 0건');

    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/countInventoryItemByName[^=]*inventory:\s*Item\[\]\s*=\s*\[\]/.test(eu),
        'cycle 578 countInventoryItemByName inventory default 0건');
});
