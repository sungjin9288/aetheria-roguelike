import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 383: migrateData codexClaimed normalization 1회 redundant 정리
 *   (cycle 222-382 silent dead config 시리즈 147번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/gameUtils.ts migrateData에 1 array normalization:
 *   · target.stats.codexClaimed = Array.isArray(...) ? ... : [];
 * - 모든 consumer가 이미 fallback 처리:
 *   · Codex.tsx:39: `player?.stats?.codexClaimed || []` ✓
 *   · rewardHandlers:68: `state.player.stats?.codexClaimed || []` ✓
 *   · progressionHandlers:67: `Array.isArray(prevStats.codexClaimed) ? : []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 * - cosmeticTitles는 cycle 189 회귀 가드 (`assert.deepEqual(stats.cosmeticTitles, [])`)로
 *   fallback 보존 필수 (시도 후 발견된 가드).
 *
 * 패턴 (cycle 222-382 silent dead config 시리즈 147번째):
 * - cycle 382: relics / titles normalizations 2 redundant.
 * - cycle 383: codexClaimed normalization 1 redundant (동일 lens, cosmeticTitles 가드 발견).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - codexClaimed normalization 1 라인 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback / Array.isArray 동작 그대로.
 * - cosmeticTitles 정규화 보존 (cycle 189 migrate output 가드).
 * - reviveTokens / synthProtects Math.max(0, ...) 정규화 보존 (negative 클램핑 의존).
 * - premiumCurrency `|| 0` 보존 (StatusBar 직접 표시 의존).
 * - claimedQuestIds / visitedMaps / exploreState 기존 보존 가드 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 383: target.stats.codexClaimed normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.codexClaimed = Array\.isArray/m.test(block),
        'target.stats.codexClaimed normalization 0건');
});

test('cycle 383: target.stats.cosmeticTitles normalization 보존 (cycle 189 회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/target\.stats\.cosmeticTitles = Array\.isArray/.test(block),
        'cycle 189 cosmeticTitles normalization 보존');
});

test('cycle 383: 보존되어야 할 정규화 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    // reviveTokens / synthProtects는 Math.max(0, ...) 보존 — 음수 클램핑 필요.
    assert.ok(/target\.reviveTokens = Math\.max\(0, Number/.test(source),
        'reviveTokens Math.max 보존 (음수 클램핑)');
    assert.ok(/target\.stats\.synthProtects = Math\.max\(0, Number/.test(source),
        'synthProtects Math.max 보존 (음수 클램핑)');
    assert.ok(/target\.premiumCurrency = target\.premiumCurrency \|\| 0/.test(source),
        'premiumCurrency `|| 0` 보존 (StatusBar 직접 표시)');
});

test('cycle 383: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                codexClaimed: ['weapons_5', 'monsters_10'],
                cosmeticTitles: ['title_stargazer'],
            }
        }
    });
    assert.deepEqual(result.player.stats.codexClaimed, ['weapons_5', 'monsters_10'],
        'codexClaimed inject 보존');
    assert.deepEqual(result.player.stats.cosmeticTitles, ['title_stargazer'],
        'cosmeticTitles inject 보존 (cycle 189 가드)');
});

test('cycle 382 회귀 가드: relics / titles normalizations 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.relics = Array\.isArray/m.test(block),
        'cycle 382 relics normalization 0건 보존');
    assert.ok(!/^\s+target\.titles = Array\.isArray/m.test(block),
        'cycle 382 titles normalization 0건 보존');
});
