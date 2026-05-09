import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 386: migrateData dailyInvadeCount / lastInvadeDate fallback 2회 redundant 정리
 *   (cycle 222-385 silent dead config 시리즈 150번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/gameUtils.ts migrateData에 2 fallbacks:
 *   · target.stats.dailyInvadeCount = target.stats.dailyInvadeCount || 0;
 *   · target.stats.lastInvadeDate = target.stats.lastInvadeDate || null;
 * - 모든 consumer가 이미 fallback / 안전 비교 처리:
 *   · stats.dailyInvadeCount:
 *     - GravePanel:26: `(player?.stats?.dailyInvadeCount || 0)` ✓
 *     - useInventoryActions:589: `(player.stats?.dailyInvadeCount || 0)` ✓
 *     - multiplayerHandlers:24: `(state.player.stats?.dailyInvadeCount || 0)` ✓
 *   · stats.lastInvadeDate:
 *     - GravePanel:25: `player?.stats?.lastInvadeDate` (이후 strict equal 비교) ✓
 *     - useInventoryActions:588: 동일 패턴 ✓
 *     - multiplayerHandlers:23: 동일 패턴 ✓
 *     - undefined === today (false), null === today (false) — 동일 처리.
 * - cycle 216 회귀 가드 테스트는 inject 값 기반 assertion (post-ASCEND 보존),
 *   migrate output default 검증 안 함.
 *
 * 패턴 (cycle 222-385 silent dead config 시리즈 150번째):
 * - cycle 385: discoveryChains duplicate normalization 1 redundant.
 * - cycle 386: dailyInvadeCount / lastInvadeDate 2 redundant (defensive fallback lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback / strict equal 비교 동작 그대로.
 * - cycle 216 inject-based ASCEND preserve test 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 386: target.stats.dailyInvadeCount fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.dailyInvadeCount = target\.stats\.dailyInvadeCount/m.test(block),
        'target.stats.dailyInvadeCount fallback 0건');
});

test('cycle 386: target.stats.lastInvadeDate fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.lastInvadeDate = target\.stats\.lastInvadeDate/m.test(block),
        'target.stats.lastInvadeDate fallback 0건');
});

test('cycle 386: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 0, total_gold: 0, deaths: 0,
                dailyInvadeCount: 3, lastInvadeDate: '2026-05-09',
            },
        }
    });
    assert.equal(result.player.stats.dailyInvadeCount, 3,
        'dailyInvadeCount inject 보존');
    assert.equal(result.player.stats.lastInvadeDate, '2026-05-09',
        'lastInvadeDate inject 보존');
});

test('cycle 385 회귀 가드: discoveryChains normalization 1회만 (중복 제거)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.discoveryChains = Array\.isArray/gm) || [];
    assert.equal(matches.length, 1, 'cycle 385 discoveryChains normalization 1회만 보존');
});
