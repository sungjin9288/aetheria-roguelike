import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 352: getLootUpgradeHint score 출력 dead 정리
 *   (cycle 222-351 silent dead config 시리즈 119번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - getLootUpgradeHint 반환 hint 객체에 score 필드 — 함수 내부 비교용으로만 사용,
 *   외부 read 0건. PostCombatCard / addCombatDigestLogs는 hint.name / hint.summary만 read.
 *
 * 패턴 (cycle 222-351 silent dead config 시리즈 119번째):
 * - cycle 351: getTraitProfile 3 redundant override 정리.
 * - cycle 352: getLootUpgradeHint score → bestScore internal 변수로 변경.
 *
 * 수정 (src/hooks/combatActions/_helpers.ts):
 * - candidate 객체 생성 후 bestHint 비교 → bestScore 별도 변수로 비교.
 * - bestHint 객체에 score 필드 노출 0건.
 *
 * 회귀 가드:
 * - bestHint.name / bestHint.summary 보존.
 * - PostCombatCard upgradeHint.name / .summary 사용 그대로.
 * - addCombatDigestLogs MSG.COMBAT_DIGEST_EQUIP_UPGRADE(name, summary) 동일.
 * - 정렬 순서 동일 (최고 score 선택).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 352: getLootUpgradeHint score 출력 0건', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fn = source.slice(source.indexOf('export const getLootUpgradeHint'));
    // bestHint 객체 안에 score 필드 0건.
    assert.ok(!/bestHint = \{ name:[^}]*score,/.test(fn),
        'bestHint name/summary만 보존, score 0건');
    assert.ok(/let bestScore =/.test(fn),
        'bestScore internal 변수 도입');
});

test('cycle 352: getLootUpgradeHint 동작 보존 (최고 score 선택)', async () => {
    const { getLootUpgradeHint } = await import('../src/hooks/combatActions/_helpers.js');
    const equip = { weapon: { name: '녹슨 단검', type: 'weapon', val: 5, hands: 1 }, armor: { name: '튜닉', type: 'armor', val: 3 } };
    const lootItems = [
        { name: '강철 롱소드', type: 'weapon', val: 12, hands: 1 },
        { name: '낡은 단검', type: 'weapon', val: 4, hands: 1 },
    ];
    const hint = getLootUpgradeHint(equip, lootItems);
    if (hint) {
        assert.ok('name' in hint, 'name 보존');
        assert.ok('summary' in hint, 'summary 보존');
        assert.equal(hint.score, undefined, 'score 출력 0건');
    }
});

test('cycle 351 회귀 가드: getTraitProfile 3 redundant override 0건 보존', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
    assert.ok(!/rewardFocus: definition\.rewardFocus/.test(fn),
        'cycle 351 rewardFocus override 0건 보존');
});
