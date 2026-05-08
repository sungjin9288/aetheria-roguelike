import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 382: migrateData target.relics / target.titles normalizations 2회 redundant 정리
 *   (cycle 222-381 silent dead config 시리즈 146번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 array normalizations:
 *   · target.relics = Array.isArray(target.relics) ? target.relics : [];
 *   · target.titles = Array.isArray(target.titles) ? target.titles : [];
 * - 모든 consumer가 이미 fallback 처리:
 *   · player.relics:
 *     - statsCalculator: `player.relics || []` ✓
 *     - gameUtils:672: `player.relics?.length || 0` ✓
 *     - SystemTab:262/263: `(player.relics || []).length` / optional chain ✓
 *     - SystemTab:298/301/304: 298 line 가드 후 .length/.map (line 301/304는 가드 의존)
 *     - CombatPanel:90: `player.relics?.find(...)` ✓
 *   · player.titles:
 *     - gameUtils:555: `new Set(player.titles || [])` ✓
 *     - SystemTab:113/267/315: `player.titles || []` ✓
 *     - SystemTab:317/325: 315 line 가드 후 .length/.map
 *     - useInventoryActions:504: `Array.isArray(p.titles) ? p.titles : []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건 (inject-based assertion만).
 *
 * 패턴 (cycle 222-381 silent dead config 시리즈 146번째):
 * - cycle 381: status / skillLoadout.selected 2 redundant.
 * - cycle 382: relics / titles 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant array normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback 동작 그대로.
 * - target.relics / target.titles는 INITIAL_STATE에서 [] 초기화 (신규 플레이어).
 * - SystemTab 가드 패턴 (`(player.relics || []).length > 0` 등) 의존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 382: target.relics normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.relics = Array\.isArray\(target\.relics\)/m.test(block),
        'target.relics normalization 0건');
});

test('cycle 382: target.titles normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.titles = Array\.isArray\(target\.titles\)/m.test(block),
        'target.titles normalization 0건');
});

test('cycle 382: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            relics: [{ id: 'blood_pact', name: '피의 서약' }],
            titles: ['first_blood', 'centurion'],
        }
    });
    assert.equal(result.player.relics.length, 1, 'relics inject 보존');
    assert.deepEqual(result.player.titles, ['first_blood', 'centurion'],
        'titles inject 보존');
});

test('cycle 381 회귀 가드: status / skillLoadout.selected normalizations 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.status = Array\.isArray/m.test(block),
        'cycle 381 status normalization 0건 보존');
    assert.ok(!/^\s+target\.skillLoadout\.selected = Number\.isInteger/m.test(block),
        'cycle 381 skillLoadout.selected normalization 0건 보존');
});
