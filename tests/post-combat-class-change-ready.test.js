import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { CLASSES } from '../src/data/classes.js';
import { MSG } from '../src/data/messages.js';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-11 재미 분석 G5 — 전직을 연 승리의 결과 카드는 '전직 가능'을 말한다.
 *
 * 레벨 상승 띠의 부제('전직할 수 있습니다')는 잠깐 떴다 사라지고, 그 위를 결과 카드가 덮는다 — 직접 플레이에서 Lv5 승리 카드가
 * "레벨 상승"만 말해 첫 세션의 가장 큰 순간(첫 전직)을 놓쳤다. 판정은 띠와 같은 `isClassChangeNewlyReady`이고 규칙은 그대로다.
 */

const actionMap = makeCombatActionMap(INITIAL_STATE.player);
const FIRST_CLASS_LEVEL = Math.min(...CLASSES['모험가'].next.map((name) => CLASSES[name].reqLv));

const makeState = (level) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        job: '모험가',
        loc: '고요한 숲',
        level,
        hp: 90,
        maxHp: 100,
        mp: 45,
        maxMp: 50,
        atk: 200,
        def: 20,
        exp: 0,
        nextExp: 3,
    },
    gameState: GS.COMBAT,
    enemy: {
        name: '훈련용 정령', baseName: '훈련용 정령', level: 1,
        hp: 1, maxHp: 1, atk: 1, def: 0, exp: 8, gold: 10,
        pattern: { guardChance: 0, heavyChance: 0 },
    },
    combatTurn: 0,
    combatReceipt: null,
    postCombatResult: null,
});

const win = (state) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: 0, seed: 11, now: 1_700_000_000_000 },
});

test('전직이 열리는 레벨에 닿은 승리만 결과에 classChangeReady를 남긴다', () => {
    const opened = win(makeState(FIRST_CLASS_LEVEL - 1));
    assert.equal(opened.player.level >= FIRST_CLASS_LEVEL, true, 'fixture levels up past the first class gate');
    assert.equal(opened.postCombatResult.leveledUp, true);
    assert.equal(opened.postCombatResult.classChangeReady, true);

    const alreadyOpen = win(makeState(FIRST_CLASS_LEVEL));
    assert.equal(alreadyOpen.postCombatResult.leveledUp, true);
    assert.equal(alreadyOpen.postCombatResult.classChangeReady, false, 'a gate opened earlier is not announced again');
});

test('결과 카드는 레벨 상승 옆에 전직 가능 칩을 그리고, 열리지 않은 승리에는 그리지 않는다', () => {
    const result = win(makeState(FIRST_CLASS_LEVEL - 1)).postCombatResult;
    const html = renderStatic(createElement(PostCombatCard, { result, onClose: () => {} }));
    assert.match(html, /data-testid="post-combat-class-change-ready"/);
    assert.ok(html.includes(MSG.POST_COMBAT_CLASS_CHANGE_READY));

    const plain = renderStatic(createElement(PostCombatCard, {
        result: { ...result, classChangeReady: false }, onClose: () => {},
    }));
    assert.doesNotMatch(plain, /post-combat-class-change-ready/);
    const noLevel = renderStatic(createElement(PostCombatCard, {
        result: { ...result, leveledUp: false }, onClose: () => {},
    }));
    assert.doesNotMatch(noLevel, /post-combat-class-change-ready/, 'the chip rides on a level-up');
});
