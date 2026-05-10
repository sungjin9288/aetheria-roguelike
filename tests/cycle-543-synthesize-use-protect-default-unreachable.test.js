import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 543: synthesize `useProtect = false` default unreachable
 *   (cycle 222-542 silent dead config 시리즈 285번째 — redundant default annotation
 *   청소 메가 시리즈 38번째).
 *
 * 발견 (1 default unreachable):
 * - src/hooks/useInventoryActions.ts (line 409):
 *     synthesize: (itemIds: any, useProtect: any = false) => {
 *         const items = itemIds.map(...);
 *         ...
 *     }
 * - 호출 사이트 (1 callsite):
 *     · CraftingPanel.tsx:52 — actions.synthesize(selectedIds, useProtect)
 *     · 다른 caller 0건.
 * - 결과: useProtect 항상 명시 전달. default false 도달 불가.
 *
 * 패턴 (cycle 222-542 시리즈 285번째):
 * - cycle 502-542: default 청소 메가 시리즈 41사이클.
 * - cycle 543: hooks/useInventoryActions 추가 cleanup.
 *
 * 수정 (src/hooks/useInventoryActions.ts):
 * - signature에서 useProtect: any = false → useProtect: any.
 * - body의 synthProtects/premiumCurrency 분기 보존.
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - body validation / signature 가드 / synthProtects 토큰 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 543: synthesize signature에서 useProtect default 0건', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(source),
        'synthesize useProtect default false 제거');
    assert.ok(/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\)/.test(source),
        'synthesize 파라미터 자체는 보존');
});

test('cycle 543: 정합성 가드 — CraftingPanel callsite 보존', async () => {
    const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
    assert.ok(/actions\.synthesize\(selectedIds,\s*useProtect\)/.test(source),
        'actions.synthesize(selectedIds, useProtect) callsite 보존');
});

test('cycle 543: body validation / signature guard 보존', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/validateSynthesis\(items,\s*player\.gold\)/.test(source),
        'validateSynthesis 호출 보존');
    assert.ok(/SIGNATURE_INPUT/.test(source), 'SIGNATURE_INPUT 가드 보존');
});

test('cycle 543: cycle 502-542 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
        'cycle 542 signedDelta value default 0건');

    const qt = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/getQuestProgressText[^=]*progress:\s*any\s*=\s*0/.test(qt),
        'cycle 541 QuestTab getQuestProgressText progress default 0건');
});
