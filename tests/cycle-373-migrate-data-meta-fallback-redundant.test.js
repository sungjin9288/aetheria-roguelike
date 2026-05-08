import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 373: migrateData target.meta.X || 0 fallback 5회 redundant 정리
 *   (cycle 222-372 silent dead config 시리즈 138번째 — cleanup lens 연속).
 *
 * 발견 (5 redundant defensive fallbacks):
 * - src/utils/gameUtils.ts migrateData에 5 lines:
 *   `target.meta.essence = target.meta.essence || 0;`
 *   `target.meta.rank = target.meta.rank || 0;`
 *   `target.meta.bonusAtk = target.meta.bonusAtk || 0;`
 *   `target.meta.bonusHp = target.meta.bonusHp || 0;`
 *   `target.meta.bonusMp = target.meta.bonusMp || 0;`
 * - 직전 라인 385: `target.meta = target.meta || { essence: 0, rank: 0, ... }`
 *   가 없으면 객체 자체를 default로 초기화. 5 fallback은 부분 객체 보호용.
 * - 모든 consumer가 이미 fallback 처리:
 *   · StatsPanel: `player.meta.essence || 0` 등 (4곳).
 *   · CombatEngine.ts:1468: `const meta = { ...this.DEFAULT_META, ...(p.meta || {}) }`
 *     로컬 reconstruction에 DEFAULT_META 병합 — undefined → 0.
 * - migrateData의 5 fallback은 production read 안전망 중복.
 *
 * 패턴 (cycle 222-372 silent dead config 시리즈 138번째):
 * - cycle 372: maps safe-zone monsters: [] 5 redundant.
 * - cycle 373: migrateData meta fallback 5 redundant defensive.
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 5 redundant `target.meta.X = target.meta.X || 0` lines 제거.
 *
 * 회귀 가드:
 * - 라인 385의 `target.meta = target.meta || { ... }` 보존 (객체 초기화 핵심).
 * - StatsPanel `|| 0` fallback consumer 동작 그대로.
 * - CombatEngine DEFAULT_META 병합 패턴 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 373: migrateData target.meta.X || 0 fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.meta\.(essence|rank|bonusAtk|bonusHp|bonusMp) = target\.meta\./g) || [];
    assert.equal(matches.length, 0,
        `target.meta.X = target.meta.X || 0 fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 373: migrateData meta 객체 초기화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/target\.meta = target\.meta \|\| \{ essence: 0, rank: 0/.test(source),
        'target.meta = target.meta || {...defaults} 보존');
});

test('cycle 373: migrateData 동작 보존 (meta 누락 시 default)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // meta 자체 누락 → 객체 초기화로 default 채워짐.
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player.meta, 'meta 객체 보존');
    assert.equal(result.player.meta.essence, 0, 'meta.essence default');
    assert.equal(result.player.meta.rank, 0, 'meta.rank default');
});

test('cycle 372 회귀 가드: maps safe-zone monsters: [] 0건 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/monsters: \[\]/g) || [];
    assert.equal(matches.length, 0, 'cycle 372 monsters: [] 0건 보존');
});
