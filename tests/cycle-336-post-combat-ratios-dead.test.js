import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 필드 dead 제거
 *   (cycle 222-335 silent dead config 시리즈 105번째 — cleanup lens 연속).
 *
 * 발견 (dead output fields):
 * - getPostCombatAnalysis 반환에 hpRatio / mpRatio 필드 정의.
 * - 내부에서 grade/notes/actions 분기 계산용으로만 사용. 외부 read 0건.
 * - PostCombatCard / RunSummaryCard / test 어디에서도 analysis.hpRatio /
 *   analysis.mpRatio 접근 0건.
 *
 * 활성 출력 필드: grade / rewardMood / rewardHighlights / notes / actions.
 *
 * 패턴 (cycle 222-335 silent dead config 시리즈 105번째):
 * - cycle 335: getMapPacingProfile.note 5회 cleanup.
 * - cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 필드 정리.
 *
 * 수정 (src/utils/outcomeAnalysis.ts):
 * - getPostCombatAnalysis return에서 hpRatio / mpRatio 필드 제거.
 * - 내부 변수는 분기 계산용으로 그대로 유지.
 *
 * 회귀 가드:
 * - grade / rewardMood / rewardHighlights / notes / actions 보존.
 * - PostCombatCard analysis.grade / analysis.notes / analysis.actions /
 *   analysis.rewardMood / analysis.rewardHighlights 사용 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 336: getPostCombatAnalysis hpRatio / mpRatio 출력 0건', async () => {
    const source = await readSrc('src/utils/outcomeAnalysis.ts');
    const fn = source.slice(0, source.indexOf('export const getRunSummaryAnalysis'));
    // return 객체 안의 hpRatio/mpRatio 출력 0건 (내부 변수는 const 정의로 그대로 OK).
    assert.ok(!/^\s+hpRatio,$/m.test(fn),
        'getPostCombatAnalysis hpRatio 출력 제거');
    assert.ok(!/^\s+mpRatio,$/m.test(fn),
        'getPostCombatAnalysis mpRatio 출력 제거');
});

test('cycle 336: getPostCombatAnalysis 동작 보존', async () => {
    const { getPostCombatAnalysis } = await import('../src/utils/outcomeAnalysis.js');
    const result = getPostCombatAnalysis({
        playerHp: 50, playerMaxHp: 100, playerMp: 30, playerMaxMp: 50,
        enemy: '슬라임', enemyTier: 'NORMAL', primaryBuild: '균형형 런', items: [],
    });
    assert.ok(typeof result.grade === 'string', 'grade 보존');
    assert.ok(typeof result.rewardMood === 'string', 'rewardMood 보존');
    assert.ok(Array.isArray(result.rewardHighlights), 'rewardHighlights 보존');
    assert.ok(Array.isArray(result.notes), 'notes 보존');
    assert.ok(Array.isArray(result.actions), 'actions 보존');
    // dead 필드 0건.
    assert.equal(result.hpRatio, undefined, 'hpRatio 출력 0건');
    assert.equal(result.mpRatio, undefined, 'mpRatio 출력 0건');
});

test('cycle 336: PostCombatCard 사용 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(/analysis\.grade/.test(source), 'analysis.grade read 보존');
    assert.ok(/analysis\.notes/.test(source), 'analysis.notes read 보존');
    assert.ok(/analysis\.actions/.test(source), 'analysis.actions read 보존');
});

test('cycle 335 회귀 가드: getMapPacingProfile.note 5회 제거 보존', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/^\s+note: '/m.test(source),
        'cycle 335 note 제거 보존');
});
