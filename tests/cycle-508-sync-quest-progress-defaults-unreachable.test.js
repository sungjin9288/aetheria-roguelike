import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 508: syncQuestProgress 2 defaults unreachable batch
 *   (cycle 222-507 silent dead config 시리즈 258번째 — redundant default annotation
 *   util-level batch, util default 청소 메가 시리즈 7번째).
 *
 * 발견 (2 default unreachable):
 * - src/utils/questProgress.ts (line 10):
 *     export const syncQuestProgress = (player: Player, enemyName: any = '',
 *         questCatalog: any = QUESTS) => {...}
 * - 호출 사이트 (1 callsite):
 *     · CombatEngine.ts:1571 — syncQuestProgress(player, enemyName, DB.QUESTS).
 *     · 1 callsite, 3 args 명시 전달.
 *     · 다른 파일 import 0건.
 * - 결과: 2 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-507 시리즈 258번째):
 * - cycle 502-507: util default 청소 메가 시리즈.
 * - cycle 508: syncQuestProgress 2 defaults batch — 동일 lens.
 *
 * 수정 (src/utils/questProgress.ts):
 * - signature에서 enemyName: any = '' / questCatalog: any = QUESTS default 제거.
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - body normalizedEnemyName / latch / 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 508: syncQuestProgress signature defaults 0건', async () => {
    const source = await readSrc('src/utils/questProgress.ts');
    const fnIdx = source.indexOf('export const syncQuestProgress');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/enemyName:\s*any\s*=\s*''/.test(sig), 'enemyName default 제거');
    assert.ok(!/questCatalog:\s*any\s*=\s*QUESTS/.test(sig), 'questCatalog default 제거');
    assert.ok(/\benemyName\b/.test(sig), 'enemyName 파라미터 보존');
    assert.ok(/\bquestCatalog\b/.test(sig), 'questCatalog 파라미터 보존');
});

test('cycle 508: 정합성 가드 — CombatEngine 1 callsite 3 args', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    const matches = source.match(/syncQuestProgress\(/g) || [];
    assert.equal(matches.length, 1, 'syncQuestProgress 호출 1건');
    assert.ok(/syncQuestProgress\(player,\s*enemyName,\s*DB\.QUESTS\)/.test(source),
        '3 args 명시 전달 보존');
});

test('cycle 508: body 동작 보존 (normalizedEnemyName / latch)', async () => {
    const source = await readSrc('src/utils/questProgress.ts');
    assert.ok(/normalizedEnemyName = enemyName \|\| ''/.test(source),
        'normalizedEnemyName 보존');
    assert.ok(/const latch = /.test(source), 'latch 함수 보존');
});

test('cycle 508: cycle 502-507 회귀 가드 — 이전 정리 보존', async () => {
    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/getNarrativeEventChance[^=]*baseChance:\s*any\s*=\s*0/.test(ep),
        'cycle 507 getNarrativeEventChance baseChance default 0건');
});
