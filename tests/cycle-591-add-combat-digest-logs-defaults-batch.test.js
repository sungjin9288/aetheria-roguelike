import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 591: addCombatDigestLogs 5 defaults batch unreachable
 *   (cycle 222-590 silent dead config 시리즈 328번째 — redundant default annotation
 *   청소 메가 시리즈 81번째). single-cycle 5-default batch.
 *
 * 발견 (5 defaults batch):
 * - src/hooks/combatActions/_helpers.ts (line 66):
 *     export const addCombatDigestLogs = ({
 *         addLog, enemyName, victoryResult,
 *         droppedItems = [], upgradeHint = null, traitHint = null,
 *         bossRewardHint = null, bossClearBonus = 0,
 *     }: any) => {...};
 * - 호출 사이트 (1 caller):
 *     · combatVictory.ts:215 — addCombatDigestLogs({addLog, enemyName,
 *       victoryResult, droppedItems, upgradeHint, traitHint, bossRewardHint,
 *       bossClearBonus}) — 8 props 모두 명시.
 *     · 다른 caller 0건.
 * - 결과: 5 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-590 시리즈 328번째):
 * - cycle 502-590: default 청소 메가 시리즈 89사이클.
 * - cycle 591: hooks/combatActions/_helpers.ts cleanup. cycle 534
 *   getLootUpgradeHint와 동일 모듈 추가 cleanup.
 *
 * 수정 (src/hooks/combatActions/_helpers.ts):
 * - 5 defaults 모두 제거.
 * - body의 droppedItems.length / droppedItems.slice 처리 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (combatVictory) 동작 그대로.
 * - body summaryParts / MSG.COMBAT_DIGEST 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 591: addCombatDigestLogs signature에서 5 defaults 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fnIdx = source.indexOf('export const addCombatDigestLogs');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/droppedItems\s*=\s*\[\]/.test(sig), 'droppedItems default [] 제거');
    assert.ok(!/upgradeHint\s*=\s*null/.test(sig), 'upgradeHint default null 제거');
    assert.ok(!/traitHint\s*=\s*null/.test(sig), 'traitHint default null 제거');
    assert.ok(!/bossRewardHint\s*=\s*null/.test(sig), 'bossRewardHint default null 제거');
    assert.ok(!/bossClearBonus\s*=\s*0/.test(sig), 'bossClearBonus default 0 제거');
});

test('cycle 591: 정합성 가드 — combatVictory callsite 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/addCombatDigestLogs\(\{[\s\S]*?bossClearBonus: victoryResult\.bossClearBonus\?\.goldBonus \|\| 0,/.test(source),
        'combatVictory addCombatDigestLogs callsite 8-props 명시 전달 보존');
});

test('cycle 591: body summaryParts / MSG.COMBAT_DIGEST 처리 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(/MSG\.COMBAT_DIGEST_KILL\(enemyName\)/.test(source),
        'MSG.COMBAT_DIGEST_KILL 보존');
    assert.ok(/if \(droppedItems\.length > 0\)/.test(source),
        'droppedItems.length 처리 보존');
});

test('cycle 591: cycle 502-590 회귀 가드 — default 청소 시리즈 보존', async () => {
    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(!/QuestBoardPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(qb),
        'cycle 589 QuestBoardPanel onOpenArchiveConsole default 0건');

    const cr = await readSrc('src/components/tabs/CraftingPanel.tsx');
    assert.ok(!/CraftingPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(cr),
        'cycle 588 CraftingPanel onOpenArchiveConsole default 0건');
});
