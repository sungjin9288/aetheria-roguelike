import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import { getEffectiveMaxHp, getEffectiveMaxMpFull } from '../src/systems/vitals.js';
import {
    canStartAutoExplore,
    getAutoExploreHpSetting,
    getAutoExploreHpStopRatio,
    getAutoExploreStep,
    isAutoExploreUnlocked,
    isOneShotWithMinimumAttack,
    isOneShotWithMinimumStrike,
} from '../src/utils/autoExplore.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-11 H1 연속 탐험 — 한 걸음의 판정(docs/EXECUTION_SKETCH_H1_2026-11.md §3, 소유자 결정 Q1 (c) · Q2 (b) · Q3 (b) · Q4 (a)).
 *
 * - 대기 · 사냥 지역 · 멈춤 조건 없음이면 탐험, 판단할 거리가 생기면 반드시 멈춘다(이유 하나씩).
 * - 싸우는 적은 보스 · 정예 · 우두머리가 아니고 **최소 피해**로 한 번에 쓰러지는 적뿐이다 — 일반 공격으로 되면 일반 공격, 아니면
 *   지금 고른 기술(Q1 (c), 2026-11-12). 판정이 공격 · 기술을 내면 실제 전투 턴(`resolveCombatActionTurn`)은 어느 씨앗에서도
 *   승리다(적이 행동할 일이 구조적으로 없다).
 * - 판정은 게임 난수를 쓰지 않고 상태를 바꾸지 않는다.
 */

const LOC = '버려진 광산';
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');

const noRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random must not be called'); };
    try { return fn(); } finally { Math.random = original; }
};

const playerAt = (loc = LOC, extra = {}) => {
    const base = {
        ...structuredClone(INITIAL_STATE.player),
        name: '용사', job: '전사', level: 20, hp: 400, maxHp: 400, mp: 100, maxMp: 100,
        atk: 160, def: 70, loc, inv: [],
        relics: [structuredClone(HARMLESS_RELIC)],
        ...extra,
    };
    // 생명 · 기력을 실효 최대치로 맞춘다(장비 · 유물로 늘어난 최대치 위에서 비율을 재므로).
    const maxHp = getEffectiveMaxHp(base);
    const maxMp = getEffectiveMaxMpFull(base, base.relics, base.maxMp);
    return { ...base, hp: extra.hp ?? maxHp, mp: extra.mp ?? maxMp };
};

const stateOf = (player, extra = {}) => ({
    gameState: GS.IDLE,
    player,
    enemy: null,
    currentEvent: null,
    pendingRelics: null,
    postCombatResult: null,
    isAiThinking: false,
    ...extra,
});

const plainEnemy = (player) => {
    const { mStats } = spawnEnemy(DB.MAPS[player.loc], player, [], { addLog: () => {} }, { rng: () => 0.95 });
    assert.ok(mStats && !mStats.isElite && !mStats.isBoss, `${player.loc}의 일반 개체: ${mStats?.name}`);
    return mStats;
};

/** 최소 피해 한 방 — 판정과 같은 고정 굴림(첫 굴림 = 분산 최소, 그 뒤 = 걸리지 않는 값)으로 실제 엔진을 부른다. */
const minimumDamage = (player, enemy) => {
    let draws = 0;
    const roll = () => { draws += 1; return draws === 1 ? BALANCE.AUTO_EXPLORE_PROBE_VARIANCE_ROLL : BALANCE.AUTO_EXPLORE_PROBE_OTHER_ROLL; };
    const big = { ...enemy, hp: 10 ** 9, maxHp: 10 ** 9 };
    const result = CombatEngine.attack(player, big, calculateFullStats(player), roll);
    return big.hp - result.updatedEnemy.hp;
};

/** 그 기술을 고른 플레이어(전투 턴과 같은 `skillLoadout.selected`). */
const withSkill = (player, name, extra = {}) => {
    const index = getJobSkills(player).findIndex((skill) => skill.name === name);
    assert.ok(index >= 0, `${player.job}의 기술 ${name}`);
    return { ...player, skillLoadout: { selected: index, cooldowns: {} }, ...extra };
};

