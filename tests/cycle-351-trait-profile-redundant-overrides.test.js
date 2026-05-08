import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 351: getTraitProfile 3 redundant override 정리 (rewardFocus/questFocus/bossDirective)
 *   (cycle 222-350 silent dead config 시리즈 118번째 — cleanup lens 연속).
 *
 * 발견 (3 dead redundant overrides):
 * - getTraitProfile return에 `...definition` spread + 명시 `rewardFocus: definition.rewardFocus` /
 *   `questFocus: definition.questFocus` / `bossDirective: definition.bossDirective`.
 * - spread가 이미 동일 필드 노출 → 명시 override는 dead duplicate.
 *
 * 패턴 (cycle 222-350 silent dead config 시리즈 118번째):
 * - cycle 350: CHANGELOG batch milestone.
 * - cycle 351: getTraitProfile redundant overrides 정리.
 *
 * 수정 (src/utils/runProfile.ts):
 * - rewardFocus / questFocus / bossDirective 3 명시 override 제거.
 *
 * 회귀 가드:
 * - `...definition` spread가 모든 TRAIT_DEFINITIONS 필드를 그대로 노출 (id/name/title/
 *   accent/chipClass/desc/passiveLabel/unlockHint/rewardFocus/questFocus/bossDirective).
 * - buildProfile / reasons / bonus / skill 4 explicit field 보존 (override 의미).
 * - 사용처 (StatsPanel / BuildAdvicePanel)에서 trait.rewardFocus 등 read 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 351: getTraitProfile 3 redundant override 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
    assert.ok(!/rewardFocus: definition\.rewardFocus/.test(fn),
        'rewardFocus override 0건');
    assert.ok(!/questFocus: definition\.questFocus/.test(fn),
        'questFocus override 0건');
    assert.ok(!/bossDirective: definition\.bossDirective/.test(fn),
        'bossDirective override 0건');
});

test('cycle 351: spread + bonus / skill 명시 override 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
    assert.ok(/\.\.\.definition,/.test(fn), '...definition spread 보존');
    assert.ok(/^\s+bonus: \{/m.test(fn), 'bonus 명시 override 보존 (정규화)');
    assert.ok(/^\s+skill,/m.test(fn), 'skill 명시 override 보존 (재계산)');
});

test('cycle 351: getTraitProfile 동작 보존 (활성 필드 모두 노출)', async () => {
    const { getTraitProfile } = await import('../src/utils/runProfile.js');
    const player = { job: '검사', equip: {}, relics: [], hp: 100, maxHp: 100, mp: 50, maxMp: 50, stats: {} };
    const trait = getTraitProfile(player, {});
    assert.ok('rewardFocus' in trait, 'rewardFocus 노출 (spread)');
    assert.ok('questFocus' in trait, 'questFocus 노출 (spread)');
    assert.ok('bossDirective' in trait, 'bossDirective 노출 (spread)');
    assert.ok('bonus' in trait, 'bonus 보존');
    assert.ok('skill' in trait, 'skill 보존');
    assert.ok('reasons' in trait, 'reasons 보존');
});

test('cycle 350 회귀 가드: CHANGELOG batch 보존', async () => {
    const source = await readSrc('CHANGELOG.md');
    assert.ok(/Cycle 350 🎯/.test(source),
        'cycle 350 batch entry 보존');
});
