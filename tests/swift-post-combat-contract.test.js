import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { isSwiftPostCombat } from '../src/utils/outcomeAnalysis.js';
import { MSG } from '../src/data/messages.js';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 소유자 결정 2026-10-26 D1(감사 CL-01) — 한 행동에 끝난 일반 전투의 결과는 한 장이다.
 *
 *  ① 생산자: 실제 승리 전이(`RESOLVE_COMBAT_ACTION`)가 적이 한 번도 행동하지 않은 처치에만 `swift: true`를 남긴다.
 *  ② 판정: `isSwiftPostCombat`은 판단할 거리(정예 · 보스 · 레벨 · 가방 · 생명 · 기력 · 장비 · 각인 · 보스 보상)가 하나라도 있으면 거짓이다.
 *  ③ 화면: 접힌 카드는 판단 칸 없이 보상 · 전리품 한 줄 · '계속 탐험' 하나를 그린다.
 * 수치는 바꾸지 않는다 — 같은 전투의 보상은 접힌 카드와 원래 카드에서 같다.
 */

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const makeState = (enemyOverrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        job: '전사',
        loc: '고요한 숲',
        hp: 90,
        maxHp: 100,
        mp: 45,
        maxMp: 50,
        atk: 200,
        def: 20,
        exp: 0,
        nextExp: 100_000,
    },
    gameState: GS.COMBAT,
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 1,
        maxHp: 1,
        atk: 1,
        def: 0,
        exp: 8,
        gold: 10,
        pattern: { guardChance: 0, heavyChance: 0 },
        ...enemyOverrides,
    },
    combatTurn: 0,
    combatReceipt: null,
    postCombatResult: null,
});

const attack = (state, seed = 11) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn || 0, seed, now: 1_700_000_000_000 },
});

const fightToEnd = (state) => {
    let current = state;
    for (let turn = 0; turn < 40 && current.gameState === GS.COMBAT; turn += 1) {
        current = attack(current, 100 + turn);
    }
    return current;
};

const baseResult = (overrides = {}) => ({
    enemy: '훈련용 정령',
    enemyTier: 'NORMAL',
    isBoss: false,
    exp: 8,
    gold: 10,
    items: [],
    leveledUp: false,
    playerHp: 90,
    playerMaxHp: 100,
    playerMp: 45,
    playerMaxMp: 50,
    invFull: false,
    primaryBuild: '균형형',
    enemyWeakness: null,
    enemyResistance: null,
    upgradeHint: null,
    traitHint: null,
    bossRewardHint: null,
    bossClearBonus: 0,
    swift: true,
    ...overrides,
});

// ── ① 생산자 ────────────────────────────────────────────────────────────
test('① 첫 행동으로 쓰러뜨린 일반 적은 swift 결과를 남기고 카드도 접힌다', () => {
    const won = attack(makeState());
    assert.equal(won.gameState, GS.IDLE);
    const result = won.postCombatResult;
    assert.ok(result, '승리 결과가 있어야 한다');
    assert.equal(result.swift, true);
    assert.equal(result.leveledUp, false);
    assert.equal(isSwiftPostCombat(result), true);
});

test('① 이미 한 번 행동한 적(복원된 전투 포함)은 첫 공격에 쓰러져도 swift가 아니다', () => {
    const won = attack(makeState({ actionCount: 1 }));
    assert.equal(won.gameState, GS.IDLE);
    assert.equal(won.postCombatResult.swift, false);
    assert.equal(isSwiftPostCombat(won.postCombatResult), false);
});

test('① 여러 차례 주고받은 전투는 swift가 아니다', () => {
    const start = makeState({ hp: 700, maxHp: 700 });
    const afterFirst = attack(start);
    assert.equal(afterFirst.gameState, GS.COMBAT, '첫 공격에 끝나면 이 경우를 재지 못한다');
    assert.ok(afterFirst.enemy.actionCount >= 1, '적이 반격했어야 한다');
    const won = fightToEnd(afterFirst);
    assert.equal(won.gameState, GS.IDLE);
    assert.equal(won.postCombatResult.swift, false);
});

