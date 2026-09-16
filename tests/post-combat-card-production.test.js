import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { CONSTANTS } from '../src/data/constants.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import {
    getPostCombatAnalysis,
    getPostCombatDecisionStrip,
    getPostCombatRecommendation,
} from '../src/utils/outcomeAnalysis.js';
import { isPostCombatChoiceOffered } from '../src/utils/postCombatChoice.js';

/**
 * 2026-09 D3 — 전투 결과 카드(PostCombatCard)를 실제 승리 흐름에 연결.
 *
 * 기존엔 combatVictory가 승리마다 `SET_POST_COMBAT_RESULT: null`을 넣어 카드가
 * QA 주입(useGameTestApi.injectPostCombatResult)에서만 열렸다. 이 테스트는
 *  ① 실제 승리 전이가 카드가 읽는 필드를 갖춘 결과 객체를 남기는지,
 *  ② 카드를 띄우면 안 되는 상황(유물 선택 대기 / 승천 / 다른 화면 전환)에서는
 *     결과가 남지 않는지를 reducer 전이 수준에서 고정한다.
 */

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const makeState = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        job: '전사',
        loc: '고요한 숲',
        hp: 60,
        maxHp: 100,
        mp: 40,
        maxMp: 50,
        atk: 200,
        def: 20,
    },
    gameState: GS.COMBAT,
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 1,
        maxHp: 1,
        atk: 10,
        def: 0,
        exp: 8,
        gold: 10,
        weakness: '빛',
        resistance: '어둠',
        pattern: { guardChance: 0, heavyChance: 0 },
    },
    combatTurn: 0,
    combatReceipt: null,
    postCombatResult: null,
    ...overrides,
});

const attack = (state, seed = 11, now = 1_700_000_000_000) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn || 0, seed, now },
});

// ── ① 실제 승리가 카드 결과를 남긴다 ─────────────────────────────────────
test('① 일반 승리는 카드가 읽는 필드를 갖춘 결과를 남긴다', () => {
    const state = makeState();
    const won = attack(state);
    const result = won.postCombatResult;

    assert.ok(result, '승리 후 postCombatResult가 null이면 카드는 프로덕션에서 열리지 않는다');
    assert.equal(won.gameState, GS.IDLE);
    assert.equal(result.enemy, '훈련용 정령');
    assert.equal(result.enemyTier, 'NORMAL');
    assert.equal(result.isBoss, false);
    assert.ok(result.exp > 0, `경험 보상이 카드에 표시돼야 한다: ${result.exp}`);
    assert.ok(result.gold > 0, `골드 보상이 카드에 표시돼야 한다: ${result.gold}`);
    assert.ok(Array.isArray(result.items));
    assert.equal(typeof result.leveledUp, 'boolean');
    assert.equal(typeof result.invFull, 'boolean');
    assert.equal(result.playerHp, won.player.hp);
    assert.ok(result.playerMaxHp > 0);
    assert.equal(result.playerMp, won.player.mp);
    assert.ok(result.playerMaxMp > 0);
    assert.equal(typeof result.primaryBuild, 'string');
    assert.ok(result.primaryBuild.length > 0);
    assert.equal(result.enemyWeakness, '빛');
    assert.equal(result.enemyResistance, '어둠');
    assert.equal(result.bossClearBonus, 0);
    assert.equal(result.bossRewardHint, null);
    // 힌트는 드롭에 따라 null일 수 있으나 키 자체는 항상 존재해야 한다.
    assert.ok('upgradeHint' in result);
    assert.ok('traitHint' in result);
});

test('① 카드가 쓰는 파생 요약이 실제 결과에서 빈 값 없이 계산된다', () => {
    const result = attack(makeState()).postCombatResult;
    const context = {
        signatureLootCount: 0,
        nonSignatureLootCount: result.items.length,
    };
    const analysis = getPostCombatAnalysis(result);
    const strip = getPostCombatDecisionStrip(result, context);
    const recommendation = getPostCombatRecommendation(result, context);

    assert.ok(analysis.grade.length > 0);
    assert.ok(analysis.notes.length > 0);
    assert.ok(analysis.notes[0].includes('훈련용 정령'));
    assert.ok(analysis.notes.some((note) => note.includes(result.primaryBuild)));
    assert.ok(['pressure', 'advantage', 'reward', 'steady'].includes(strip.tone));
    strip.cells.forEach((cell) => {
        assert.ok(cell.value && cell.value.length > 0, `판단 요약에 빈 칸이 있으면 안 된다: ${JSON.stringify(cell)}`);
        assert.ok(!/undefined|NaN/.test(cell.value), `판단 요약에 내부 값이 새면 안 된다: ${cell.value}`);
    });
    assert.ok(recommendation.label.length > 0);
});

