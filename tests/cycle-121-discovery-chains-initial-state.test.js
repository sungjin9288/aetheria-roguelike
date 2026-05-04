import test from 'node:test';
import assert from 'node:assert/strict';

import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * cycle 121: INITIAL_STATE.player.stats에 discoveryChains: [] 선언 추가.
 *
 * 발견:
 * cycle 102에서 stats.discoveryChains 영구 카운터 도입, cycle 119에서 ASCEND
 * preserve 추가, cycle 120에서 migrateData default 추가했으나, INITIAL_STATE
 * 자체에는 declaration 누락. 신규 플레이어(save 없음)는 stats.discoveryChains
 * 가 undefined로 시작하다가 첫 체인 완료 시 비로소 초기화 — declarative
 * consistency 결손.
 *
 * cycle 82에서 syntheses: 0을 INITIAL_STATE에 추가한 것과 같은 패턴.
 *
 * 수정:
 * INITIAL_STATE.player.stats에 discoveryChains: [] 추가.
 */

test('INITIAL_STATE.player.stats.discoveryChains 선언됨 (빈 배열)', () => {
    const stats = INITIAL_STATE.player.stats || {};
    assert.ok(
        Array.isArray(stats.discoveryChains),
        'discoveryChains should be an array, got: ' + typeof stats.discoveryChains
    );
    assert.equal(stats.discoveryChains.length, 0, 'should start empty');
});

test('INITIAL_STATE: 기존 영구 카운터 회귀 보존 (escapes/syntheses/maxKillStreak)', () => {
    const stats = INITIAL_STATE.player.stats || {};
    assert.equal(stats.escapes, 0, 'cycle 74 escapes preserved');
    assert.equal(stats.syntheses, 0, 'cycle 82 syntheses preserved');
    assert.equal(stats.maxKillStreak, 0, 'cycle 95 maxKillStreak preserved');
    assert.deepEqual(stats.visitedMaps, ['시작의 마을'], 'cycle 83 visitedMaps preserved');
});
