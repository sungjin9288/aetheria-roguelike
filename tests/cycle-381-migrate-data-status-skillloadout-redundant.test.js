import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 381: migrateData status / skillLoadout.selected normalizations 2회 redundant 정리
 *   (cycle 222-380 silent dead config 시리즈 145번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 normalizations:
 *   · target.status = Array.isArray(target.status) ? target.status : [];
 *   · target.skillLoadout.selected = Number.isInteger(target.skillLoadout.selected)
 *     ? target.skillLoadout.selected : 0;
 * - 모든 consumer가 이미 동일 패턴 fallback 처리:
 *   · player.status:
 *     - playerStateUtils:52: `Array.isArray(player?.status) && player.status.length > 0` ✓
 *     - adventureGuide:284: `Array.isArray(player?.status) && ...` ✓
 *     - exploreUtils:94: `[...(p.status || []), ...]` — `|| []` fallback ✓
 *     - StatusBar:166: `Array.isArray(player.status) && ...` ✓
 *     - useInventoryActions:144 / combatItem:37: `toArray(player.status)` ✓
 *     - CombatEngine:438: `Array.isArray(player.status) ? : []` ✓
 *   · player.skillLoadout.selected:
 *     - getSelectedSkill: `Number.isInteger(player.skillLoadout?.selected) ? : 0` ✓
 *     - characterActions:46: 동일 패턴 ✓
 *
 * 패턴 (cycle 222-380 silent dead config 시리즈 145번째):
 * - cycle 379: claimedAchievements normalization 1 redundant.
 * - cycle 381: status / skillLoadout.selected 2 redundant (동일 lens 재개).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer Array.isArray / Number.isInteger 패턴 동작 그대로.
 * - target.skillLoadout.cooldowns 정규화 보존 (CombatEngine 직접 assign 의존).
 * - target.skillLoadout 객체 자체 init 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 381: target.status normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.status = Array\.isArray\(target\.status\)/m.test(block),
        'target.status normalization 0건');
});

test('cycle 381: target.skillLoadout.selected normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillLoadout\.selected = Number\.isInteger/m.test(block),
        'target.skillLoadout.selected normalization 0건');
});

test('cycle 381: skillLoadout 객체 init / cooldowns 정규화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/target\.skillLoadout = target\.skillLoadout \|\| \{ selected: 0, cooldowns: \{\} \}/.test(source),
        'target.skillLoadout 객체 init 보존');
    assert.ok(/target\.skillLoadout\.cooldowns = target\.skillLoadout\.cooldowns \|\| \{\}/.test(source),
        'target.skillLoadout.cooldowns 정규화 보존 (CombatEngine 직접 assign 의존)');
});

test('cycle 381: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            status: ['burn', 'poison'],
            skillLoadout: { selected: 2, cooldowns: { '강타': 1 } },
        }
    });
    assert.deepEqual(result.player.status, ['burn', 'poison'],
        'status inject 보존');
    assert.equal(result.player.skillLoadout.selected, 2,
        'skillLoadout.selected inject 보존');
});

test('cycle 379 회귀 가드: claimedAchievements normalization 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.claimedAchievements = Array\.isArray/m.test(block),
        'cycle 379 claimedAchievements normalization 0건 보존');
});
