import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import { getCycleSummary, getCycleSummaryLines } from '../src/utils/cycleSummary.js';
import { estimateEnemyMaxHit } from '../src/utils/enemyThreat.js';
import { readJudgmentLedger } from '../src/utils/judgmentLedger.js';
import AscensionCycleSummary from '../src/components/AscensionCycleSummary.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-11 재미 분석 G3 (소유자 결정 Q4 "예"): 회차 요약에 판단 기록 — 정예 · 보스가 나타난 수, 그때 생명이 예상 가장 센 한 방보다 많던 수,
 * 정예 · 보스에게서 물러난 수. 사실만이고(평가 · 추천 · 강조 없음, Wave 88) 게임 판정은 읽지 않는다. 쓰는 곳은 적 출현 전이(`SET_ENEMY` 값
 * payload)와 두 도주 경로, 운반은 `pickPermanentPlayerState`, 회차 값은 계승이 남기는 기준점(`meta.cycleStart.judgment`)과의 차이다.
 */

const NOW = Date.UTC(2026, 10, 10);
const clone = (value) => structuredClone(value);

const ELITE = { name: '재앙의 오크', baseName: '오크', isElite: true, hp: 400, maxHp: 400, atk: 120, def: 10, exp: 50, gold: 50, level: 20 };
const BOSS = { name: '바위 거인', baseName: '바위 거인', isBoss: true, hp: 900, maxHp: 900, atk: 160, def: 20, exp: 200, gold: 200, level: 25 };
const NORMAL = { name: '슬라임', baseName: '슬라임', hp: 30, maxHp: 30, atk: 5, def: 0, exp: 5, gold: 5, level: 3 };

const hero = (extra = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '판단가', job: '전사', level: 30, loc: '고요한 숲', hp: 800, maxHp: 800, mp: 100, maxMp: 100, atk: 120, def: 40,
    meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 1, endgame: { lastEndgameReceiptKey: 'rk-judge' } },
    ...extra,
});
const stateOf = (player, gameState = GS.IDLE) => ({ ...clone(INITIAL_STATE), gameState, bootStage: 'ready', player });
const appear = (player, enemy) => gameReducer(stateOf(player), { type: AT.SET_ENEMY, payload: enemy }).player;
const ledgerOf = (player) => readJudgmentLedger(player.stats?.judgmentLedger);

test('G3: 정예 · 보스가 나타나면 센다 — 생명이 예상 가장 센 한 방보다 많으면 대비한 출현이다', () => {
    const strong = hero();
    assert.ok(strong.hp > estimateEnemyMaxHit(strong, ELITE), '표본: 대비한 생명');
    const weak = hero({ hp: 1 });
    assert.ok(weak.hp <= estimateEnemyMaxHit(weak, BOSS), '표본: 한 방에 쓰러지는 생명');

    assert.deepEqual(ledgerOf(appear(strong, ELITE)), { faced: 1, ready: 1, escaped: 0 });
    assert.deepEqual(ledgerOf(appear(weak, BOSS)), { faced: 1, ready: 0, escaped: 0 });
    assert.deepEqual(ledgerOf(appear(appear(strong, ELITE), BOSS)), { faced: 2, ready: 2, escaped: 0 });
});

test('G3: 일반 적 · 같은 적의 갱신(함수 payload)은 세지 않는다 — 일반 적은 플레이어 참조도 그대로다', () => {
    const player = hero();
    const state = stateOf(player);
    assert.equal(gameReducer(state, { type: AT.SET_ENEMY, payload: NORMAL }).player, player);
    const engaged = gameReducer(state, { type: AT.SET_ENEMY, payload: ELITE });
    const updated = gameReducer(engaged, { type: AT.SET_ENEMY, payload: (enemy) => ({ ...enemy, hp: 10 }) });
    assert.deepEqual(ledgerOf(updated.player), { faced: 1, ready: 1, escaped: 0 });
});

