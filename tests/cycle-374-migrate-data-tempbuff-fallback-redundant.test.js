import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 374: migrateData target.tempBuff.X || 0 fallback 3회 redundant 정리
 *   (cycle 222-373 silent dead config 시리즈 139번째 — cleanup lens 연속).
 *
 * 발견 (3 redundant defensive fallbacks):
 * - src/utils/gameUtils.ts migrateData에 3 sub-field fallback lines:
 *   `target.tempBuff.atk = target.tempBuff.atk || 0;`
 *   `target.tempBuff.def = target.tempBuff.def || 0;`
 *   `target.tempBuff.turn = target.tempBuff.turn || 0;`
 * - 직전 라인 377: `target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null }`
 *   가 객체 자체를 default로 초기화 (legacy save에 tempBuff 누락 시 기본 보장).
 * - 모든 consumer가 이미 fallback 처리 또는 reconstruction:
 *   · statsCalculator.ts:332: `(1 + (buff.atk || 0) + ...)` — `|| 0` fallback.
 *   · statsCalculator.ts:341: `(1 + (buff.def || 0) + ...)` — `|| 0` fallback.
 *   · playerStateUtils.ts:40: `{ ...EMPTY_TEMP_BUFF, ...(player?.tempBuff || {}) }` —
 *     EMPTY_TEMP_BUFF 병합으로 sub-field 보장.
 *   · CombatEngine.ts:1017: tempBuff.turn 읽기는 스킬 활성 직후 발생, 이미 실제 값 set됨.
 *
 * 패턴 (cycle 222-373 silent dead config 시리즈 139번째):
 * - cycle 373: migrateData meta sub-field fallback 5 redundant.
 * - cycle 374: migrateData tempBuff sub-field fallback 3 redundant (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 3 redundant `target.tempBuff.X = target.tempBuff.X || 0` lines 제거.
 *
 * 회귀 가드:
 * - 라인 377의 `target.tempBuff = target.tempBuff || { ... }` 보존 (객체 초기화 핵심).
 * - statsCalculator `|| 0` fallback consumer 동작 그대로.
 * - playerStateUtils EMPTY_TEMP_BUFF 병합 패턴 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 374: migrateData target.tempBuff.X || 0 fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.tempBuff\.(atk|def|turn) = target\.tempBuff\./g) || [];
    assert.equal(matches.length, 0,
        `target.tempBuff.X = target.tempBuff.X || 0 fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 374: migrateData tempBuff 객체 초기화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/target\.tempBuff = target\.tempBuff \|\| \{ atk: 0, def: 0, turn: 0/.test(source),
        'target.tempBuff = target.tempBuff || {...defaults} 보존');
});

test('cycle 374: migrateData 동작 보존 (tempBuff 누락 시 default)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player.tempBuff, 'tempBuff 객체 보존');
    assert.equal(result.player.tempBuff.atk, 0, 'tempBuff.atk default');
    assert.equal(result.player.tempBuff.def, 0, 'tempBuff.def default');
    assert.equal(result.player.tempBuff.turn, 0, 'tempBuff.turn default');
});

test('cycle 373 회귀 가드: meta sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const matches = source.match(/target\.meta\.(essence|rank|bonusAtk|bonusHp|bonusMp) = target\.meta\./g) || [];
    assert.equal(matches.length, 0, 'cycle 373 meta sub-field fallback 0건 보존');
});
