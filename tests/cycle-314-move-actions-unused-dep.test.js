import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 314: moveActions 미사용 addStoryLog dependency 제거
 *   (cycle 222-313 silent dead config 시리즈 84번째 — cleanup lens 연속).
 *
 * 발견 (unused dep):
 * - src/hooks/gameActions/moveActions.ts: createMoveActions deps 구조분해에서
 *   addStoryLog 받지만 함수 내부에서 호출 0건. 마지막 라인에 `void addStoryLog;`
 *   자가-suppress가 lint 통과를 위해 존재.
 *
 * 비교: 다른 gameAction 파일들은 addStoryLog 활성 사용.
 * - characterActions.ts: addStoryLog('rest', ...) 호출.
 * - exploreActions.ts: addStoryLog('encounter', ...) 호출.
 * - useInventoryActions.ts: addStoryLog('questComplete', ...) 호출.
 *
 * 패턴 (cycle 222-313 silent dead config 시리즈 84번째):
 * - cycle 313: QuestRewardChips export → private downgrade.
 * - cycle 314: moveActions 미사용 addStoryLog dependency 정리.
 *
 * 수정 (src/hooks/gameActions/moveActions.ts):
 * - deps 구조분해에서 addStoryLog 제거.
 * - `void addStoryLog;` self-suppress 라인 제거.
 *
 * 회귀 가드:
 * - move action 동작 동일 — addStoryLog 호출 사이트 0건이라 변화 없음.
 * - useGameEngine deps 객체 자체에 addStoryLog는 그대로 전달 — 다른 액션 모듈에서 사용.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 314: moveActions deps 구조분해에서 addStoryLog 제거', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    // const { player, gameState, ..., addStoryLog } = deps; 라인에서 addStoryLog 0건.
    const destrLine = source.match(/const\s*\{\s*[^}]+\}\s*=\s*deps\s*;/);
    assert.ok(destrLine, 'deps 구조분해 라인 발견');
    assert.ok(!/addStoryLog/.test(destrLine[0]),
        'deps 구조분해에서 addStoryLog 제거됨');
});

test('cycle 314: moveActions void addStoryLog 자가-suppress 라인 제거', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    // void addStoryLog statement (실제 코드 라인) 제거 — 주석 mention은 허용.
    assert.ok(!/^\s*void addStoryLog;/m.test(source),
        'void addStoryLog 라인 제거됨');
});

test('cycle 314: moveActions move 액션 활성 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    assert.ok(/move:\s*\(loc/.test(source),
        'move 액션 정의 보존');
    assert.ok(/MOVE_ARRIVED/.test(source),
        'MOVE_ARRIVED 로그 dispatch 보존');
});

test('cycle 314: characterActions / exploreActions / useInventoryActions의 addStoryLog 활성 사용 보존', async () => {
    const characterSrc = await readSrc('src/hooks/gameActions/characterActions.ts');
    const exploreSrc = await readSrc('src/hooks/gameActions/exploreActions.ts');
    const invSrc = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/addStoryLog\('rest'/.test(characterSrc),
        'characterActions addStoryLog rest 사용 보존');
    assert.ok(/addStoryLog\('encounter'/.test(exploreSrc),
        'exploreActions addStoryLog encounter 사용 보존');
    assert.ok(/addStoryLog\('questComplete'/.test(invSrc),
        'useInventoryActions addStoryLog questComplete 사용 보존');
});

test('cycle 313 회귀 가드: QuestRewardChips private 유지', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(!/export const QuestRewardChips\b/.test(source),
        'cycle 313 QuestRewardChips private 유지');
});
