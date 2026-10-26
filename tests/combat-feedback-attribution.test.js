import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { buildCombatFeedback } from '../src/reducers/handlers/combatFeedback.js';
import {
    getCombatAnnouncement,
    getCombatBeatTiming,
    getCombatStageView,
    getCounterStagger,
    getPresentedVisualEffect,
    isCounterStaggered,
} from '../src/utils/combatPresentation.js';

/**
 * 게임 필 감사 GF-01 · 02 · 06 · 11 — 전투 차례의 연출 기록(`combatFeedback`)은 리듀서 정산이 남긴 사실이다.
 *
 * 예전 연출은 기록 꼬리(마지막 줄 type === 'critical')로 치명타를 추측했다. 한 차례의 줄 순서는
 * [내 행동, 틱, 적 반격]이고 적 강타도 'critical'이라, 내 치명타는 대부분 연출되지 않았고 금빛은 적 강타에 붙었다.
 * 이 파일은 실제 리듀서 전이로 기록을 만들고, 독립 오라클(그 차례 기록 줄의 순서와 종류)과 대조한다.
 */

const NOW = 1_700_000_000_000;
const potion = { id: 'feedback-potion', name: '전투 회복 물약', type: 'hp', val: 40 };

const makeState = ({ player = {}, enemy = {} } = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        level: 8,
        loc: '고요한 숲',
        hp: 900,
        maxHp: 900,
        atk: 40,
        inv: [potion],
        ...player,
    },
    gameState: GS.COMBAT,
    enemy: {
        name: '정예 숲의 정령',
        baseName: '숲의 정령',
        level: 3,
        hp: 100000,
        maxHp: 100000,
        atk: 30,
        def: 0,
        exp: 1,
        gold: 1,
        pattern: { guardChance: 0, heavyChance: 0 },
        ...enemy,
    },
    quickSlots: [potion, null, null],
});

const attack = (state, seed) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn ?? 0, seed, now: NOW },
});

/** 그 차례에 새로 붙은 기록 줄 — [내 행동, 틱…, 적 반격…]. */
const turnLogs = (before, after) => after.logs.slice(before.logs.length);

const scanSeeds = (state, count = 240) => Array.from({ length: count }, (_, index) => {
    const seed = index + 1;
    const next = attack(state, seed);
    const logs = turnLogs(state, next);
    return {
        seed,
        next,
        logs,
        playerCritOracle: logs[0]?.type === 'critical',
        enemyHeavyOracle: logs.slice(1).some((entry) => entry.type === 'critical'),
        tailHeuristic: logs[logs.length - 1]?.type === 'critical',
    };
});

test('GF-01: 이어지는 차례의 치명타는 내 행동 줄에서, 강타는 적 반격 줄에서 온다 — 기록 꼬리가 아니다', () => {
    for (const heavyChance of [0, 1]) {
        const state = makeState({ enemy: { pattern: { guardChance: 0, heavyChance } } });
        const turns = scanSeeds(state);
        for (const turn of turns) {
            const feedback = turn.next.combatFeedback;
            assert.equal(feedback.kind, 'continue', `seed ${turn.seed}`);
            assert.equal(feedback.key, turn.next.combatReceipt.key, '영수증과 같은 키');
            assert.equal(feedback.playerCrit, turn.playerCritOracle, `seed ${turn.seed}: 내 치명타`);
            assert.equal(feedback.enemyHeavy, turn.enemyHeavyOracle, `seed ${turn.seed}: 적 강타`);
            assert.equal(feedback.enemyActed, true);
            assert.equal(feedback.enemyDamage, state.enemy.hp - turn.next.enemy.hp);
            assert.equal(feedback.playerHpDelta, turn.next.player.hp - state.player.hp);
            assert.equal(feedback.defeatedEnemy, null);
        }
        const crits = turns.filter((turn) => turn.playerCritOracle);
        assert.ok(crits.length > 0, '표본에 내 치명타가 있다');
        if (heavyChance === 0) {
            // 예전 판정: 꼬리가 적 일반 타격('warning')이라 내 치명타가 연출되지 않았다.
            assert.ok(crits.every((turn) => !turn.tailHeuristic), '기록 꼬리는 내 치명타를 보지 못한다');
        } else {
            // 예전 판정: 적 강타가 꼬리라 내 치명타가 아닌 차례에도 금빛이 떴다.
            const misfires = turns.filter((turn) => !turn.playerCritOracle && turn.tailHeuristic);
            assert.ok(misfires.length > 0, '기록 꼬리는 적 강타를 내 치명타로 읽는다');
            assert.ok(misfires.every((turn) => turn.next.combatFeedback.playerCrit === false));
            assert.ok(misfires.every((turn) => turn.next.combatFeedback.enemyHeavy === true));
        }
    }
});

