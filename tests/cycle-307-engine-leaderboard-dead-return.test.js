import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 307: useGameEngine 반환 객체에서 leaderboard top-level 제거 (dead return)
 *   (cycle 222-306 silent dead config 시리즈 77번째 — cleanup lens 연속).
 *
 * 발견 (dead return field):
 * - src/hooks/useGameEngine.ts: 반환 객체 line 174에 `leaderboard` top-level export.
 *   - actions 객체 (line 147) 안에도 leaderboard 포함 (별도 channel).
 *
 * 그러나 `engine.leaderboard` (top-level) 접근 0건. SystemTab.tsx:192/381은
 * `actions.leaderboard` (= engine.actions.leaderboard) 경로로만 read.
 *
 * 패턴 (cycle 222-306 silent dead config 시리즈 77번째):
 * - cycle 306: state.version dead 제거.
 * - cycle 307: useGameEngine top-level leaderboard return dead 제거.
 *
 * 수정:
 * - useGameEngine.ts: 반환 객체에서 leaderboard 필드 제거.
 *
 * 회귀 가드:
 * - actions 객체 내 leaderboard 유지 — SystemTab actions.leaderboard 경로 영향 없음.
 * - 다른 top-level 반환 필드 (player, gameState, logs, enemy, ...) 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 307: useGameEngine 반환 객체 top-level leaderboard 제거', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    // useGameEngine 반환 (return { ... };) 블록 마지막 영역 추출.
    const returnBlock = source.match(/return\s*\{\s*\n([\s\S]+?)\n\s*\};\s*\}\s*;\s*$/m);
    assert.ok(returnBlock, 'useGameEngine return 블록 발견');
    // top-level (들여쓰기 4칸 또는 8칸) 의 leaderboard 키 0건이어야 함.
    assert.ok(!/^\s{4,8}leaderboard,/m.test(returnBlock[1]),
        'top-level leaderboard 반환 제거');
});

test('cycle 307: useGameEngine actions 내부 leaderboard 유지', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    // actions 객체 내 leaderboard 필드는 그대로.
    assert.ok(/leaderboard,?\s*\n\s*getFullStats/.test(source) || /leaderboard,/.test(source),
        'actions.leaderboard 경로 유지');
});

test('cycle 307: SystemTab actions.leaderboard 경로 사용 보존', async () => {
    const source = await readSrc('src/components/tabs/SystemTab.tsx');
    assert.ok(/actions\.leaderboard/.test(source),
        'SystemTab actions.leaderboard 경로 보존');
});

test('cycle 306 회귀 가드: state.version 제거 유지', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/^\s*version:\s*number;/m.test(source),
        'cycle 306 state.version 제거 유지');
});
