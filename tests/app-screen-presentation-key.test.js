// 다듬기(2026-10-30): 생명 변화 연출의 기준은 복원(`presentationEpoch`)과 화면 전환이다 — 새 여정의 시작(인트로 → 게임)과
// 사망 뒤 다시 시작은 생명을 새로 정하는 전이라 회복 숫자를 띄우지 않는다. 렌더 경로는 e2e `intro.spec.ts`가 잡는다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { getAppScreen, getPresentationKey, nextCombatExitTrack } from '../src/utils/appScreen.ts';
import { GS } from '../src/reducers/gameStates.ts';

const base = { bootStage: 'ready', gameState: GS.IDLE, hasRunSummary: false, playerName: '아르덴' };

test('App screen follows the same branch order as the render', () => {
    assert.equal(getAppScreen({ ...base, bootStage: 'auth' }), 'boot');
    assert.equal(getAppScreen({ ...base, gameState: GS.DEAD, hasRunSummary: true }), 'dead');
    assert.equal(getAppScreen({ ...base, gameState: GS.DEAD, hasRunSummary: false }), 'game');
    assert.equal(getAppScreen({ ...base, playerName: '   ' }), 'intro');
    assert.equal(getAppScreen({ ...base, playerName: undefined }), 'intro');
    assert.equal(getAppScreen(base), 'game');
});

test('presentation key changes when the screen changes, not when the player acts', () => {
    const intro = getPresentationKey(0, getAppScreen({ ...base, playerName: '' }));
    const game = getPresentationKey(0, getAppScreen(base));
    const dead = getPresentationKey(0, getAppScreen({ ...base, gameState: GS.DEAD, hasRunSummary: true }));
    assert.notEqual(intro, game);
    assert.notEqual(game, dead);
    assert.equal(getPresentationKey(0, getAppScreen({ ...base, gameState: GS.COMBAT })), game);
    assert.notEqual(getPresentationKey(1, 'game'), game);
});

// 재미 분석 F5(2026-11): 승리 정산의 회복은 전투를 끝내는 같은 전이에서 일어난다 — 그 렌더는 필드 화면이라
// 화면 가운데 숫자가 임무 카드 위에 떴다. 전투가 끝날 때만 기준이 바뀌고, 들어갈 때 · 전투 안의 차례는 그대로다.
test('combat exit count rises only when combat ends', () => {
    const field = { inCombat: false, exits: 0 };
    const entered = nextCombatExitTrack(field, true);
    assert.equal(entered.exits, 0, 'entering combat keeps the key');
    assert.equal(nextCombatExitTrack(entered, true), entered, 'turns inside combat return the same track');
    const left = nextCombatExitTrack(entered, false);
    assert.equal(left.exits, 1, 'leaving combat moves the key');
    assert.equal(nextCombatExitTrack(left, false), left, 'field actions return the same track');
    assert.equal(nextCombatExitTrack(nextCombatExitTrack(left, true), false).exits, 2);
    assert.notEqual(getPresentationKey(0, 'game', 0), getPresentationKey(0, 'game', 1));
    assert.equal(getPresentationKey(0, 'game'), getPresentationKey(0, 'game', 0));
});