test('GF-02: 처치 차례는 쓰러진 적의 모습과 마지막 일격(넘친 피해 포함)을 남긴다 — 리듀서 타이밍은 그대로', () => {
    const state = makeState({ enemy: { hp: 5, maxHp: 400, isBoss: false } });
    const turns = scanSeeds(state, 60);
    for (const turn of turns) {
        const { next } = turn;
        assert.equal(next.gameState, GS.IDLE, '처치는 같은 전이에서 끝난다(§8-1)');
        assert.equal(next.enemy, null);
        const feedback = next.combatFeedback;
        assert.equal(feedback.kind, 'victory');
        assert.equal(feedback.playerCrit, turn.playerCritOracle, `seed ${turn.seed}: 처치 치명타`);
        assert.equal(feedback.enemyActed, false, '쓰러진 적은 반격하지 않는다');
        assert.ok(feedback.enemyDamage >= 5, '마지막 일격은 남은 생명 이상이다(넘친 피해 포함)');
        assert.deepEqual(
            { ...feedback.defeatedEnemy, hp: undefined },
            { name: '정예 숲의 정령', baseName: '숲의 정령', maxHp: 400, hp: undefined, isBoss: false, isElite: false },
        );
        assert.equal(feedback.defeatedEnemy.hp, 5 - feedback.enemyDamage, '막대는 0 이하에서 멈춘다');
        assert.ok(feedback.defeatedEnemy.hp <= 0);
    }
    assert.ok(turns.some((turn) => turn.playerCritOracle), '처치 차례에도 내 치명타 표본이 있다');
});

test('GF-02: 쓰러진 적의 모습은 적의 무게(보스 · 의뢰 우두머리 · 정예) 표시를 그대로 옮긴다', () => {
    const { player, enemy } = makeState();
    const snapshotOf = (enemyBefore) => buildCombatFeedback({
        key: 'kill', kind: 'victory', playerBefore: player, enemyBefore, playerHpAfter: player.hp, enemyAfter: null,
    }).defeatedEnemy;
    const champion = snapshotOf({ ...enemy, hp: 5, isElite: true, huntChampion: '고대 마법 탑' });
    assert.equal(champion.isElite, true);
    assert.equal(champion.huntChampion, '고대 마법 탑', '의뢰 우두머리 표시가 처치 순간에 일반 적으로 바뀌지 않는다');
    const elite = snapshotOf({ ...enemy, hp: 5, isElite: true });
    assert.equal(elite.isElite, true);
    assert.equal(Object.hasOwn(elite, 'huntChampion'), false, '우두머리가 아닌 적에는 그 표시가 없다');
    assert.equal(snapshotOf({ ...enemy, hp: 5, isBoss: true }).isBoss, true);
});

test('GF-01: 쓰러진 차례 · 소모품 차례도 같은 기록을 남긴다', () => {
    const lethal = makeState({ player: { hp: 1 }, enemy: { atk: 99999 } });
    const dead = attack(lethal, 3);
    assert.equal(dead.gameState, GS.DEAD);
    assert.equal(dead.combatFeedback.kind, 'defeat');
    assert.equal(dead.combatFeedback.playerHpDelta, -1, '쓰러지면 0까지의 변화다');
    assert.equal(dead.combatFeedback.enemyActed, true);
    assert.equal(dead.combatFeedback.defeatedEnemy, null);

    const hurt = makeState({ player: { hp: 300 }, enemy: { pattern: { guardChance: 0, heavyChance: 1 } } });
    const drank = gameReducer(hurt, {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, expectedTurn: 0, seed: 5, now: NOW },
    });
    const drankLogs = turnLogs(hurt, drank);
    assert.equal(drank.combatFeedback.kind, 'continue');
    assert.equal(drank.combatFeedback.playerCrit, false, '물약은 치명타가 아니다');
    assert.equal(drank.combatFeedback.enemyHeavy, drankLogs.some((entry) => entry.type === 'critical'));
    assert.equal(drank.combatFeedback.playerHpDelta, drank.player.hp - hurt.player.hp);
    assert.equal(drank.combatFeedback.enemyDamage, 0);
});