test('G3: 정예 · 보스에게서 도주에 성공하면 물러난 전투로 센다 — 실패 · 일반 적은 세지 않는다', () => {
    const player = hero();
    const flee = (enemy, roll) => resolveCombatActionTurn({ player, enemy, kind: 'escape', initialPlayer: player, seed: 1, now: NOW, rng: () => roll });
    const fromElite = flee(ELITE, 0.99);
    assert.equal(fromElite.kind, 'escape');
    assert.equal(ledgerOf(fromElite.player).escaped, 1);
    assert.equal(fromElite.player.stats.escapes, (player.stats.escapes || 0) + 1, '평생 도주 수는 그대로 오른다');
    assert.equal(ledgerOf(flee(NORMAL, 0.99).player).escaped, 0);
    assert.equal(ledgerOf(flee(BOSS, 0).player).escaped, 0, '도주 실패');
});

test('G3: 판단 기록은 평생 누적이다 — 사망 · 다시 시작 · 계승을 넘는다', () => {
    const recorded = { ...hero(), stats: { ...hero().stats, judgmentLedger: { faced: 9, ready: 6, escaped: 2 } } };
    const dead = CombatEngine.handleDefeat(recorded, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    assert.deepEqual(dead.stats.judgmentLedger, { faced: 9, ready: 6, escaped: 2 });
    const restarted = gameReducer({ ...clone(INITIAL_STATE), player: recorded }, { type: AT.RESET_GAME }).player;
    assert.deepEqual(restarted.stats.judgmentLedger, { faced: 9, ready: 6, escaped: 2 });
});

const ascend = (player) => gameReducer(stateOf(player, GS.ASCENSION), {
    type: AT.ASCEND,
    payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey, seed: 1, challengeModifiers: [] },
}).player;
const judgmentLine = (player) => getCycleSummaryLines(getCycleSummary(player)).find((line) => line.id === 'judgment');

test('G3: 계승이 판단 기록의 기준점을 남기고, 회차 요약은 그 차이를 사실만 말한다', () => {
    const before = { ...hero(), stats: { ...hero().stats, judgmentLedger: { faced: 9, ready: 6, escaped: 2 } } };
    const ascended = ascend(before);
    assert.deepEqual(ascended.meta.cycleStart.judgment, { faced: 9, ready: 6, escaped: 2 });
    assert.equal(judgmentLine(ascended), undefined, '정예 · 보스를 아직 만나지 않은 회차는 줄이 없다');

    let next = appear({ ...ascended, hp: 99999 }, ELITE); // 계승 직후 Lv1 — 표본을 위해 생명만 채운다
    next = appear({ ...next, hp: 1 }, BOSS);
    const line = judgmentLine(next);
    assert.deepEqual(getCycleSummary(next).judgment, { faced: 2, ready: 1, escaped: 0 });
    assert.equal(line.text, MSG.CYCLE_SUMMARY_JUDGMENT(2, 1, 0));
    assert.equal(line.highlight, false, '평가하지 않는다 — 강조 없음');
    assert.match(renderStatic(createElement(AscensionCycleSummary, { player: next, testIdPrefix: 'ascension' })), /판단 기록/);
});

test('G3: 처음 시작한 여정(단계 0)은 평생 기록 전부가 이 회차다 · 판단 기준점이 없는 이전 기준점은 줄을 그리지 않는다', () => {
    const rookie = { ...hero({ meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 0 } }), stats: { ...hero().stats, judgmentLedger: { faced: 3, ready: 2, escaped: 1 } } };
    assert.equal(judgmentLine(rookie).text, MSG.CYCLE_SUMMARY_JUDGMENT(3, 2, 1));

    const legacy = { ...hero({ meta: { ...hero().meta, prestigeRank: 2, cycleStart: { rank: 2, signatures: [], eliteTitles: 0 } } }), stats: { ...hero().stats, judgmentLedger: { faced: 3, ready: 2, escaped: 1 } } };
    assert.equal(getCycleSummary(legacy).judgment, null);
    assert.equal(judgmentLine(legacy), undefined, '모르는 값을 지어내지 않는다(Wave 100)');
});

test('G3: 판단 기록 문구는 추천 · 평가를 하지 않는다', () => {
    const text = MSG.CYCLE_SUMMARY_JUDGMENT(10, 4, 3);
    for (const word of ['추천', '권장', '하세요', '좋', '나쁨', '잘했', '부족']) assert.doesNotMatch(text, new RegExp(word));
});