/** 고른 기술 최소 피해로 쓰러지는 가장 큰 생명 — 판정 함수 자체로 이분 탐색한다(피해 식을 다시 쓰지 않는다). */
const skillLine = (player, enemy) => {
    const skill = getJobSkills(player)[player.skillLoadout.selected];
    const oneShot = (hp) => isOneShotWithMinimumStrike(player, { ...enemy, hp, maxHp: Math.max(hp, enemy.maxHp) }, skill);
    let lo = 1;
    let hi = 1;
    while (oneShot(hi)) hi *= 2;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (oneShot(mid)) lo = mid; else hi = mid;
    }
    return lo;
};

const swiftResult = (player, extra = {}) => ({
    enemy: '고블린', enemyTier: 'NORMAL', isBoss: false, exp: 30, gold: 12, items: [],
    leveledUp: false, playerHp: player.hp, playerMaxHp: player.hp, playerMp: player.mp, playerMaxMp: player.mp,
    invFull: false, primaryBuild: '균형', enemyWeakness: null, enemyResistance: null,
    upgradeHint: null, traitHint: null, bossRewardHint: null, bossClearBonus: 0, swift: true,
    ...extra,
});

test('첫 전직 전에는 잠겨 있다(Q2 (b)) — 모험가는 어디서든 locked, 전직하면 풀린다', () => {
    assert.equal(isAutoExploreUnlocked({ job: CONSTANTS.DEFAULT_JOB }), false);
    assert.equal(isAutoExploreUnlocked({ job: '전사' }), true);
    const adventurer = playerAt(LOC, { job: CONSTANTS.DEFAULT_JOB });
    assert.deepEqual(getAutoExploreStep(stateOf(adventurer)), { kind: 'stop', reason: 'locked' });
    assert.equal(canStartAutoExplore(stateOf(adventurer)), false);
});

test('대기 · 사냥 지역 · 멈춤 조건 없음 → 탐험, 안전지대 → 멈춤', () => {
    const player = playerAt();
    assert.deepEqual(getAutoExploreStep(stateOf(player)), { kind: 'explore' });
    assert.equal(canStartAutoExplore(stateOf(player)), true);
    const town = playerAt(CONSTANTS.START_LOCATION);
    assert.equal(DB.MAPS[CONSTANTS.START_LOCATION].type, 'safe');
    assert.deepEqual(getAutoExploreStep(stateOf(town)), { kind: 'stop', reason: 'safe_zone' });
});

test('생명 문턱(Q3 (b)) — 설정 30 · 50 · 70%, 실제 멈춤은 결과 카드 문턱(35%) 아래로 내려가지 않는다', () => {
    assert.deepEqual([...BALANCE.AUTO_EXPLORE_HP_STOP_OPTIONS], [0.3, 0.5, 0.7]);
    assert.equal(getAutoExploreHpSetting({}), BALANCE.AUTO_EXPLORE_HP_STOP_DEFAULT);
    assert.equal(getAutoExploreHpSetting({ settings: { autoExploreHpStop: 0.42 } }), BALANCE.AUTO_EXPLORE_HP_STOP_DEFAULT, '목록 밖 값은 기본');
    assert.equal(getAutoExploreHpStopRatio({ settings: { autoExploreHpStop: 0.3 } }), BALANCE.POST_COMBAT_HP_LOW_RATIO);
    assert.equal(getAutoExploreHpStopRatio({ settings: { autoExploreHpStop: 0.7 } }), 0.7);

    for (const setting of [0.3, 0.5, 0.7]) {
        const base = playerAt(LOC, { settings: { autoExploreHpStop: setting } });
        const maxHp = getEffectiveMaxHp(base);
        const stopAt = Math.max(setting, BALANCE.POST_COMBAT_HP_LOW_RATIO);
        const atLine = { ...base, hp: Math.floor(maxHp * stopAt) };
        const above = { ...base, hp: Math.floor(maxHp * stopAt) + 2 };
        assert.deepEqual(getAutoExploreStep(stateOf(atLine)), { kind: 'stop', reason: 'hp_low' }, `${setting}: 문턱 이하`);
        assert.deepEqual(getAutoExploreStep(stateOf(above)), { kind: 'explore' }, `${setting}: 문턱 위`);
    }
});