test('① 생명 비율이 등급을 나눈다 — 불리언 플래그로 뭉개지지 않는다', () => {
    const healthy = attack(makeState({
        player: { ...makeState().player, hp: 100, maxHp: 100 },
    })).postCombatResult;
    const battered = attack(makeState({
        player: { ...makeState().player, hp: 12, maxHp: 100 },
    })).postCombatResult;

    assert.equal(getPostCombatAnalysis(healthy).grade, '완승');
    assert.equal(getPostCombatAnalysis(battered).grade, '붕괴 직전');
});

test('① 일반 승리 결과에는 밀어붙이기/숨 고르기 선택이 제시된다', () => {
    const won = attack(makeState());
    assert.equal(isPostCombatChoiceOffered(won.postCombatResult), true);

    const resolved = gameReducer(won, {
        type: AT.RESOLVE_POST_COMBAT_CHOICE,
        payload: { choice: 'push' },
    });
    assert.ok(resolved.player.tempBuff, '카드에서 고른 선택이 실제 버프로 적용돼야 한다');
    assert.equal(resolved.postCombatResult.postCombatChoiceResolved, true);
});

// ── ② 보스 / 정예 승리 ───────────────────────────────────────────────────
test('② 구역 보스 첫 토벌은 보스 등급과 첫 토벌 보상을 카드에 넘긴다', () => {
    const state = makeState();
    state.enemy = { ...state.enemy, name: '분노한 숲의 군주', baseName: '숲의 군주', isBoss: true };
    const result = attack(state, 13, 1_500).postCombatResult;

    assert.ok(result, '보스 승리도 카드로 정리할 수 있어야 한다');
    assert.equal(result.enemyTier, 'BOSS');
    assert.equal(result.isBoss, true);
    assert.ok(result.bossClearBonus > 0, '첫 토벌 골드 보너스가 카드에 보여야 한다');
    assert.ok(typeof result.bossRewardHint === 'string' && result.bossRewardHint.length > 0);
    // 보스전은 원정을 마무리하는 지점이라 push/breather 선택은 제시하지 않는다.
    assert.equal(isPostCombatChoiceOffered(result), false);
});

test('② 정예 승리는 정예 등급으로 표시된다', () => {
    const state = makeState();
    state.enemy = { ...state.enemy, name: '정예 숲의 정령', isElite: true };
    const result = attack(state).postCombatResult;

    assert.equal(result.enemyTier, 'ELITE');
    assert.equal(getPostCombatAnalysis(result).rewardMood, '강적 제압');
});

// ── ③ 게이팅 — 다음 판단이 대기 중이면 카드를 띄우지 않는다 ───────────────
test('③ 정예의 흔적 유물 선택이 열리면 카드는 남지 않는다 (카드 dispatch 이후 큐잉)', () => {
    const state = makeState();
    state.enemy = { ...state.enemy, scoutGuaranteedRelic: true };
    const won = attack(state);

    assert.ok(won.pendingRelics?.length, '정찰 보장 유물이 선택 대기로 큐잉돼야 한다');
    assert.equal(won.postCombatResult, null, '유물 선택(z-50)을 전투 카드(z-40)가 덮으면 안 된다');
});

test('③ 심연 층 마일스톤 유물 선택이 열리면 카드는 남지 않는다 (카드 dispatch 이전 큐잉)', () => {
    const state = makeState();
    state.player = {
        ...state.player,
        loc: CONSTANTS.ABYSS_MAP_NAME,
        stats: { ...state.player.stats, abyssFloor: 9 },
    };
    const won = attack(state);

    assert.equal(won.player.stats.abyssFloor, 10);
    assert.ok(won.pendingRelics?.length, '심연 10층 마일스톤은 유물 선택을 제시한다');
    assert.equal(won.postCombatResult, null);
});

test('③ 마왕 격파로 승천 화면에 들어가면 카드는 남지 않는다', () => {
    const state = makeState();
    state.enemy = { ...state.enemy, name: '마왕', baseName: '마왕', isBoss: true };
    const won = attack(state);

    assert.equal(won.gameState, GS.ASCENSION);
    assert.equal(won.postCombatResult, null, '승천 선택 화면을 전투 카드가 가리면 안 된다');
});

