import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 509: getAdventureGuidance `runtimeState = 'idle'` default unreachable
 *   (cycle 222-508 silent dead config 시리즈 259번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 8번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/adventureGuide.ts (line 243):
 *     export const getAdventureGuidance = (player, stats, mapData,
 *         runtimeState: any = 'idle') => {...
 *         if (runtimeState && runtimeState !== 'idle') {...}
 *         ...
 *     }
 * - 호출 사이트 (1 callsite):
 *     · ControlPanel.tsx:57 — getAdventureGuidance(player, stats || ...,
 *       mapData, gameState).
 *     · 1 callsite, 4 args 명시 전달 (gameState).
 *     · 다른 파일 import 0건.
 * - 결과: runtimeState 항상 명시 전달. default 'idle' 도달 불가.
 *
 * 패턴 (cycle 222-508 시리즈 259번째):
 * - cycle 502-508: util default 청소 메가 시리즈.
 * - cycle 509: getAdventureGuidance runtimeState default — 동일 lens.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - signature에서 runtimeState: any = 'idle' → runtimeState: any.
 * - body의 `if (runtimeState && runtimeState !== 'idle')` 분기 보존 (caller가
 *   gameState를 'idle' 또는 다른 값으로 넘기는 케이스 모두 커버).
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - body 분기 보존 (runtimeState !== 'idle' 가드).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 509: getAdventureGuidance signature에서 runtimeState default 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const fnIdx = source.indexOf('export const getAdventureGuidance');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/runtimeState:\s*any\s*=\s*'idle'/.test(sig), 'runtimeState default 제거');
    assert.ok(/\bruntimeState\b/.test(sig), 'runtimeState 파라미터 자체는 보존');
});

test('cycle 509: 정합성 가드 — ControlPanel callsite 4 args (gameState 명시 전달)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const matches = source.match(/getAdventureGuidance\(/g) || [];
    assert.equal(matches.length, 1, 'getAdventureGuidance 호출 1건');
    // 4 args 호출 — gameState가 마지막 args로 명시 전달되는지
    assert.ok(/getAdventureGuidance\([\s\S]+?, mapData, gameState\)/.test(source),
        '4 args 명시 전달 (mapData, gameState) 보존');
});

test('cycle 509: body runtimeState 분기 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/if \(runtimeState && runtimeState !== 'idle'\)/.test(source),
        'runtimeState !== idle 분기 보존');
    assert.ok(/runtimeState === 'combat'/.test(source), 'combat 분기 보존');
});

test('cycle 509: cycle 502-508 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const qp = await readSrc('src/utils/questProgress.ts');
    assert.ok(!/syncQuestProgress[^=]*enemyName:\s*any\s*=/.test(qp),
        'cycle 508 syncQuestProgress enemyName default 0건');

    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/getNarrativeEventChance[^=]*baseChance:\s*any\s*=/.test(ep),
        'cycle 507 getNarrativeEventChance baseChance default 0건');
});