test('기력 30% 이하 · 가방 가득은 멈춘다', () => {
    const base = playerAt();
    const maxMp = getEffectiveMaxMpFull(base, base.relics, base.maxMp);
    assert.deepEqual(getAutoExploreStep(stateOf({ ...base, mp: Math.floor(maxMp * BALANCE.POST_COMBAT_MP_LOW_RATIO) })), { kind: 'stop', reason: 'mp_low' });
    const capacity = getInventoryCapacity(base);
    const full = { ...base, inv: Array.from({ length: capacity }, (_, i) => ({ id: `m${i}`, name: '돌멩이', type: 'mat' })) };
    assert.deepEqual(getAutoExploreStep(stateOf(full)), { kind: 'stop', reason: 'bag_full' });
    const almost = { ...full, inv: full.inv.slice(1) };
    assert.deepEqual(getAutoExploreStep(stateOf(almost)), { kind: 'explore' });
});

test('탐험의 판단 결과(이벤트 · AI 준비 · 유물 선택)는 멈춘다 — 작은 발견은 대기 그대로라 계속(Q4 (a))', () => {
    const player = playerAt();
    assert.deepEqual(getAutoExploreStep(stateOf(player, { pendingRelics: [structuredClone(HARMLESS_RELIC)] })), { kind: 'stop', reason: 'relic_choice' });
    assert.deepEqual(getAutoExploreStep(stateOf(player, { currentEvent: { title: '정찰' } })), { kind: 'stop', reason: 'event' });
    assert.deepEqual(getAutoExploreStep(stateOf(player, { isAiThinking: true })), { kind: 'stop', reason: 'event' });
    assert.deepEqual(getAutoExploreStep(stateOf(player, { pendingRelics: [] })), { kind: 'explore' }, '빈 제안은 멈춤이 아니다');
});

test('모드 — 이벤트 · 준비 중은 event, 사망은 defeat, 그 밖의 화면은 mode', () => {
    const player = playerAt();
    for (const mode of Object.values(GS)) {
        if (mode === GS.IDLE || mode === GS.COMBAT) continue;
        const expected = mode === GS.EVENT || mode === GS.EVENT_PENDING ? 'event' : mode === GS.DEAD ? 'defeat' : 'mode';
        assert.deepEqual(getAutoExploreStep(stateOf(player, { gameState: mode })), { kind: 'stop', reason: expected }, mode);
    }
});

test('결과 카드 — 접힌 카드(isSwiftPostCombat)면 계속 탐험, 접히지 않는 결과는 멈춘다', () => {
    const player = playerAt();
    const signatureName = Object.keys(SIGNATURE_ITEM_REGISTRY)[0];
    assert.deepEqual(getAutoExploreStep(stateOf(player, { postCombatResult: swiftResult(player) })), { kind: 'explore' });
    assert.deepEqual(getAutoExploreStep(stateOf(player, { postCombatResult: swiftResult(player, { items: ['돌멩이'] }) })), { kind: 'explore' }, '일반 전리품은 판단이 아니다');
    const blocking = {
        leveledUp: { leveledUp: true },
        enemyActed: { swift: false },
        elite: { enemyTier: 'ELITE' },
        invFull: { invFull: true },
        upgrade: { upgradeHint: { name: '검', summary: '+3' } },
        signature: { items: [signatureName] },
        hpLow: { playerHp: 1 },
    };
    for (const [label, extra] of Object.entries(blocking)) {
        assert.deepEqual(
            getAutoExploreStep(stateOf(player, { postCombatResult: swiftResult(player, extra) })),
            { kind: 'stop', reason: 'decision_card' },
            label,
        );
    }
});

