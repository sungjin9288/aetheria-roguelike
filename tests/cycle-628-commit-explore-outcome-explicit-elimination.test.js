import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 628: commitExploreOutcome transformPlayer null explicit
 *   default-elimination
 *   (cycle 222-627 silent dead config 시리즈 366번째 — explicit
 *   default-elimination pattern 19번째 적용, 7-caller batch).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/hooks/gameActions/_shared.ts:38:
 *     const commitExploreOutcome = (outcome: any, transformPlayer: any = null) => {...}
 * - 호출 사이트 8개 (exploreActions.ts):
 *     · 7 1-arg callers — default null 활성:
 *       43/80/84/93/106/109/117.
 *     · 1 2-arg caller — 168: applyBattleStartRelics callback 명시.
 * - 7 callers에 명시 null 추가하여 default 도달 불가로 변환.
 *
 * 패턴 (cycle 222-627 시리즈 366번째):
 * - cycle 502-627: default 청소 메가 시리즈 123사이클.
 * - cycle 628: explicit default-elimination 19번째.
 *   7-caller conversion으로 가장 큰 단일 batch 변환 (cycle 608+ 기존 1-3
 *   caller 변환에 비해 7 callers 동시 처리).
 *
 * 수정:
 * - exploreActions.ts:43/80/84/93/106/109/117 — 7 callsite null 명시 추가.
 * - _shared.ts:38 — transformPlayer default null 제거.
 *
 * 회귀 가드:
 * - 8 internal callsite 동작 그대로.
 * - body `if (typeof transformPlayer === 'function') { ... }` 처리 보존
 *   (null이든 함수든 동일 처리).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 628: commitExploreOutcome signature에서 transformPlayer default null 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(source),
        'commitExploreOutcome transformPlayer default null 제거');
    assert.ok(/commitExploreOutcome = \(outcome:\s*any,\s*transformPlayer:\s*any\)/.test(source),
        'commitExploreOutcome transformPlayer 파라미터 보존 (default 없이)');
});

test('cycle 628: 7 callsite null 명시 추가', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/commitExploreOutcome\('narrative_event',\s*null\)/.test(source),
        "narrative_event callsite null 명시 (line 43)");
    const nothingMatches = (source.match(/commitExploreOutcome\('nothing',\s*null\)/g) || []).length;
    assert.ok(nothingMatches >= 3, `'nothing' callsite null 명시 3건 이상 (got ${nothingMatches})`);
    assert.ok(/commitExploreOutcome\(quietResult,\s*null\)/.test(source),
        'quietResult callsite null 명시 (line 106)');
    assert.ok(/commitExploreOutcome\('relic_found',\s*null\)/.test(source),
        "'relic_found' callsite null 명시 (line 117)");
});

test('cycle 628: combat 2-arg callsite 보존 (line 168)', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/commitExploreOutcome\('combat',\s*\(nextPlayer:\s*any\)\s*=>/.test(source),
        "combat 2-arg callsite (applyBattleStartRelics callback) 보존");
});

test('cycle 628: body transformPlayer function 처리 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(/if \(typeof transformPlayer === 'function'\)/.test(source),
        "transformPlayer function 분기 보존");
});

test('cycle 628: cycle 502-627 회귀 가드 — default 청소 시리즈 보존', async () => {
    const m = await readSrc('src/data/messages.ts');
    assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(m),
        'cycle 627 COMBAT_ATTACK_DETAIL tags default 0건');
    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(cp),
        "cycle 626 renderActionButton extraClass default 0건");
});
