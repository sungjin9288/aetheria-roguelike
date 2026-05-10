import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 515: advanceExploreState `stats = {}` + `outcome = 'combat'` defaults
 *   batch unreachable (cycle 222-514 silent dead config 시리즈 260번째 — redundant
 *   default annotation util-level cleanup, util default 청소 메가 시리즈 13번째).
 *
 * 발견 (2 defaults batch):
 * - src/utils/explorationPacing.ts:
 *     export const advanceExploreState = (stats: any = {},
 *         outcome = 'combat') => {...}
 * - 호출 사이트 (1 callsite):
 *     · _shared.ts:53 — advanceExploreState(currentPlayer.stats, outcome)
 *     · 1 callsite, 2 args 명시 전달.
 *     · outcome 인자는 commitExploreOutcome(outcome, ...)의 outcome 변수와 직결,
 *       모든 7개 commitExploreOutcome 호출에서 1st arg(narrative_event/nothing/
 *       combat/relic_found 등) 명시 전달.
 *     · 다른 파일 import 0건.
 * - 결과: stats / outcome 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-514 시리즈 260번째):
 * - cycle 502-514: util default 청소 메가 시리즈.
 * - cycle 515: advanceExploreState batch — 동일 lens.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - signature에서 stats: any = {} → stats: any.
 * - signature에서 outcome = 'combat' → outcome: any.
 * - body의 getExploreState(stats) 호출 보존 (getExploreState 내부에서
 *   stats?.exploreState 처리, undefined 안전).
 * - switch (outcome) 분기 보존 (combat은 default: 케이스에서 기본 처리).
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - switch outcome 분기 + getExploreState 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 515: advanceExploreState signature에서 stats / outcome default 0건', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const fnIdx = source.indexOf('export const advanceExploreState');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default {} 제거');
    assert.ok(!/outcome\s*=\s*'combat'/.test(sig), "outcome default 'combat' 제거");
    assert.ok(/\bstats\b/.test(sig), 'stats 파라미터 자체는 보존');
    assert.ok(/\boutcome\b/.test(sig), 'outcome 파라미터 자체는 보존');
});

test('cycle 515: 정합성 가드 — _shared.ts callsite 2 args 명시 전달 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    const matches = source.match(/advanceExploreState\(/g) || [];
    assert.equal(matches.length, 1, 'advanceExploreState 호출 1건');
    assert.ok(/advanceExploreState\(currentPlayer\.stats,\s*outcome\)/.test(source),
        '2 args (currentPlayer.stats, outcome) 명시 전달 보존');
});

test('cycle 515: body switch outcome 분기 + getExploreState 호출 보존', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(/switch \(outcome\)/.test(source), 'switch (outcome) 분기 보존');
    assert.ok(/case 'narrative_event'/.test(source), "narrative_event 케이스 보존");
    assert.ok(/case 'combat':\s*\n\s*default:/.test(source), 'combat/default 케이스 보존');
    assert.ok(/const current = getExploreState\(stats\)/.test(source),
        'getExploreState(stats) 호출 보존 (undefined 안전)');
});

test('cycle 515: cycle 502-514 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const aep = await readSrc('src/utils/avatarEquipmentPreview.ts');
    assert.ok(!/getEquipmentPreviewStage[^=]*variant:\s*any\s*=/.test(aep),
        'cycle 514 getEquipmentPreviewStage variant default 0건');

    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/getEquipmentArtProfile[^=]*slotHint:\s*any\s*=/.test(ea),
        'cycle 513 getEquipmentArtProfile slotHint default 0건');

    const iv = await readSrc('src/utils/itemVisuals.ts');
    assert.ok(!/getArmorStyleFromItem[^=]*fallback[^,)]*=/.test(iv),
        'cycle 512 getArmorStyleFromItem fallback default 0건');
});