test('전투 — 보스 · 정예 · 우두머리 · 공격을 흐트러뜨리는 상태이상 · 이미 행동한 적은 멈춘다', () => {
    const player = playerAt();
    const enemy = { ...plainEnemy(player), hp: 1 };
    assert.deepEqual(getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy })), { kind: 'attack' });
    const cases = [
        ['boss', { isBoss: true }, {}],
        ['elite', { isElite: true }, {}],
        ['champion', { huntChampion: true, isElite: true }, {}],
        ['not_one_shot', { actionCount: 1 }, {}],
        ['status', {}, { status: ['blind'] }],
        ['status', {}, { status: ['fear'] }],
        ['status', {}, { status: ['stun'] }],
    ];
    for (const [reason, enemyExtra, playerExtra] of cases) {
        const step = getAutoExploreStep(stateOf({ ...player, ...playerExtra }, { gameState: GS.COMBAT, enemy: { ...enemy, ...enemyExtra } }));
        assert.deepEqual(step, { kind: 'stop', reason }, `${reason} ${JSON.stringify(enemyExtra)} ${JSON.stringify(playerExtra)}`);
    }
    assert.deepEqual(getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: null })), { kind: 'stop', reason: 'mode' });
});

test('일반 공격 경계 — 최소 피해와 같은 생명이면 공격, 한 점 더 많으면(고른 기술이 위력 없음) 멈춤', () => {
    const player = withSkill(playerAt(), '광폭화');
    const enemy = plainEnemy(player);
    const minimum = minimumDamage(player, enemy);
    assert.ok(minimum > 1, `최소 피해 ${minimum}`);
    const atLine = { ...enemy, hp: minimum, maxHp: Math.max(minimum, enemy.maxHp) };
    const over = { ...enemy, hp: minimum + 1, maxHp: Math.max(minimum + 1, enemy.maxHp) };
    assert.equal(isOneShotWithMinimumAttack(player, atLine), true);
    assert.equal(isOneShotWithMinimumAttack(player, over), false);
    assert.deepEqual(getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: over })), { kind: 'stop', reason: 'not_one_shot' });
});

test('판정이 공격을 내면 실제 전투 턴은 어느 씨앗에서도 승리다 — 적이 행동하지 않는다', () => {
    const player = playerAt();
    const enemy = plainEnemy(player);
    const minimum = minimumDamage(player, enemy);
    // 최소 피해 아래부터 분산 위쪽(+25%)까지 생명을 훑는다 — 공격을 낸 생명마다 모든 씨앗이 승리여야 한다.
    let attacked = 0;
    for (let hp = Math.max(1, minimum - 3); hp <= Math.ceil(minimum * 1.25); hp += 1) {
        const foe = { ...enemy, hp, maxHp: Math.max(hp, enemy.maxHp) };
        if (getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: foe })).kind !== 'attack') continue;
        attacked += 1;
        for (let seed = 1; seed <= 60; seed += 1) {
            const turn = resolveCombatActionTurn({ player, enemy: foe, kind: 'attack', initialPlayer: player, seed, now: 0 });
            assert.equal(turn.kind, 'victory', `hp ${hp} seed ${seed}`);
            assert.equal(turn.signals?.enemyActed, false, `hp ${hp} seed ${seed}`);
        }
    }
    assert.equal(attacked, 4, '최소 피해 이하 생명(4가지)에서만 공격한다');
});

test('판정은 게임 난수를 쓰지 않고 상태를 바꾸지 않는다', () => {
    const player = playerAt();
    const enemy = plainEnemy(player);
    const states = [
        stateOf(player),
        stateOf(player, { postCombatResult: swiftResult(player) }),
        stateOf(player, { gameState: GS.COMBAT, enemy }),
        stateOf(player, { gameState: GS.COMBAT, enemy: { ...enemy, hp: 1 } }),
    ];
    for (const state of states) {
        const before = structuredClone(state);
        noRandom(() => getAutoExploreStep(state));
        assert.deepEqual(state, before);
    }
});

test('멈춤 이유마다 화면 문구가 있다', () => {
    const reasons = ['locked', 'safe_zone', 'mode', 'event', 'relic_choice', 'decision_card', 'mp_low', 'bag_full',
        'boss', 'elite', 'champion', 'not_one_shot', 'status', 'defeat', 'manual', 'hidden'];
    for (const reason of reasons) {
        assert.equal(typeof MSG.AUTO_EXPLORE_STOP[reason], 'string', reason);
        assert.ok(MSG.AUTO_EXPLORE_STOP[reason].length > 0, reason);
    }
    assert.match(MSG.AUTO_EXPLORE_STOP_HP_LOW(50), /50%/);
});

