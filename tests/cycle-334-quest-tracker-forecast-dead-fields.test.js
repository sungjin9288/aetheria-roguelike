import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 334: getQuestTracker.detail + getExplorationForecast.description dead 필드 제거
 *   (cycle 222-333 silent dead config 시리즈 103번째 — cleanup lens 연속).
 *
 * 발견 (dead output fields):
 * - getQuestTracker 반환에 `detail` 필드 (claimable: '보상을 수령할 수 있습니다.',
 *   active: focus.quest.desc) — src/, tests/ 어디에서도 read 0건.
 * - getExplorationForecast 반환에 `description` 필드 (6 분기별 설명 문자열) —
 *   src/, tests/ 어디에서도 read 0건. mood / chips만 사용.
 *
 * 패턴 (cycle 222-333 silent dead config 시리즈 103번째):
 * - cycle 333: getMoveRecommendations 4 dead 출력 필드 정리.
 * - cycle 334: getQuestTracker / getExplorationForecast dead description 제거.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - getQuestTracker: 두 return 분기에서 detail 필드 제거.
 * - getExplorationForecast: 4 return 분기에서 description 필드 제거 + 분기별
 *   description 변수 할당 라인 정리.
 *
 * 회귀 가드:
 * - getQuestTracker: kind / title / progressLabel / questId 필드 보존.
 * - getExplorationForecast: mood / chips 필드 보존.
 * - 기존 test (adventure-guide.test) 영향 없음 (mood / chips만 검증).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 334: getQuestTracker detail 필드 제거', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    // getQuestTracker 함수 블록 추출 후 detail 필드 0건.
    const fn = source.slice(source.indexOf('export const getQuestTracker'), source.indexOf('export const getExplorationForecast'));
    assert.ok(!/detail:/.test(fn),
        'getQuestTracker에서 detail 필드 제거됨');
});

test('cycle 334: getExplorationForecast description 필드 제거', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const fn = source.slice(source.indexOf('export const getExplorationForecast'), source.indexOf('export const getMoveRecommendations'));
    assert.ok(!/description:/.test(fn),
        'getExplorationForecast에서 description 필드 제거됨');
    assert.ok(!/let description =/.test(fn),
        'description 변수 할당 라인 제거됨');
});

test('cycle 334: getQuestTracker 동작 보존 (kind/title/progressLabel/questId)', async () => {
    const { getQuestTracker } = await import('../src/utils/adventureGuide.js');
    const player = {
        quests: [{ id: 1, progress: 0, isBounty: false }],
    };
    const tracker = getQuestTracker(player);
    if (tracker) {
        assert.ok('kind' in tracker, 'kind 보존');
        assert.ok('title' in tracker, 'title 보존');
        assert.ok('progressLabel' in tracker, 'progressLabel 보존');
        assert.equal(tracker.detail, undefined, 'detail 필드 0건');
    }
});

test('cycle 334: getExplorationForecast 동작 보존 (mood/chips)', async () => {
    const { getExplorationForecast } = await import('../src/utils/adventureGuide.js');
    const forecast = getExplorationForecast({}, null);
    assert.ok('mood' in forecast, 'mood 보존');
    assert.ok(Array.isArray(forecast.chips), 'chips array 보존');
    assert.equal(forecast.description, undefined, 'description 필드 0건');
});

test('cycle 333 회귀 가드: getMoveRecommendations dead 필드 0건 유지', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/_sortKey/.test(source), 'cycle 333 _sortKey 유지');
});
