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
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { buildBossChallengeEvent } from '../src/utils/bossGauge.js';
import { estimateEnemyMaxHit, getEnemyThreat } from '../src/utils/enemyThreat.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * Wave 88 (소유자 결정 §91.4 b "예상 타격 표시를 보스에도"): 보스가 나타날 때 · 구역 보스 도전 카드에서 그 보스의 가장 센 한 행동
 * (마지막 페이즈 강타 · 브레스 · 소환 하수인 포함)을 내 최대 생명과 함께 보인다. 수치는 바꾸지 않는다.
 *
 * - 예상치는 실제 엔진 `CombatEngine.enemyAttack`이다(utils/enemyThreat.ts — Wave 87 우두머리와 공용). 페이즈는 엔진이 실제 전환처럼
 *   적용한다(공격력 보너스 · 패턴 · 전환 때 거는 상태 · 하수인).
 * - 게임 난수를 쓰지 않는다 — 고정 굴림 `BALANCE.ENEMY_THREAT_PROBE_ROLL`.
 * - 도전 카드는 이벤트 화면이라 기록 창이 없다 — 위협은 카드 문구에 싣는다.
 */

const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');
const HIGH = () => 0.99;

const noRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random must not be called'); };
    try { return fn(); } finally { Math.random = original; }
};

const playerAt = (loc, level, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '용사', job: '나이트', level, hp: 2_000, maxHp: 2_000, mp: 300, maxMp: 300,
    atk: 40 + level * 6, def: 10 + level * 3, loc,
    relics: [structuredClone(HARMLESS_RELIC)],
    eventChainProgress: { ...ALL_CHAINS_DONE },
    stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: ['시작의 마을', loc] },
    ...extra,
});

/** 그 지역의 보스 종을 정해진 종 경로로 만든다(난수 없음 — 이야기 전투와 같은 경로). */
const bossAt = (loc, name, level) => {
    const player = playerAt(loc, level);
    const { mStats } = spawnEnemy(DB.MAPS[loc], player, [], { addLog: () => {} }, { storyMonster: name, rng: () => BALANCE.ENEMY_THREAT_PROBE_ROLL });
    assert.ok(mStats?.isBoss, `${loc}의 ${name}은 보스다`);
    return { player, boss: mStats };
};

const harness = (state) => {
    let current = state;
    const dispatch = (action) => { current = gameReducer(current, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } });
    return { get: () => current, dispatch, addLog };
};

const stateOf = (player) => ({ ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], gameState: GS.IDLE, player });

const explore = async (state, rng = HIGH) => {
    const h = harness(state);
    await createExploreActions({
        player: state.player, gameState: state.gameState, uid: 'test-user',
        dispatch: h.dispatch, addLog: h.addLog, addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player), rng,
    }, makeSharedHelpers({ player: state.player, dispatch: h.dispatch, addLog: h.addLog })).explore();
    return h.get();
};