test('Q1 (c) — 일반 공격으로 안 되면 고른 기술 최소 피해로 한 번에 쓰러지는 적에게 기술을 쓴다, 경계 한 점 위는 멈춤', () => {
    const player = withSkill(playerAt(), '파워배시');
    const enemy = plainEnemy(player);
    const attackLine = minimumDamage(player, enemy);
    const line = skillLine(player, enemy);
    assert.ok(line > attackLine, `기술 경계 ${line} > 일반 공격 경계 ${attackLine}`);
    const at = (hp) => getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: { ...enemy, hp, maxHp: Math.max(hp, enemy.maxHp) } }));
    assert.deepEqual(at(attackLine), { kind: 'attack' }, '일반 공격으로 되면 기력을 쓰지 않는다');
    assert.deepEqual(at(attackLine + 1), { kind: 'skill' });
    assert.deepEqual(at(line), { kind: 'skill' });
    assert.deepEqual(at(line + 1), { kind: 'stop', reason: 'not_one_shot' });
});

test('Q1 (c) — 판정이 기술을 내면 실제 전투 턴은 어느 씨앗에서도 승리다(연속 타격 · 지속 피해 · 속성 기술 포함)', () => {
    const cases = [
        withSkill(playerAt(), '파워배시'),
        withSkill(playerAt(LOC, { job: '전사', level: 30 }), '출혈베기'),
        withSkill(playerAt(LOC, { job: '어쌔신', level: 30, atk: 200 }), '이중 자상'),
        withSkill(playerAt(LOC, { job: '아크메이지', level: 30, atk: 220, mp: 300, maxMp: 300 }), '메테오'),
    ];
    for (const player of cases) {
        const enemy = plainEnemy(player);
        const line = skillLine(player, enemy);
        let skilled = 0;
        // 경계 바로 아래 · 위(±3)와 경계의 80 ~ 125%를 훑는다 — 기술을 낸 생명마다 모든 씨앗이 승리여야 한다.
        const stride = Math.max(1, Math.floor(line / 40));
        const hps = new Set([line - 3, line - 2, line - 1, line, line + 1, line + 2, line + 3]);
        for (let hp = Math.floor(line * 0.8); hp <= Math.ceil(line * 1.25); hp += stride) hps.add(hp);
        for (const hp of [...hps].filter((value) => value >= 1)) {
            const foe = { ...enemy, hp, maxHp: Math.max(hp, enemy.maxHp) };
            if (getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: foe })).kind !== 'skill') continue;
            skilled += 1;
            for (let seed = 1; seed <= 40; seed += 1) {
                const turn = resolveCombatActionTurn({ player, enemy: foe, kind: 'skill', initialPlayer: player, seed, now: 0 });
                assert.equal(turn.kind, 'victory', `${player.job} hp ${hp} seed ${seed}`);
                assert.equal(turn.signals?.enemyActed, false, `${player.job} hp ${hp} seed ${seed}`);
            }
        }
        assert.ok(skilled >= 4, `${player.job}: 경계 아래 생명에서 기술을 낸다 (${skilled})`);
    }
});

test('Q1 (c) — 위력 없는 기술 · 뒤섞인 기술 회차 · 기력 부족 · 재사용 대기면 기술을 쓰지 않는다', () => {
    const base = withSkill(playerAt(), '파워배시');
    const enemy = plainEnemy(base);
    const hp = minimumDamage(base, enemy) + 1;
    const foe = { ...enemy, hp, maxHp: Math.max(hp, enemy.maxHp) };
    const step = (player) => getAutoExploreStep(stateOf(player, { gameState: GS.COMBAT, enemy: foe }));
    assert.deepEqual(step(base), { kind: 'skill' });
    const blocked = {
        support: withSkill(playerAt(), '광폭화'),
        randomSkills: { ...base, challengeModifiers: ['randomSkills'] },
        mpShort: { ...base, mp: 0 },
        cooldown: { ...base, skillLoadout: { ...base.skillLoadout, cooldowns: { 파워배시: 2 } } },
    };
    for (const [label, player] of Object.entries(blocked)) {
        assert.deepEqual(step(player), { kind: 'stop', reason: 'not_one_shot' }, label);
    }
    noRandom(() => step(base));
});
