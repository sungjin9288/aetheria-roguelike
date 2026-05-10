import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 554: getExploreState `stats = {}` default unreachable
 *   (cycle 222-553 silent dead config 시리즈 295번째 — redundant default annotation
 *   청소 메가 시리즈 48번째). utils/ 추가 cleanup.
 *
 * 발견 (1 default unreachable):
 * - src/utils/explorationPacing.ts (line 16):
 *     const getExploreState = (stats: any = {}) => {
 *         const raw = stats?.exploreState || {};
 *         ...
 *     };
 * - 호출 사이트 (4 internal callsite, 모듈 내부 private):
 *     · explorationPacing.ts:90 — getExploreState(stats)
 *     · explorationPacing.ts:103 — getExploreState(stats)
 *     · explorationPacing.ts:114 — getExploreState(player?.stats)
 *     · explorationPacing.ts:145 — getExploreState(stats)
 *     · 다른 caller 0건 (cycle 297 export 제거).
 * - 결과: stats 항상 명시 전달. default {} 도달 불가. body의 `stats?.exploreState`
 *   가 undefined 안전 처리.
 *
 * 패턴 (cycle 222-553 시리즈 295번째):
 * - cycle 502-553: default 청소 메가 시리즈 52사이클.
 * - cycle 554: explorationPacing.ts internal helper — cycle 515 advance
 *   ExploreState에 이은 동일 모듈 추가 cleanup.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - signature에서 stats: any = {} → stats: any.
 * - body의 stats?.exploreState 가드 보존.
 *
 * 회귀 가드:
 * - 4 internal callsite 동작 그대로.
 * - body Math.max / DEFAULT_EXPLORE_STATE.lastOutcome 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 554: getExploreState signature에서 stats default 0건', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const fnIdx = source.indexOf('const getExploreState');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
        'getExploreState stats default {} 제거');
    assert.ok(/\bstats\b/.test(sig), 'stats 파라미터 자체는 보존');
});

test('cycle 554: 정합성 가드 — 4 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const calls = (source.match(/getExploreState\(/g) || []).length;
    assert.equal(calls, 4, `getExploreState 사용처 4건 보존: ${calls}건`);
    assert.ok(/const getExploreState = \(stats/.test(source),
        'getExploreState 정의 보존');
});

test('cycle 554: body stats?.exploreState 가드 보존 (undefined 안전)', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(/const raw = stats\?\.exploreState \|\| \{\}/.test(source),
        'stats?.exploreState || {} 가드 보존');
    assert.ok(/Math\.max\(0,\s*raw\.sinceNarrativeEvent \|\| 0\)/.test(source),
        'sinceNarrativeEvent Math.max 보존');
});

test('cycle 554: cycle 502-553 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/applyFatalProtection\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
        'cycle 553 applyFatalProtection relics default 0건');
    assert.ok(!/processLoot\(enemy: Monster, player:\s*any\s*=\s*null/.test(ce),
        'cycle 552 processLoot player default 0건');
});