const choose = (state, choiceIndex, rng = HIGH) => {
    const h = harness(state);
    createEventActions({
        player: state.player, currentEvent: state.currentEvent,
        dispatch: h.dispatch, addLog: h.addLog, addStoryLog: () => {},
        getFullStats: () => calculateFullStats(h.get().player), rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return h.get();
};

const threatLine = (threat) => MSG.BOSS_THREAT(threat.hit, threat.maxHp, threat.pct, threat.hits);
const logTexts = (state) => (state.logs || []).map((log) => log.text);

// ── 예상치: 실제 엔진의 가장 센 한 행동 ────────────────────────────────

test('예상치는 실제 엔진 한 방이고 최대 생명 대비 비율 · 버티는 횟수가 맞으며, 방어가 높으면 줄고 게임 난수를 쓰지 않는다', () => {
    const { player, boss } = bossAt('피라미드', '아누비스 수호자', 20);
    const threat = noRandom(() => getEnemyThreat(player, boss));
    const maxHp = calculateFullStats(player).maxHp;
    assert.ok(threat.hit > 0);
    assert.equal(threat.maxHp, maxHp);
    assert.equal(threat.pct, Math.ceil((threat.hit / maxHp) * 100));
    assert.equal(threat.hits, Math.ceil(maxHp / threat.hit));
    assert.ok(estimateEnemyMaxHit({ ...player, def: player.def * 5 }, boss) < threat.hit, '방어 경감은 엔진 그대로');
});

test('페이즈: 마지막 페이즈(3페이즈) 강타가 페이즈 전 강타보다 세다 — 엔진이 2 → 3페이즈 보너스를 차례로 적용한다', () => {
    const { player, boss } = bossAt('마왕성', '마왕', 48);
    assert.ok(boss.phase2 && boss.phase3);
    const full = estimateEnemyMaxHit(player, boss);
    const noPhase3 = estimateEnemyMaxHit(player, { ...boss, phase3: undefined });
    const noPhases = estimateEnemyMaxHit(player, { ...boss, phase2: undefined, phase3: undefined });
    assert.ok(full > noPhase3 && noPhase3 > noPhases, `${full} > ${noPhase3} > ${noPhases}`);
    // 페이즈 전 강타는 엔진의 강타 한 방과 같다(강타 확정 · 고정 굴림).
    const stats = calculateFullStats({ ...player, hp: calculateFullStats(player).maxHp });
    const direct = CombatEngine.enemyAttack({ ...player, hp: stats.maxHp, status: [], statusStacks: {} },
        { ...boss, phase2: undefined, phase3: undefined, pattern: { guardChance: 0, heavyChance: 1 }, actionCount: 0 },
        stats, () => BALANCE.ENEMY_THREAT_PROBE_ROLL).damage;
    assert.equal(noPhases, Math.floor(direct));
});

test('브레스: 브레스가 강타보다 센 보스는 브레스 값이다', () => {
    const { player, boss } = bossAt('용의 둥지', '레드 드래곤', 25);
    assert.ok(boss.mechanics?.breath);
    const withBreath = estimateEnemyMaxHit(player, boss);
    const heavyOnly = estimateEnemyMaxHit(player, { ...boss, mechanics: { ...boss.mechanics, breath: undefined } });
    assert.ok(withBreath > heavyOnly, `브레스 ${withBreath} > 강타 ${heavyOnly}`);
});

test('소환 · 전환 상태: 하수인이 함께 친 피해와 2페이즈 저주의 증폭이 한 행동에 들어간다', () => {
    const { player, boss } = bossAt('저주받은 묘지', '묘지기 네크론', 34);
    assert.ok(boss.mechanics?.summon);
    const full = estimateEnemyMaxHit(player, boss);
    const noSummon = estimateEnemyMaxHit(player, { ...boss, mechanics: { ...boss.mechanics, summon: undefined } });
    const noCurse = estimateEnemyMaxHit(player, { ...boss, mechanics: { ...boss.mechanics, summon: undefined }, phase2: { ...boss.phase2, statusEffect: undefined } });
    assert.ok(full > noSummon, `하수인 포함 ${full} > ${noSummon}`);
    assert.ok(noSummon > noCurse, `저주 증폭 ${noSummon} > ${noCurse}`);
});

// ── 표시: 탐험 조우 · 도전 카드 · 도전 전투 ────────────────────────────

test('탐험 중 보스가 나타나면 그 개체의 가장 센 한 방이 전투 기록에 한 줄 붙는다', async () => {
    const state = await explore(stateOf(playerAt('피라미드', 20)));
    assert.equal(state.gameState, GS.COMBAT);
    assert.equal(state.enemy?.isBoss, true, 'rng 0.99는 피라미드 풀의 마지막 칸(아누비스 수호자)을 뽑는다');
    const expected = threatLine(getEnemyThreat(state.player, state.enemy));
    assert.ok(logTexts(state).includes(expected), expected);
});

test('일반 몬스터 조우에는 붙지 않는다', async () => {
    const state = await explore(stateOf(playerAt('피라미드', 20)), () => 0.3);
    if (state.gameState === GS.COMBAT && state.enemy && !state.enemy.isBoss) {
        assert.ok(!logTexts(state).some((text) => text.startsWith('🩸 보스의')));
    } else {
        assert.fail(`일반 조우를 기대했다: ${state.gameState} ${state.enemy?.name}`);
    }
});

test('구역 보스 도전 카드는 문구에 위협을 싣고, 도전하면 실제로 나온 보스의 위협이 전투 기록에 붙는다', async () => {
    const LOC = '신성한 호수';
    const player = playerAt(LOC, 12, {});
    player.stats = { ...player.stats, bossGauge: { [LOC]: 1 }, exploresByLocation: { [LOC]: 10 } };
    const opened = await explore(stateOf(player));
    assert.equal(opened.gameState, GS.EVENT);
    assert.equal(opened.currentEvent?.isBossGaugeChallenge, true);
    const probe = spawnEnemy(DB.MAPS[LOC], opened.player, opened.player.relics, { addLog: () => {} }, {
        forceAreaBoss: true, rng: () => BALANCE.ENEMY_THREAT_PROBE_ROLL,
    }).mStats;
    const cardThreat = getEnemyThreat(opened.player, probe);
    assert.equal(opened.currentEvent.desc, `${MSG.BOSS_GAUGE_FULL_DESC(DB.MAPS[LOC].boss)} ${threatLine(cardThreat)}`);

    const fought = choose(opened, 0);
    assert.equal(fought.gameState, GS.COMBAT);
    assert.equal(fought.enemy?.isBoss, true);
    assert.ok(logTexts(fought).includes(threatLine(getEnemyThreat(opened.player, fought.enemy))));
});

test('카드 문구: 위협이 없으면 이전 문구 그대로다', () => {
    assert.equal(buildBossChallengeEvent('호수의 수호신').desc, MSG.BOSS_GAUGE_FULL_DESC('호수의 수호신'));
    assert.equal(buildBossChallengeEvent('호수의 수호신', null).desc, MSG.BOSS_GAUGE_FULL_DESC('호수의 수호신'));
});
