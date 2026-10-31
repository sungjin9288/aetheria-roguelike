// 다듬기(2026-10-30): 생명 변화 연출의 기준은 복원(`presentationEpoch`)과 화면 전환이다 — 새 여정의 시작(인트로 → 게임)과
// 사망 뒤 다시 시작은 생명을 새로 정하는 전이라 회복 숫자를 띄우지 않는다. 렌더 경로는 e2e `intro.spec.ts`가 잡는다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { getAppScreen, getPresentationKey } from '../src/utils/appScreen.ts';
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