test('③ 진엔딩 전이에서도 카드는 남지 않는다', () => {
    const state = makeState();
    state.enemy = { ...state.enemy, name: '원시의 신', baseName: '원시의 신', isBoss: true };
    const won = attack(state);

    assert.equal(won.gameState, GS.TRUE_ENDING);
    assert.equal(won.postCombatResult, null);
});

test('③ 다른 화면으로 넘어가면 지난 전투 카드는 내려간다', () => {
    const won = attack(makeState());
    assert.ok(won.postCombatResult);

    const idle = gameReducer(won, { type: AT.SET_GAME_STATE, payload: GS.IDLE });
    assert.ok(idle.postCombatResult, '탐험 대기 상태에서는 카드가 유지된다');

    for (const next of [GS.COMBAT, GS.EVENT, GS.SHOP, GS.MOVING]) {
        const moved = gameReducer(won, { type: AT.SET_GAME_STATE, payload: next });
        assert.equal(moved.postCombatResult, null, `${next} 화면에서는 전투 카드가 남으면 안 된다`);
    }
});

test('③ 탐험 중 유물 발견이 열리면 열려 있던 전투 카드는 내려간다', () => {
    const won = attack(makeState());
    const relicQueued = gameReducer(won, {
        type: AT.SET_PENDING_RELICS,
        payload: [{ id: 'test_relic', name: '시험용 유물', desc: '테스트', rarity: 'rare', effect: 'skill_mult' }],
    });

    assert.ok(relicQueued.pendingRelics?.length);
    assert.equal(relicQueued.postCombatResult, null);

    const cleared = gameReducer(relicQueued, { type: AT.SET_PENDING_RELICS, payload: null });
    assert.equal(cleared.pendingRelics, null);
});

// ── ④ 승리 요약 로그는 그대로 유지된다 ───────────────────────────────────
test('④ 카드와 별개로 전투 정리 digest 로그는 유지된다', () => {
    const won = attack(makeState());
    assert.ok(
        won.logs.some((log) => log.text.includes('전투 정리')),
        '카드 연결이 digest 로그를 대체하면 안 된다',
    );
});

// ── ⑤ 소비처 계약 (정적 가드) ─────────────────────────────────────────────
test('⑤ combatVictory는 더 이상 카드 결과를 null로 비우지 않는다', async () => {
    const source = await readFile(new URL('../src/hooks/combatActions/combatVictory.ts', import.meta.url), 'utf8');

    assert.ok(
        !/SET_POST_COMBAT_RESULT, payload: null/.test(source),
        '승리 경로에서 payload: null을 다시 넣으면 카드가 프로덕션에서 사라진다',
    );
    assert.match(source, /type: AT\.SET_POST_COMBAT_RESULT/);
    assert.match(source, /addCombatDigestLogs/);
});

test('⑤ 카드 표시 판단은 reducer 트랜잭션 끝에서 한 번만 한다', async () => {
    const handler = await readFile(new URL('../src/reducers/handlers/combatHandlers.ts', import.meta.url), 'utf8');

    assert.match(handler, /draft\.postCombatResult && \(draft\.pendingRelics \|\| draft\.gameState !== GS\.IDLE\)/);
});

test('⑤ 카드는 닫기/계속 CTA로 항상 해제할 수 있다', async () => {
    const card = await readFile(new URL('../src/components/PostCombatCard.tsx', import.meta.url), 'utf8');

    assert.match(card, /data-testid="post-combat-close"/);
    assert.match(card, /data-testid="post-combat-primary-action"/);
    assert.match(card, /data-testid="post-combat-continue"/);
    // 주 행동은 추천이 인벤토리든 계속 탐험이든 항상 카드를 닫는다.
    assert.match(card, /const handlePrimaryAction = \(\) => \{[\s\S]*?handleClose\(\);/);
});

test('⑤ 스모크는 실제 승리 카드를 CTA로 닫는다', async () => {
    const smoke = await readFile(new URL('../scripts/smoke-gameplay.mjs', import.meta.url), 'utf8');

    assert.match(smoke, /dismissPostCombatCardIfPresent/);
    assert.match(smoke, /'post-combat-continue', 'post-combat-close'/);
});