test('GF-13: 연출 기록은 저장 봉투 밖이다 — 복원(LOAD_DATA)이 비우고 presentationEpoch를 올린다', () => {
    const fought = attack(makeState(), 7);
    assert.ok(fought.combatFeedback);
    const restored = gameReducer(fought, { type: AT.LOAD_DATA, payload: { player: fought.player, gameState: GS.IDLE } });
    assert.equal(restored.combatFeedback, null);
    assert.equal(restored.presentationEpoch, fought.presentationEpoch + 1);
    assert.equal(INITIAL_STATE.combatFeedback, null);
});

test('GF-06: 박자는 내가 맞힌 뒤 적이 행동한 이어지는 차례에만 나눈다 — 모션 감소는 나누지 않는다', () => {
    const state = makeState({ enemy: { pattern: { guardChance: 0, heavyChance: 1 } } });
    const continued = attack(state, 11).combatFeedback;
    assert.equal(isCounterStaggered(continued), continued.enemyDamage > 0);
    assert.deepEqual(getCounterStagger(continued, false), { key: continued.key, delayMs: BALANCE.ENEMY_TURN_DELAY_MS });
    assert.deepEqual(getCounterStagger(continued, true), { key: continued.key, delayMs: 0 });

    const killed = attack(makeState({ enemy: { hp: 1 } }), 11).combatFeedback;
    assert.equal(isCounterStaggered(killed), false, '처치 차례는 반격이 없다');
    assert.equal(getCounterStagger(null, false).delayMs, 0);

    assert.deepEqual(getCombatBeatTiming(false), {
        counterDelayMs: BALANCE.ENEMY_TURN_DELAY_MS,
        killBeatMs: BALANCE.KILL_BEAT_MS,
        pulseMs: BALANCE.COMBAT_PULSE_MS,
        shakeMs: BALANCE.COMBAT_SHAKE_MS,
    });
    assert.equal(getCombatBeatTiming(true).counterDelayMs, 0);
    assert.ok(getCombatBeatTiming(true).killBeatMs <= 150, '모션 감소의 처치 순간은 150ms 이하');
});

test('GF-02: 처치 순간에는 쓰러진 적을 그리고 결과 카드를 미룬다 — 강타 흔들림은 박자가 건다', () => {
    const live = { name: '정령', hp: 10, maxHp: 20 };
    const defeated = { name: '정령', baseName: '정령', hp: -3, maxHp: 20, isBoss: false };
    assert.deepEqual(getCombatStageView(live, null), { enemy: live, enemyDefeated: false, holdResultCards: false });
    assert.deepEqual(getCombatStageView(null, defeated), { enemy: defeated, enemyDefeated: true, holdResultCards: true });
    assert.deepEqual(getCombatStageView(null, null), { enemy: null, enemyDefeated: false, holdResultCards: false });

    assert.equal(getPresentedVisualEffect('shake', false), null, '리듀서의 흔들림은 내 타격과 같은 프레임에 걸지 않는다');
    assert.equal(getPresentedVisualEffect(null, true), 'shake');
    assert.equal(getPresentedVisualEffect('levelUp', false), 'levelUp');
});

test('GF-11: 화면 낭독기 요약은 같은 사실을 플레이어 언어로 말한다(권고 없음)', () => {
    const state = makeState({ enemy: { pattern: { guardChance: 0, heavyChance: 1 } } });
    const crit = scanSeeds(state).find((turn) => turn.playerCritOracle).next.combatFeedback;
    const line = getCombatAnnouncement(crit);
    assert.ok(line.startsWith(MSG.COMBAT_FEEDBACK_ENEMY_DAMAGE(crit.enemyDamage, true)), line);
    assert.ok(line.includes(MSG.COMBAT_FEEDBACK_PLAYER_DAMAGE(-crit.playerHpDelta, true)), line);

    const kill = attack(makeState({ enemy: { hp: 1 } }), 2).combatFeedback;
    assert.ok(getCombatAnnouncement(kill).includes(MSG.COMBAT_FEEDBACK_KILL('정예 숲의 정령')));
    const dead = attack(makeState({ player: { hp: 1 }, enemy: { atk: 99999 } }), 3).combatFeedback;
    assert.ok(getCombatAnnouncement(dead).endsWith(MSG.COMBAT_FEEDBACK_DEFEAT));
    assert.equal(getCombatAnnouncement(null), '');
    for (const text of [line, getCombatAnnouncement(kill)]) {
        assert.ok(!/[A-Za-z]/.test(text), `영어 낱말이 없다: ${text}`);
    }
});
