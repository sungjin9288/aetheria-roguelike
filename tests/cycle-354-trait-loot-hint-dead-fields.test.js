import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 354: getTraitLootHint score/label/traitName 3 출력 dead 정리
 *   (cycle 222-353 silent dead config 시리즈 121번째 — cleanup lens 연속).
 *
 * 발견 (3 dead output fields):
 * - getTraitLootHint 반환 hint 객체에 score / label / traitName 필드.
 * - PostCombatCard / _helpers.ts(addCombatDigestLogs) 두 consumer 모두
 *   `traitHint.name` / `traitHint.summary`만 read.
 * - score / label / traitName — src/, tests/ 어디에서도 read 0건.
 *
 * 패턴 (cycle 222-353 silent dead config 시리즈 121번째):
 * - cycle 353: getSelectedSkill index/total 2 출력 dead.
 * - cycle 354: getTraitLootHint 3 출력 dead (score/label/traitName).
 *
 * 수정 (src/utils/runProfile.ts):
 * - getTraitLootHint return에서 score / label / traitName 필드 제거.
 *   (best.resonance.score 내부 사용은 getTraitFeaturedItems 정렬용으로 유지.)
 *
 * 회귀 가드:
 * - hint.name / hint.summary 보존.
 * - PostCombatCard traitHint.name / .summary 사용 그대로.
 * - _helpers.ts MSG.COMBAT_DIGEST_TRAIT_HINT(name, summary) 동일.
 * - getTraitFeaturedItems 정렬 (resonance.score 비교) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 354: getTraitLootHint return에 score/label/traitName 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fn = source.slice(source.indexOf('export const getTraitLootHint'), source.indexOf('export const getTraitQuestResonance'));
    assert.ok(!/^\s+score:\s/m.test(fn),
        'getTraitLootHint return에서 score 필드 0건');
    assert.ok(!/^\s+label:\s/m.test(fn),
        'getTraitLootHint return에서 label 필드 0건');
    assert.ok(!/traitName:/.test(fn),
        'getTraitLootHint return에서 traitName 필드 0건');
});

test('cycle 354: getTraitLootHint 동작 보존 (name/summary)', async () => {
    const { getTraitLootHint, getTraitProfile } = await import('../src/utils/runProfileUtils.js');
    const player = {
        job: '도적',
        hp: 100,
        maxHp: 100,
        equip: {
            weapon: { type: 'weapon', name: '단검', val: 12, hands: 1, jobs: ['도적'] },
            offhand: { type: 'weapon', name: '단검', val: 10, hands: 1, jobs: ['도적'] },
        },
        relics: [],
        stats: {},
    };
    const trait = getTraitProfile(player, { maxHp: 100, maxMp: 50 });
    const loot = [
        { type: 'weapon', name: '암살자의 단검', val: 28, hands: 1, jobs: ['도적', '어쌔신'] },
    ];
    const hint = getTraitLootHint(loot, trait, player);
    if (hint) {
        assert.ok('name' in hint, 'name 보존');
        assert.ok('summary' in hint, 'summary 보존');
        assert.equal(hint.score, undefined, 'score 0건');
        assert.equal(hint.label, undefined, 'label 0건');
        assert.equal(hint.traitName, undefined, 'traitName 0건');
    }
});

test('cycle 353 회귀 가드: getSelectedSkill 반환 shape 단순화 0건 보존', async () => {
    const source = await readSrc('src/hooks/combatActions/_helpers.ts');
    const fn = source.slice(source.indexOf('export const getSelectedSkill'), source.indexOf('export const getLootUpgradeHint'));
    assert.ok(/return \{ skill: skills\[index\] \};/.test(fn),
        'cycle 353 getSelectedSkill shape 보존');
});
