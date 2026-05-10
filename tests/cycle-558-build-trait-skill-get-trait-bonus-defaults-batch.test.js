import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 558: buildTraitSkill + getTraitBonus 2 defaults batch unreachable
 *   (cycle 222-557 silent dead config 시리즈 299번째 — redundant default annotation
 *   청소 메가 시리즈 52번째). runProfile.ts 같은 모듈 batch.
 *
 * 발견 (2 defaults batch):
 * - src/utils/runProfile.ts (line 169, 232):
 *     · const buildTraitSkill = (traitId, player, stats: any = {}) — private,
 *       1 internal caller (line 212) 명시.
 *     · export const getTraitBonus = (player, stats: any = {}) — 1 external
 *       caller (statsCalculator.ts:376) 2 args 명시. test caller 0건.
 * - 호출 사이트 audit:
 *     · buildTraitSkill: 1 internal (line 212) — buildTraitSkill(traitId,
 *       player, stats) 명시.
 *     · getTraitBonus: 1 external (statsCalculator:376) — getTraitBonus(player,
 *       preBuildStats) 명시. tests 0건.
 * - 결과: 두 default 모두 도달 불가.
 *
 * Note: getTraitProfile / getTraitSkill는 1-arg caller가 존재 (DashboardMobile
 * Summary, gameUtils:23 등) → defaults reachable, cleanup 대상 외.
 *
 * 패턴 (cycle 222-557 시리즈 299번째):
 * - cycle 502-557: default 청소 메가 시리즈 56사이클.
 * - cycle 558: runProfile.ts 같은 모듈 추가 batch — cycle 526/544에 이은
 *   cleanup.
 *
 * 수정 (src/utils/runProfile.ts):
 * - buildTraitSkill signature: stats: any = {} → stats: any.
 * - getTraitBonus signature: stats: any = {} → stats: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - buildTraitSkill 1 internal callsite 동작 그대로.
 * - getTraitBonus 1 external callsite 동작 그대로.
 * - getTraitProfile / getTraitSkill defaults 보존 (reachable).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 558: 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const buildSig = source.slice(source.indexOf('const buildTraitSkill'),
                                    source.indexOf('=>', source.indexOf('const buildTraitSkill')));
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(buildSig),
        'buildTraitSkill stats default {} 제거');

    const bonusSig = source.slice(source.indexOf('export const getTraitBonus'),
                                    source.indexOf('=>', source.indexOf('export const getTraitBonus')));
    assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(bonusSig),
        'getTraitBonus stats default {} 제거');
});

test('cycle 558: getTraitProfile / getTraitSkill defaults 보존 (reachable)', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const profileSig = source.slice(source.indexOf('export const getTraitProfile'),
                                     source.indexOf('=>', source.indexOf('export const getTraitProfile')));
    assert.ok(/stats:\s*any\s*=\s*\{\}/.test(profileSig),
        'getTraitProfile stats default {} 보존 (reachable from gameUtils 1-arg caller)');

    const skillSig = source.slice(source.indexOf('export const getTraitSkill'),
                                    source.indexOf('=>', source.indexOf('export const getTraitSkill')));
    assert.ok(/stats:\s*any\s*=\s*\{\}/.test(skillSig),
        'getTraitSkill stats default {} 보존 (reachable from gameUtils:23 1-arg caller)');
});

test('cycle 558: 정합성 가드 — callsite 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(/buildTraitSkill\(traitId,\s*player,\s*stats\)/.test(source),
        'buildTraitSkill 호출 보존');

    const sc = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(/getTraitBonus\(player,\s*preBuildStats\)/.test(sc),
        'statsCalculator getTraitBonus 호출 보존');
});

test('cycle 558: cycle 502-557 회귀 가드 — default 청소 시리즈 보존', async () => {
    const oa = await readSrc('src/utils/outcomeAnalysis.ts');
    assert.ok(!/getPostCombatAnalysis[^=]*result:\s*any\s*=\s*\{\}/.test(oa),
        'cycle 557 getPostCombatAnalysis result default 0건');

    const gu = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/formatRewardParts[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
        'cycle 556 formatRewardParts reward default 0건');
});
