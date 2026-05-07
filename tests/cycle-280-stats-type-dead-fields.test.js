import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 280: Stats 타입의 dead 필드 cleanup (comboCount / discoveries)
 *   (cycle 222-279 silent dead config 시리즈 50번째 — cleanup lens 연속).
 *
 * 발견 (2 dead type 필드):
 * - src/types/player.ts Stats 인터페이스:
 *   - `comboCount?: number` (line 25): 대표적 전투 콤보 카운터지만 stats에는 한 번도 set/read 안 됨.
 *     실제 콤보는 player.combatFlags.comboCount (별도 위치)에 있음.
 *   - `discoveries?: number` (line 34): cycle 83/84에서 deprecated — visitedMaps.length로 통일.
 *     stats에 set 0건 / read 0건. 잔존 type 정의만 dead.
 * - 두 필드 모두 stats[key] 접근으로 set/read되지 않음 (다른 필드 / 다른 위치 있음).
 *
 * 패턴 (cycle 222-279 silent dead config 시리즈 50번째 — 50 milestone):
 * - cycle 270: tactical 12 fields 제거.
 * - cycle 277: totalPrestige 3 dead 필드 제거.
 * - cycle 278: killStreakTier 1 dead 필드 제거.
 * - cycle 279: stats 3 dead expose 필드 제거.
 * - cycle 280: Stats 타입 2 dead 필드 제거 (cleanup lens 연속).
 *
 * 수정:
 * 1) src/types/player.ts: Stats 인터페이스에서 comboCount / discoveries 제거.
 *
 * 회귀 가드:
 * - combatFlags.comboCount (별도 active 카운터) 영향 없음.
 * - visitedMaps 기반 discoveries 계산 (buildRunSummary line 690) 동작 유지.
 * - [key: string]: any index signature 유지로 잔존 saved 데이터 호환 보장.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 280: Stats 타입에서 comboCount 제거 (CombatFlags의 동명 필드는 유지)', async () => {
    const source = await readSrc('src/types/player.ts');
    // Stats interface 블록 (line 1-41) 내부의 comboCount만 검사.
    const statsBlockMatch = source.match(/export interface PlayerStats[\s\S]+?\n\}/);
    assert.ok(statsBlockMatch, 'PlayerStats interface 발견');
    assert.ok(!/comboCount\?:\s*number;/.test(statsBlockMatch[0]),
        'PlayerStats interface에서 comboCount 제거 (CombatFlags의 active comboCount는 별도)');
});

test('cycle 280: Stats 타입에서 discoveries 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(!/^\s+discoveries\?:\s*number;/m.test(source),
        'Stats.discoveries 필드 제거됨');
});

test('cycle 280: combatFlags.comboCount 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(/combatFlags:\s*\{\s*comboCount:\s*0/.test(source),
        'combatFlags.comboCount default 유지 (active 카운터)');
});

test('cycle 280: buildRunSummary의 discoveries 계산 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/discoveries:\s*\(\(player\.stats\s+as\s+any\)\?\.visitedMaps\s*\|\|\s*\[\]\)\.length/.test(source),
        'buildRunSummary discoveries = visitedMaps.length 계산 유지');
});

test('cycle 280: Stats 인터페이스 다른 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/types/player.ts');
    const requiredFields = [
        'kills', 'deaths', 'killRegistry', 'bossKills', 'rests',
        'bountyDate', 'bountyIssued', 'bountiesCompleted', 'relicCount',
        'crafts', 'abyssFloor', 'abyssRecord', 'demonKingSlain',
        'explores', 'lowHpWins', 'buildWins', 'visitedMaps',
    ];
    requiredFields.forEach((field) => {
        const re = new RegExp(`^\\s+${field}\\?:\\s*`, 'm');
        assert.ok(re.test(source), `Stats.${field} 필드 유지`);
    });
});

test('cycle 278-279 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    assert.ok(!/^\s*killStreakTier:/m.test(source), 'cycle 278 killStreakTier 0건');
    assert.ok(!/^\s*weaponHands:\s*preBuildStats/m.test(source), 'cycle 279 weaponHands 0건');
    assert.ok(!/^\s*traitBonus,$/m.test(source), 'cycle 279 traitBonus 0건');
    assert.ok(!/^\s*titlePassive,$/m.test(source), 'cycle 279 titlePassive 0건');
});
