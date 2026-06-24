import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 306: state.version dead state 제거 (gameReducer)
 *   (cycle 222-305 silent dead config 시리즈 76번째 — cleanup lens 연속).
 *
 * 발견 (dead state field):
 * - src/reducers/gameReducer.ts:
 *   - GameState interface에 version: number 선언.
 *   - INITIAL_STATE에 version: CONSTANTS.DATA_VERSION 초기화.
 *
 * 그러나 state.version에 대한 SET/UPDATE 핸들러 없음. UI/hook이 state.version
 * read 0건. useFirebaseSync는 매 save마다 `version: CONSTANTS.DATA_VERSION`을
 * 직접 기록 (state.version에 의존하지 않음).
 *
 * 패턴 (cycle 222-305 silent dead config 시리즈 76번째):
 * - cycle 305: publicGraves dead state 제거.
 * - cycle 306: state.version dead state 제거 — GameState 표면 1개 축소.
 *
 * 수정:
 * - gameReducer.ts: GameState interface version 필드 제거 + INITIAL_STATE 초기화 제거.
 *
 * 회귀 가드:
 * - useFirebaseSync.ts에서 save 시 직접 CONSTANTS.DATA_VERSION 기록 (영향 없음).
 * - gameUtils.migrateData()는 saved data의 .version 만 검사 (state와 무관).
 * - GameState 다른 필드 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 306: GameState interface version 필드 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/^\s*version:\s*number;/m.test(source),
        'GameState.version 타입 필드 제거됨');
});

test('cycle 306: INITIAL_STATE version 초기화 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/version:\s*CONSTANTS\.DATA_VERSION/.test(source),
        'INITIAL_STATE.version 초기화 제거됨');
});

test('cycle 306: useFirebaseSync save 시 CONSTANTS.DATA_VERSION 직접 기록 유지', async () => {
    const source = await readSrc('src/hooks/useFirebaseSync.ts');
    assert.ok(/version:\s*CONSTANTS\.DATA_VERSION/.test(source),
        'Firebase save version 기록 유지');
});

test('cycle 306: gameUtils.migrateData savedData.version 검사 유지', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/savedData\.version/.test(source),
        'migrateData savedData.version 검사 유지');
});

test('cycle 305 회귀 가드: publicGraves 제거 유지', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/publicGraves:\s*any\[\];/.test(source),
        'cycle 305 publicGraves 제거 유지');
});
