import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 277: meta.totalPrestigeAtk / Hp / Mp 3 dead 필드 cleanup
 *   (cycle 222-276 silent dead config 시리즈 47번째 — cleanup lens 연속).
 *
 * 발견 (3 dead persistent state 필드):
 * - ASCEND가 meta.totalPrestigeAtk/Hp/Mp 필드를 +PRESTIGE_X_BONUS로 누적 (line 22-24).
 * - 그러나 이 필드들은 src/ 어디에서도 read 0건 — 통계 / UI / stats 계산 어디에도 dispatch 안 됨.
 * - bonusAtk/Hp/Mp 필드와 별개로 누적되지만 (essence rank up도 추가 source), 'lifetime
 *   prestige tracker' 의도였을 듯한 dead state.
 * - 4 places에서 write (INITIAL_STATE / ASCEND / migrateData / types/player.ts) 0 places에서 read.
 *
 * 패턴 (cycle 222-276 silent dead config 시리즈 47번째):
 * - cycle 267-271: cleanup 시리즈 (skillLabel / secondary / tactical 12 fields / 4 dead exports).
 * - cycle 277: persistent state field cleanup (write-only 3 fields).
 *
 * 수정:
 * 1) src/hooks/gameActions/ascensionActions.ts: ASCEND meta build에서 3 필드 제거.
 * 2) src/reducers/gameReducer.ts INITIAL_STATE: meta에서 3 필드 제거.
 * 3) src/utils/gameUtils.ts migrateData: 3 필드 default 정규화 제거.
 * 4) src/types/player.ts: 3 필드 type 정의 제거 (optional이라 영향 없음).
 *
 * 회귀 가드:
 * - bonusAtk/Hp/Mp 필드 동작 유지 (active applied bonus).
 * - prestigeRank / essence / bonusAtk 등 다른 meta 필드 변화 없음.
 * - ASCEND 다른 동작 (titles / stats preserve / projectedPlayer 등) 변화 없음.
 *
 * Note: 기존 save 데이터에 잔존 필드는 안전 (TypeScript optional + 사용 안 하므로 무해).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 277: ASCEND meta build에서 totalPrestige 3 필드 제거', async () => {
    const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
    assert.ok(!/totalPrestigeAtk:/.test(source), 'totalPrestigeAtk 제거됨');
    assert.ok(!/totalPrestigeHp:/.test(source), 'totalPrestigeHp 제거됨');
    assert.ok(!/totalPrestigeMp:/.test(source), 'totalPrestigeMp 제거됨');
});

test('cycle 277: INITIAL_STATE.player.meta에서 totalPrestige 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/totalPrestigeAtk:\s*0/.test(source), 'INITIAL_STATE totalPrestigeAtk 제거');
});

test('cycle 277: migrateData에서 totalPrestige 정규화 제거', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/totalPrestigeAtk\s*=/.test(source), 'migrateData totalPrestigeAtk 제거');
});

test('cycle 277: bonusAtk/Hp/Mp 활성 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
    assert.ok(/bonusAtk:\s+\(meta\.bonusAtk/.test(source), 'ASCEND bonusAtk 누적 유지');
    assert.ok(/bonusHp:\s+\(meta\.bonusHp/.test(source), 'ASCEND bonusHp 누적 유지');
    assert.ok(/bonusMp:\s+\(meta\.bonusMp/.test(source), 'ASCEND bonusMp 누적 유지');
});

test('cycle 277: ASCEND prestigeRank / essence / titles 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
    assert.ok(/prestigeRank:\s+rank/.test(source), 'prestigeRank dispatch 유지');
    assert.ok(/essence:\s+\(meta\.essence/.test(source), 'essence 누적 유지');
    assert.ok(/titles:\s+\[\.\.\./.test(source), 'titles unique merge 유지');
});
