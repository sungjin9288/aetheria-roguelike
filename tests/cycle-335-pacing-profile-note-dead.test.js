import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 335: getMapPacingProfile note 필드 5회 dead 정리
 *   (cycle 222-334 silent dead config 시리즈 104번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - getMapPacingProfile 5 return 분기 (safe/boss/volatile/hostile/frontier)에서
 *   각각 `note: '...'` 필드 정의.
 * - src/, tests/ 어디에서도 `profile.note` / `pacingProfile.note` read 0건.
 * - 활성 필드: id / label / narrativeMult / quietMult / relicMult / anomalyMult /
 *   keyEventMult.
 *
 * 패턴 (cycle 222-334 silent dead config 시리즈 104번째):
 * - cycle 334: getQuestTracker.detail / getExplorationForecast.description.
 * - cycle 335: getMapPacingProfile.note 5회 cleanup.
 *
 * 수정 (src/utils/explorationPacing.ts):
 * - 5 note 필드 제거 (sed `/^\s+note: '.*',$/d`).
 *
 * 회귀 가드:
 * - id / label / mult 필드 보존.
 * - getNarrativeEventChance / getQuietExplorationChance / getDiscoveryOdds chain 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 335: getMapPacingProfile note 필드 0건 (5회 모두 제거)', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/^\s+note: '/m.test(source),
        'note 필드 제거됨');
});

test('cycle 335: getMapPacingProfile 핵심 필드 보존', async () => {
    const { getMapPacingProfile } = await import('../src/utils/explorationPacing.js');
    const profile = getMapPacingProfile({ type: 'safe' });
    assert.equal(profile.id, 'safe', 'id 보존');
    assert.equal(profile.label, '정비', 'label 보존');
    assert.equal(typeof profile.narrativeMult, 'number', 'narrativeMult 보존');
    assert.equal(profile.note, undefined, 'note 0건');
});

test('cycle 335: getMapPacingProfile 5 분기 모두 정상 동작', async () => {
    const { getMapPacingProfile } = await import('../src/utils/explorationPacing.js');
    const cases = [
        { input: { type: 'safe' }, expectedId: 'safe' },
        { input: { boss: '드래곤' }, expectedId: 'boss' },
        { input: { eventChance: 0.3 }, expectedId: 'volatile' },
        { input: { level: 30 }, expectedId: 'hostile' },
        { input: { level: 5 }, expectedId: 'frontier' },
    ];
    for (const { input, expectedId } of cases) {
        const profile = getMapPacingProfile(input);
        assert.equal(profile.id, expectedId, `${JSON.stringify(input)} → ${expectedId}`);
        assert.equal(profile.note, undefined, `${expectedId} note 0건`);
    }
});

test('cycle 334 회귀 가드: getQuestTracker / getExplorationForecast dead 필드 정리 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const trackerFn = source.slice(source.indexOf('export const getQuestTracker'), source.indexOf('export const getExplorationForecast'));
    const forecastFn = source.slice(source.indexOf('export const getExplorationForecast'), source.indexOf('export const getMoveRecommendations'));
    assert.ok(!/detail:/.test(trackerFn), 'cycle 334 getQuestTracker.detail 제거 보존');
    assert.ok(!/description:/.test(forecastFn), 'cycle 334 getExplorationForecast.description 제거 보존');
});
