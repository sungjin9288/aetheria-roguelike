import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 315: moveActions / ascensionActions 미사용 _shared 파라미터 제거
 *   (cycle 222-314 silent dead config 시리즈 85번째 — cleanup lens 연속).
 *
 * 발견 (unused 2nd parameter):
 * - src/hooks/gameActions/moveActions.ts: createMoveActions(deps, _shared?) — _shared 사용 0건.
 * - src/hooks/gameActions/ascensionActions.ts: createAscensionActions(deps, _shared?) — 동일.
 *
 * 비교 — 다른 gameAction factory들은 shared 활성 사용:
 * - exploreActions / questActions / characterActions / eventActions: 모두 shared
 *   destructure (commitExploreOutcome / emitUnlockedTitles / emitDailyProtocolLogs) 사용.
 *
 * useGameActions에서 `createMoveActions(deps, shared)` 호출하지만 extra arg는 무시되어 동작 동일.
 *
 * 패턴 (cycle 222-314 silent dead config 시리즈 85번째):
 * - cycle 314: moveActions 미사용 addStoryLog dependency 제거.
 * - cycle 315: 같은 파일 + ascensionActions의 미사용 2nd 파라미터 제거 (cycle 314 paired).
 *
 * 수정:
 * - moveActions.ts: createMoveActions 시그니처 (deps, _shared?) → (deps).
 * - ascensionActions.ts: createAscensionActions 시그니처 (deps, _shared?) → (deps).
 *
 * 회귀 가드:
 * - useGameActions 호출 사이트는 그대로 — extra arg 자동 무시.
 * - move / confirmAscension / cancelAscension 액션 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 315: createMoveActions 시그니처 (deps)만', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    assert.ok(/createMoveActions\s*=\s*\(deps:\s*any\)\s*=>/.test(source),
        'createMoveActions(deps) 단일 파라미터');
    assert.ok(!/createMoveActions[^=]+_shared/.test(source),
        '_shared 파라미터 제거됨');
});

test('cycle 315: createAscensionActions 시그니처 (deps)만', async () => {
    const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
    assert.ok(/createAscensionActions\s*=\s*\(deps:\s*any\)\s*=>/.test(source),
        'createAscensionActions(deps) 단일 파라미터');
    assert.ok(!/createAscensionActions[^=]+_shared/.test(source),
        '_shared 파라미터 제거됨');
});

test('cycle 315: useGameActions 호출 사이트 1-arg로 갱신 (TypeScript strict)', async () => {
    const source = await readSrc('src/hooks/useGameActions.ts');
    assert.ok(/createMoveActions\(deps\)/.test(source),
        'useGameActions createMoveActions(deps) 1-arg 호출');
    assert.ok(/createAscensionActions\(deps\)/.test(source),
        'useGameActions createAscensionActions(deps) 1-arg 호출');
    // 다른 factory는 여전히 shared 받음.
    assert.ok(/createExploreActions\(deps,\s*shared\)/.test(source),
        'createExploreActions은 shared 그대로');
});

test('cycle 315: 다른 gameAction factory는 shared 활성 사용 보존 (회귀 가드)', async () => {
    const exploreSrc = await readSrc('src/hooks/gameActions/exploreActions.ts');
    const questSrc = await readSrc('src/hooks/gameActions/questActions.ts');
    assert.ok(/commitExploreOutcome/.test(exploreSrc),
        'exploreActions commitExploreOutcome 사용 보존');
    assert.ok(/emitUnlockedTitles/.test(questSrc),
        'questActions emitUnlockedTitles 사용 보존');
});

test('cycle 314 회귀 가드: moveActions addStoryLog 제거 유지', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    const destrLine = source.match(/const\s*\{\s*[^}]+\}\s*=\s*deps\s*;/);
    assert.ok(destrLine, 'deps 구조분해 라인 발견');
    assert.ok(!/addStoryLog/.test(destrLine[0]),
        'cycle 314 addStoryLog destructure 제거 유지');
});