test('① 접든 안 접든 보상 수치는 같다 — swift는 보이는 모양만 바꾼다', () => {
    const swiftWin = attack(makeState()).postCombatResult;
    const fullWin = attack(makeState({ actionCount: 1 })).postCombatResult;
    assert.equal(swiftWin.exp, fullWin.exp);
    assert.equal(swiftWin.gold, fullWin.gold);
    assert.deepEqual(swiftWin.items, fullWin.items);
});

// ── ② 판정 ──────────────────────────────────────────────────────────────
test('② 판단할 거리가 하나라도 있으면 원래 카드다', () => {
    const blocked = {
        notSwift: baseResult({ swift: false }),
        elite: baseResult({ enemyTier: 'ELITE' }),
        boss: baseResult({ enemyTier: 'BOSS', isBoss: true }),
        levelUp: baseResult({ leveledUp: true }),
        invFull: baseResult({ invFull: true }),
        hpLow: baseResult({ playerHp: 35 }),
        mpLow: baseResult({ playerMp: 15 }),
        upgrade: baseResult({ upgradeHint: { name: '강철 검', summary: '공격력 +4' } }),
        trait: baseResult({ traitHint: { name: '강철 검', summary: '공명' } }),
        bossReward: baseResult({ bossRewardHint: '보스 보상' }),
    };
    for (const [label, result] of Object.entries(blocked)) {
        assert.equal(isSwiftPostCombat(result), false, label);
    }
    assert.equal(
        isSwiftPostCombat(baseResult({ items: ['라그나로크'] }), { signatureLootCount: 1, nonSignatureLootCount: 0 }),
        false,
        '전설 각인',
    );
});

test('② 일반 전리품만 떨어진 한 행동 처치는 접힌다(전리품은 이미 가방에 들어갔다)', () => {
    assert.equal(isSwiftPostCombat(baseResult()), true);
    assert.equal(
        isSwiftPostCombat(baseResult({ items: ['벌레 껍질', '벌레 껍질'] }), { signatureLootCount: 0, nonSignatureLootCount: 2 }),
        true,
    );
});

// ── ③ 화면 ──────────────────────────────────────────────────────────────
test('③ 접힌 카드는 판단 칸 없이 보상 · 전리품 한 줄 · 계속 탐험 하나를 그린다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: baseResult({ items: ['벌레 껍질', '벌레 껍질'] }),
        onClose: () => {},
        onOpenInventory: () => {},
        onExplore: () => {},
    }));
    assert.match(html, /data-card-mode="swift"/);
    assert.match(html, new RegExp(MSG.POST_COMBAT_SWIFT_TITLE('훈련용 정령')));
    assert.match(html, /data-primary-kind="explore"/);
    assert.ok(html.includes(MSG.POST_COMBAT_CONTINUE));
    assert.ok(html.includes('벌레 껍질 x2'), html);
    assert.ok(html.includes(MSG.POST_COMBAT_EXP(8)), '끝값을 바로 보인다(순서 공개 없음)');
    assert.doesNotMatch(html, /post-combat-decision-strip|post-combat-continue"/);
});

test('③ 탐험할 수 없는 곳의 접힌 카드는 닫기 하나다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: baseResult(),
        onClose: () => {},
        onExplore: null,
    }));
    assert.match(html, /data-card-mode="swift"/);
    assert.match(html, /data-primary-kind="close"/);
    assert.ok(!html.includes(MSG.POST_COMBAT_CONTINUE));
});

test('③ 판단할 거리가 있는 결과는 원래 카드(판단 칸 포함)다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: baseResult({ leveledUp: true }),
        onClose: () => {},
        onExplore: () => {},
    }));
    assert.match(html, /data-card-mode="full"/);
    assert.match(html, /post-combat-decision-strip/);
});
