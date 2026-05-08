import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 297: getExploreState export → private downgrade
 *   (cycle 222-296 silent dead config 시리즈 67번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/explorationPacing.ts: getExploreState — 동일 파일 내부 4회 사용
 *   (getNarrativeEventChance, getQuietExplorationChance, getDiscoveryOdds,
 *   advanceExploreState), 외부 consumer 0건 (test 0건).
 *
 * 패턴 (cycle 222-296 silent dead config 시리즈 67번째):
 * - cycle 296: getSynthesisOutputs private downgrade.
 * - cycle 297: getExploreState private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - `export const getExploreState` → `const getExploreState` (private).
 *
 * 회귀 가드:
 * - DEFAULT_EXPLORE_STATE / getMapPacingProfile / getNarrativeEventChance /
 *   getQuietExplorationChance / getDiscoveryOdds / advanceExploreState active export 유지.
 * - getNarrativeEventChance 동작 동일 (내부에서 getExploreState 호출).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 297: getExploreState export 제거 (private)', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/export const getExploreState\b/.test(source),
        'getExploreState export 제거됨');
    assert.ok(/const getExploreState\b/.test(source),
        'getExploreState const 정의 유지 (private)');
});

test('cycle 297: explorationPacing active exports 유지', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    const activeExports = ['DEFAULT_EXPLORE_STATE', 'getMapPacingProfile', 'getNarrativeEventChance', 'getQuietExplorationChance', 'getDiscoveryOdds', 'advanceExploreState'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 297: getNarrativeEventChance 동작 보존 (내부 getExploreState 사용)', async () => {
    const { getNarrativeEventChance } = await import('../src/utils/explorationPacing.js');
    const result = getNarrativeEventChance(0.2, 0, {});
    assert.equal(typeof result, 'number', '숫자 반환');
    assert.ok(result >= 0 && result <= 1, '확률 범위 [0,1]');
});

test('cycle 296 회귀 가드: getSynthesisOutputs private 유지', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    assert.ok(!/export const getSynthesisOutputs/.test(source),
        'cycle 296 getSynthesisOutputs private 유지');
});
