import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 592: handleVictoryOutcome 2 defaults batch unreachable
 *   (cycle 222-591 silent dead config 시리즈 329번째 — redundant default annotation
 *   청소 메가 시리즈 82번째).
 *
 * 발견 (2 defaults batch):
 * - src/hooks/combatActions/combatVictory.ts (line 25):
 *     export const handleVictoryOutcome = ({
 *         playerAfterCombat, deadEnemy, stats,
 *         dispatch, addLog, addStoryLog,
 *         emitDailyProtocolLogs, emitUnlockedTitles,
 *         extendedChecks = false,
 *         liveConfig = {},
 *     }: any) => {...};
 * - 호출 사이트 (3 callers):
 *     · combatAttack.ts:81 — extendedChecks: true, liveConfig 명시.
 *     · combatAttack.ts:131 — extendedChecks: false, liveConfig 명시.
 *     · combatItem.ts:67 — extendedChecks: false, liveConfig 명시.
 * - 결과: extendedChecks / liveConfig 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-591 시리즈 329번째):
 * - cycle 502-591: default 청소 메가 시리즈 90사이클.
 * - cycle 592: hooks/combatActions/ — cycle 591 _helpers.ts에 이은 동일
 *   디렉토리 cleanup.
 *
 * 수정 (src/hooks/combatActions/combatVictory.ts):
 * - extendedChecks = false → extendedChecks.
 * - liveConfig = {} → liveConfig.
 * - body 동작 보존 (cycle 265 liveConfig 4번째 인자 전달 보존).
 *
 * 회귀 가드:
 * - 3 production callsite 동작 그대로.
 * - body CombatEngine.handleVictory(playerAfterCombat, deadEnemy, passiveBonus,
 *   liveConfig) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 592: handleVictoryOutcome signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    const fnIdx = source.indexOf('export const handleVictoryOutcome');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/extendedChecks\s*=\s*false/.test(sig),
        'handleVictoryOutcome extendedChecks default false 제거');
    assert.ok(!/liveConfig\s*=\s*\{\}/.test(sig),
        'handleVictoryOutcome liveConfig default {} 제거');
});

test('cycle 592: 정합성 가드 — 3 production callsite 보존', async () => {
    const ca = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(/extendedChecks: true/.test(ca),
        'combatAttack:81 extendedChecks: true 명시 보존');
    const cafalse = (ca.match(/extendedChecks: false/g) || []).length;
    assert.ok(cafalse >= 1, `combatAttack extendedChecks: false 명시 보존: ${cafalse}건`);

    const ci = await readSrc('src/hooks/combatActions/combatItem.ts');
    assert.ok(/extendedChecks: false/.test(ci),
        'combatItem extendedChecks: false 명시 보존');
});

test('cycle 592: body CombatEngine.handleVictory liveConfig 전달 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/CombatEngine\.handleVictory\(playerAfterCombat, deadEnemy, passiveBonus, liveConfig\)/.test(source),
        'CombatEngine.handleVictory liveConfig 전달 보존');
});

test('cycle 592: cycle 502-591 회귀 가드 — default 청소 시리즈 보존', async () => {
    const helpers = await readSrc('src/hooks/combatActions/_helpers.ts');
    assert.ok(!/droppedItems\s*=\s*\[\]/.test(helpers),
        'cycle 591 addCombatDigestLogs droppedItems default 0건');

    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(!/QuestBoardPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(qb),
        'cycle 589 QuestBoardPanel onOpenArchiveConsole default 0건');
});
