import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { buildCombatView } from '../src/utils/combatView.js';
import { estimateEnemyMaxHit, getAppearThreatLine, getEliteThreatChip, getEnemyThreat } from '../src/utils/enemyThreat.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 111 (1회차 초반 사망 감사 원장 §117 · 소유자 결정 (b) "정보는 주고 반응은 플레이어 몫"): 정예(보스 · 의뢰 우두머리 제외)도
 * 나타날 때 격노 강타를 포함한 가장 센 한 방을 전투 기록에 남기고, 싸우는 동안 전투 화면 칩으로 보인다. 수치는 바꾸지 않는다.
 *
 * - 1회차 Lv20 이하 사망의 89%가 완전 정예였고, 정예전 한 번의 사망률이 18.5%였다(일반 몬스터 0%). 전투 화면에는 정예 표시가 없었다.
 * - 예상치는 보스와 같은 추정기(utils/enemyThreat.ts — 실제 엔진 · 고정 굴림)다. 게임 난수를 쓰지 않는다.
 * - 모든 전투 시작 지점(탐험 조우 · 정찰 · 이벤트 정예 · 체인 전투 · 다른 차원의 묘비 · 구역 보스 도전)이 `getAppearThreatLine` 하나를 읽는다.
 */

const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');
const MID = () => 0.3;
const LOC = '버려진 광산';

const noRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random must not be called'); };
    try { return fn(); } finally { Math.random = original; }
};

const playerAt = (loc, level, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '용사', job: '전사', level, hp: 400, maxHp: 400, mp: 100, maxMp: 100,
    atk: 40 + level * 6, def: 10 + level * 3, loc,
    relics: [structuredClone(HARMLESS_RELIC)],
    eventChainProgress: { ...ALL_CHAINS_DONE },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: ['시작의 마을', loc] },
    ...extra,
});

/** 'eliteOnly' 도전 조건은 일반 스폰에 완전 정예 접두어를 강제한다 — 실제 스폰 경로로 정예를 만든다. */
const eliteAt = (loc, level) => {
    const player = playerAt(loc, level, { challengeModifiers: ['eliteOnly'] });
    const { mStats } = spawnEnemy(DB.MAPS[loc], player, [], { addLog: () => {} }, { rng: MID });
    assert.ok(mStats?.isElite && !mStats.isBoss, `${loc}에서 정예가 나온다: ${mStats?.name}`);
    return { player, elite: mStats };
};

const plainAt = (loc, level) => {
    const player = playerAt(loc, level);
    const { mStats } = spawnEnemy(DB.MAPS[loc], player, [], { addLog: () => {} }, { rng: () => 0.95 });
    assert.ok(mStats && !mStats.isElite && !mStats.isBoss, `${loc}의 일반 개체: ${mStats?.name}`);
    return { player, plain: mStats };
};

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, dispatch, addLog };
};

const stateOf = (player, extra = {}) => ({ ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], gameState: GS.IDLE, player, ...extra });

