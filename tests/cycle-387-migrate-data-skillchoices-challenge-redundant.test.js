import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 387: migrateData skillChoices / challengeModifiers normalizations 2회 redundant 정리
 *   (cycle 222-386 silent dead config 시리즈 151번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 normalizations:
 *   · target.skillChoices = target.skillChoices && typeof ... === 'object' ? : {};
 *   · target.challengeModifiers = Array.isArray(target.challengeModifiers) ? : [];
 * - 모든 consumer가 이미 fallback / optional chain 처리:
 *   · skillChoices:
 *     - SkillTreePreview:186/379: `player.skillChoices?.[skill.name]` ✓
 *     - characterActions:107: `player.skillChoices?.[skillName] || '기본'` ✓
 *     - characterActions:113: `{ ...(p.skillChoices || {}), [skillName]: ... }` ✓
 *     - CombatEngine:683: `player.skillChoices?.[skill.name]` ✓
 *     - multiplayerHandlers:11: `{ ...(state.player.skillChoices || {}), ... }` ✓
 *   · challengeModifiers:
 *     - exploreUtils:198: `player.challengeModifiers?.includes('eliteOnly')` ✓
 *     - StatusBar:156: `player.challengeModifiers?.includes('blindMap')` ✓
 *     - useInventoryActions:107: `player.challengeModifiers?.includes('noPotion')` ✓
 *     - combatAttack:32: `playerAtActionStart.challengeModifiers?.includes('randomSkills')` ✓
 *     - characterActions:20: `Array.isArray(challengeModifiers) ? : []` ✓
 *     - CombatEngine:1421: `p.challengeModifiers || []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-386 silent dead config 시리즈 151번째):
 * - cycle 386: dailyInvadeCount / lastInvadeDate 2 redundant.
 * - cycle 387: skillChoices / challengeModifiers 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer optional chain / `|| []` / `|| {}` 동작 그대로.
 * - target.weeklyProtocol 객체 init은 보존 (`if (!target.weeklyProtocol) { ... }`).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 387: target.skillChoices normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillChoices = target\.skillChoices/m.test(block),
        'target.skillChoices normalization 0건');
});

test('cycle 387: target.challengeModifiers normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.challengeModifiers = Array\.isArray/m.test(block),
        'target.challengeModifiers normalization 0건');
});

test('cycle 387: target.weeklyProtocol 객체 init 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/if \(!target\.weeklyProtocol\)/.test(source),
        'target.weeklyProtocol 객체 init 보존');
});

test('cycle 387: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            skillChoices: { '강타': 'A' },
            challengeModifiers: ['halfHp', 'noGold'],
        }
    });
    assert.deepEqual(result.player.skillChoices, { '강타': 'A' },
        'skillChoices inject 보존');
    assert.deepEqual(result.player.challengeModifiers, ['halfHp', 'noGold'],
        'challengeModifiers inject 보존');
});

test('cycle 386 회귀 가드: dailyInvadeCount / lastInvadeDate fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.dailyInvadeCount = target\.stats\.dailyInvadeCount/m.test(block),
        'cycle 386 dailyInvadeCount fallback 0건 보존');
    assert.ok(!/^\s+target\.stats\.lastInvadeDate = target\.stats\.lastInvadeDate/m.test(block),
        'cycle 386 lastInvadeDate fallback 0건 보존');
});
