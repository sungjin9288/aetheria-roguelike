import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 281: PlayerMeta 타입의 dead 필드 cleanup (totalPrestigeAtk / Hp / Mp)
 *   (cycle 222-280 silent dead config 시리즈 51번째 — cycle 277 paired completion).
 *
 * 발견 (cycle 277 paired):
 * - cycle 277에서 ASCEND / INITIAL_STATE / migrateData 3 places의 write-only 3 필드 제거.
 * - 그러나 type 정의 (PlayerMeta interface)는 잔존 — saved 데이터 호환 우려로 보존했음.
 * - 재검토: src/ 전체에서 read 0건 확정. 잔존 saved 데이터에 필드 있어도 type 제거하면
 *   index signature 없는 PlayerMeta interface가 TS 오류 가능성 있지만, runtime에서 access
 *   안 하므로 영향 없음.
 *
 * 패턴 (cycle 222-280 silent dead config 시리즈 51번째):
 * - cycle 277: totalPrestige write-only runtime 제거.
 * - cycle 280: PlayerStats 타입 dead 필드 제거.
 * - cycle 281: PlayerMeta 타입 dead 필드 제거 (cycle 277 paired completion).
 *
 * 수정:
 * 1) src/types/player.ts: PlayerMeta에서 totalPrestigeAtk/Hp/Mp 3 필드 제거.
 *
 * 회귀 가드:
 * - 다른 PlayerMeta 필드 (essence/rank/bonusAtk/bonusHp/bonusMp/prestigeRank) 유지.
 * - cycle 277 runtime cleanup 동작 유지.
 * - 잔존 saved 데이터의 totalPrestige* 필드는 무시되지만 runtime 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 281: PlayerMeta에서 totalPrestigeAtk 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    const metaBlock = source.match(/export interface PlayerMeta[\s\S]+?\n\}/);
    assert.ok(metaBlock, 'PlayerMeta interface 발견');
    assert.ok(!/totalPrestigeAtk\?:/.test(metaBlock[0]), 'totalPrestigeAtk 제거됨');
});

test('cycle 281: PlayerMeta에서 totalPrestigeHp / Mp 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    const metaBlock = source.match(/export interface PlayerMeta[\s\S]+?\n\}/);
    assert.ok(metaBlock);
    assert.ok(!/totalPrestigeHp\?:/.test(metaBlock[0]), 'totalPrestigeHp 제거됨');
    assert.ok(!/totalPrestigeMp\?:/.test(metaBlock[0]), 'totalPrestigeMp 제거됨');
});

test('cycle 281: PlayerMeta active 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/types/player.ts');
    const metaBlock = source.match(/export interface PlayerMeta[\s\S]+?\n\}/);
    assert.ok(metaBlock);
    const requiredFields = ['essence', 'rank', 'bonusAtk', 'bonusHp', 'bonusMp', 'prestigeRank'];
    requiredFields.forEach((field) => {
        const re = new RegExp(`${field}\\?:\\s*number`);
        assert.ok(re.test(metaBlock[0]), `PlayerMeta.${field} 유지`);
    });
});

test('cycle 277 회귀 가드: totalPrestige runtime 0건 유지', async () => {
    const sources = await Promise.all([
        readSrc('src/hooks/gameActions/ascensionActions.ts'),
        readSrc('src/reducers/gameReducer.ts'),
    ]);
    sources.forEach((src, i) => {
        // cleanup 주석 외에 실제 코드 라인 (`totalPrestigeAtk: ` 같은 field assign) 0건 검증.
        assert.ok(!/^\s+totalPrestigeAtk:/m.test(src),
            `[file ${i}] totalPrestigeAtk 코드 라인 0건 (cycle 277)`);
    });
});