const explore = async (state, rng = MID) => {
    const h = harness(state);
    await createExploreActions({
        player: state.player, gameState: state.gameState, uid: 'test-user',
        dispatch: h.dispatch, addLog: h.addLog, addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player), rng,
    }, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

const choose = (state, choiceIndex, rng = MID) => {
    const h = harness(state);
    createEventActions({
        player: state.player, currentEvent: state.currentEvent,
        dispatch: h.dispatch, addLog: h.addLog, addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player), rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return h.get();
};

const eliteLine = (threat) => MSG.ELITE_THREAT(threat.hit, threat.maxHp, threat.pct, threat.hits);
const logTexts = (state) => (state.logs || []).map((log) => log.text);
const ELITE_PREFIX = '🩸 정예의';
const BOSS_PREFIX = '🩸 보스의';

// ── 판정: 누구에게 어떤 줄이 붙는가 ─────────────────────────────────

test('정예는 정예 줄이고 값은 보스와 같은 추정기(격노 강타 포함)이며, 게임 난수를 쓰지 않는다', () => {
    const { player, elite } = eliteAt(LOC, 8);
    const line = noRandom(() => getAppearThreatLine(player, elite));
    assert.equal(line, eliteLine(getEnemyThreat(player, elite)));
    assert.ok(elite.phase2, '정예는 생명 50%에서 격노한다');
    assert.ok(estimateEnemyMaxHit(player, elite) > estimateEnemyMaxHit(player, { ...elite, phase2: undefined }), '격노 강타가 들어간다');
});

test('보스는 보스 줄 그대로, 일반 · 접두어 개체와 의뢰 우두머리(자기 줄이 있다)는 줄이 없다', () => {
    const { player, plain } = plainAt(LOC, 8);
    assert.equal(getAppearThreatLine(player, plain), null);
    assert.equal(getAppearThreatLine(player, { ...plain, name: `날렵한 ${plain.baseName}` }), null);
    const { elite } = eliteAt(LOC, 8);
    assert.equal(getAppearThreatLine(player, { ...elite, huntChampion: '버려진 광산' }), null);
    assert.equal(getAppearThreatLine(player, null), null);
    const boss = { ...elite, isBoss: true };
    const threat = getEnemyThreat(player, boss);
    assert.equal(getAppearThreatLine(player, boss), MSG.BOSS_THREAT(threat.hit, threat.maxHp, threat.pct, threat.hits));
});

test('초반 정예(정예 접두어 ×1.4)도 정예 줄이다', () => {
    const { player, plain } = plainAt('고요한 숲', 2);
    const early = { ...plain, name: `정예 ${plain.baseName}`, isElite: true };
    assert.ok(getAppearThreatLine(player, early)?.startsWith(ELITE_PREFIX));
});

// ── 표시: 탐험 조우 · 정찰 정예 카드 ────────────────────────────────

test('탐험 중 정예가 나타나면 그 개체의 가장 센 한 방이 전투 기록에 한 줄 붙는다(보스 줄은 없다)', async () => {
    const player = playerAt(LOC, 8, { challengeModifiers: ['eliteOnly'] });
    const state = await explore(stateOf(player));
    assert.equal(state.gameState, GS.COMBAT);
    assert.ok(state.enemy?.isElite && !state.enemy.isBoss, state.enemy?.name);
    const texts = logTexts(state);
    // 나타나는 순간의 플레이어로 잰다 — 정예 목격 칭호는 적이 나타나는 전이(`SET_ENEMY`)가 그 뒤에 준다.
    assert.ok(texts.includes(eliteLine(getEnemyThreat(player, state.enemy))), texts.join('\n'));
    assert.ok(!texts.some((text) => text.startsWith(BOSS_PREFIX)));
});

test('일반 개체 조우에는 정예 줄이 붙지 않는다', async () => {
    const state = await explore(stateOf(playerAt(LOC, 8)), () => 0.95);
    assert.equal(state.gameState, GS.COMBAT);
    assert.ok(state.enemy && !state.enemy.isElite, state.enemy?.name);
    assert.ok(!logTexts(state).some((text) => text.startsWith(ELITE_PREFIX)));
});

test('정찰의 정예 카드로 시작한 전투도 같은 줄이 붙는다', () => {
    const player = playerAt(LOC, 8);
    const event = {
        title: '정찰', desc: '', isScout: true, choices: ['정예를 쫓는다'],
        outcomes: [{ choiceIndex: 0, scoutEffect: 'elite', log: '' }],
    };
    const fought = choose(stateOf(player, { gameState: GS.EVENT, currentEvent: event }), 0);
    assert.equal(fought.gameState, GS.COMBAT);
    assert.ok(fought.enemy?.isElite, fought.enemy?.name);
    assert.ok(logTexts(fought).includes(eliteLine(getEnemyThreat(player, fought.enemy))));
});

// ── 전투 화면 칩 ────────────────────────────────────────────────────

test('전투 화면: 정예와 싸우는 동안 첫 칩이 정예 위협이고, 일반 개체 · 보스에는 없다', () => {
    const { player, elite } = eliteAt(LOC, 8);
    const stats = calculateFullStats(player);
    const view = buildCombatView({ player, enemy: elite, stats });
    const threat = getEnemyThreat(player, elite);
    assert.equal(view.mobileCombatSignals[0]?.key, 'elite');
    assert.equal(view.mobileCombatSignals[0]?.text, MSG.ELITE_COMBAT_CHIP(threat.pct, threat.hits));
    assert.equal(getEliteThreatChip(player, elite), MSG.ELITE_COMBAT_CHIP(threat.pct, threat.hits));

    const { plain } = plainAt(LOC, 8);
    assert.ok(!buildCombatView({ player, enemy: plain, stats }).mobileCombatSignals.some((s) => s?.key === 'elite'));
    assert.ok(!buildCombatView({ player, enemy: { ...elite, isBoss: true }, stats }).mobileCombatSignals.some((s) => s?.key === 'elite'));
    assert.equal(getEliteThreatChip(player, { ...elite, huntChampion: LOC }), null);
});

test('칩은 표시 기준 값이다 — 방어가 높으면 비율이 줄고 버티는 횟수가 는다', () => {
    const { player, elite } = eliteAt(LOC, 8);
    const sturdy = { ...player, def: player.def * 6 };
    const a = getEnemyThreat(player, elite);
    const b = getEnemyThreat(sturdy, elite);
    assert.ok(b.pct < a.pct && b.hits >= a.hits, `${a.pct}%/${a.hits} → ${b.pct}%/${b.hits}`);
    assert.ok(BALANCE.ENEMY_THREAT_PROBE_ROLL >= 0);
});
