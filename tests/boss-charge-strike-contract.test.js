import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import {
    getChargeBreakDamage, getChargeFirstStrike, getChargeReleaseMult, isBreathAction, isChargeBrokenByDamage, isChargeStrikeCount, isChargeTurn,
} from '../src/systems/bossMechanics.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { estimateEnemyMaxHit, estimateEnemyNextHit } from '../src/utils/enemyThreat.js';
import { getEnemyIntent } from '../src/utils/enemyIntent.js';

/**
 * 2026-11 H5 충전 강타(소유자 결정 Q1 ~ Q4, docs/EXECUTION_SKETCH_H5_2026-11.md).
 * 보스가 정해진 차례에 공격 대신 힘을 모으고 다음 차례에 큰 한 방을 낸다. 모으는 동안 기절시키거나 크게 때리면 끊긴다.
 * 이 파일은 엔진 동작 · 끊기 두 경로 · 예고 = 실제 · 난수 소비 · 위험 중립(충전 + 강타 ≤ 보통 두 행동)을 지킨다.
 */

const PROBE = () => BALANCE.ENEMY_THREAT_PROBE_ROLL;

const makePlayer = (extra = {}) => ({
    name: '시험자', job: '전사', level: 40, hp: 40_000, maxHp: 40_000, mp: 200, maxMp: 200, atk: 200, def: 60, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
const makeBoss = (extra = {}) => ({
    name: '시험 보스', baseName: '시험 보스', level: 40, hp: 10_000, maxHp: 10_000, atk: 400, def: 50, exp: 1, gold: 1, isBoss: true,
    pattern: { guardChance: 0.2, heavyChance: 0.3 },
    mechanics: { charge: { name: '대지 분쇄' } },
    ...extra,
});
const stats = (player) => calculateFullStats(player);
const act = (player, enemy, rng = PROBE) => CombatEngine.enemyAttack(player, enemy, stats(player), rng);
const texts = (result) => result.logs.map((log) => log.text);
/** 소비한 난수 수를 센다(값은 고정 굴림). */
const countingRng = () => {
    const rng = () => { rng.calls += 1; return BALANCE.ENEMY_THREAT_PROBE_ROLL; };
    rng.calls = 0;
    return rng;
};

/** 적 행동 n번(그 사이 플레이어 행동 없음) — 각 결과를 돌려준다. */
const runActions = (player, enemy, n, rng = PROBE) => {
    const results = [];
    let foe = enemy;
    for (let i = 0; i < n; i += 1) {
        const result = act(player, foe, rng);
        results.push(result);
        foe = result.updatedEnemy;
    }
    return results;
};

test('기본 주기 4 · 첫 강타 2번째 — 1번째 행동은 충전(피해 0 · 예상 줄), 2번째는 강타(방어 판정 없음), 5 · 6번째에 다시', () => {
    const player = makePlayer();
    const boss = makeBoss({ pattern: { guardChance: 1, heavyChance: 0 } });
    const results = runActions(player, boss, 8);
    assert.equal(BALANCE.BOSS_CHARGE_EVERY, 4);
    // 소유자 결정 "B로 확정"(스케치 §8.1) — 첫 행동이 충전이다.
    assert.equal(BALANCE.BOSS_CHARGE_FIRST_STRIKE, 2);
    // 방어 확률 100% — 보통 행동은 모두 방어 자세, 충전 · 강타 차례만 다르다.
    for (const i of [2, 3, 6, 7]) assert.equal(results[i].updatedEnemy.guarding, true, `행동 ${i + 1} 방어`);
    for (const i of [0, 4]) {
        assert.equal(results[i].damage, 0);
        assert.equal(results[i].updatedEnemy.chargeArmed, true);
        assert.ok(texts(results[i]).some((t) => t.includes('대지 분쇄') && t.includes('준비합니다')), `행동 ${i + 1} 준비 줄`);
    }
    for (const i of [1, 5]) {
        assert.ok(results[i].damage > 0, `행동 ${i + 1} 강타`);
        assert.equal(results[i].updatedEnemy.chargeArmed, undefined);
        assert.equal(results[i].updatedEnemy.guarding, false);
        assert.ok(texts(results[i]).includes(MSG.BOSS_CHARGE_RELEASE_HIT('시험 보스', '대지 분쇄', results[i].damage)));
    }
});

test('끊기 ① 기절 — 강타 차례가 기절 차례로 쓰이고 모은 힘이 사라진다, 다음 행동은 보통 행동', () => {
    const player = makePlayer();
    const [charged] = runActions(player, makeBoss(), 1);
    const stunned = act(player, { ...charged.updatedEnemy, stunnedTurns: 1 });
    assert.equal(stunned.damage, 0);
    assert.equal(stunned.updatedEnemy.chargeArmed, undefined);
    assert.ok(texts(stunned).includes(MSG.BOSS_CHARGE_BROKEN('시험 보스', '대지 분쇄')));
    const next = act(player, stunned.updatedEnemy);
    assert.ok(!texts(next).some((t) => t.includes('대지 분쇄')), '3번째 행동은 보통 행동');
});

test('끊기 ② 피해 — 충전 뒤 최대 생명 × 15% 이상 깎으면 강타 행동이 사라진다(한 칸 모자라면 강타)', () => {
    const player = makePlayer();
    const [charged] = runActions(player, makeBoss(), 1);
    const armed = charged.updatedEnemy;
    const need = getChargeBreakDamage(armed);
    assert.equal(need, Math.ceil(10_000 * BALANCE.BOSS_CHARGE_BREAK_RATIO));
    const almost = { ...armed, hp: armed.hp - (need - 1) };
    assert.equal(isChargeBrokenByDamage(almost), false);
    assert.ok(act(player, almost).damage > 0, '모자라면 강타가 나간다');
    const broken = { ...armed, hp: armed.hp - need };
    assert.equal(isChargeBrokenByDamage(broken), true);
    const rng = countingRng();
    const result = act(player, broken, rng);
    assert.equal(result.damage, 0);
    assert.equal(result.updatedEnemy.chargeArmed, undefined);
    assert.ok(texts(result).includes(MSG.BOSS_CHARGE_BROKEN('시험 보스', '대지 분쇄')));
    assert.equal(rng.calls, 1, '끊긴 행동도 행동 판정 난수를 한 번 쓴다');
});

test('충전 차례는 난수를 한 번 쓴다 — 예상 피해 계산은 게임 난수를 쓰지 않는다', () => {
    const player = makePlayer();
    const boss = { ...makeBoss(), actionCount: 4 };
    const rng = countingRng();
    const result = act(player, boss, rng);
    assert.equal(result.updatedEnemy.chargeArmed, true);
    assert.equal(rng.calls, 1);
});

test('예고 = 실제 — 준비 줄 · 의도 칩의 숫자가 다음 행동의 실제 강타 피해와 같다', () => {
    const player = makePlayer({ def: 120 });
    // 충전 직전 예고(교전 시작 — 첫 행동이 충전)는 "공격하지 않음"이고 숫자를 그리지 않는다.
    const before = getEnemyIntent(player, makeBoss());
    assert.equal(before.kind, 'charging');
    assert.equal(before.hit, null);
    const [charged] = runActions(player, makeBoss(), 1);
    const armed = charged.updatedEnemy;
    const intent = getEnemyIntent(player, armed);
    assert.equal(intent.kind, 'charge');
    const release = act(player, armed);
    assert.equal(intent.hit, release.damage);
    assert.equal(estimateEnemyNextHit(player, armed, 'charge'), release.damage);
    const pct = Math.ceil((release.damage / stats(player).maxHp) * 100);
    assert.ok(texts(charged).includes(MSG.BOSS_CHARGE_START('시험 보스', '대지 분쇄', release.damage, pct)));
    // 끊는 피해를 받은 뒤의 예고는 "다음 행동 없음"이다.
    const brokenIntent = getEnemyIntent(player, { ...armed, hp: armed.hp - getChargeBreakDamage(armed) });
    assert.equal(brokenIntent.kind, 'broken');
    assert.equal(brokenIntent.hit, null);
});

test('위협 줄(가장 센 한 방)은 충전 강타를 포함한다', () => {
    const player = makePlayer({ def: 10 });
    const boss = makeBoss({ pattern: { guardChance: 0, heavyChance: 0.5 } });
    const armed = { ...boss, actionCount: 1, chargeArmed: true, chargeHpMark: boss.hp };
    const release = act(player, armed);
    assert.ok(estimateEnemyMaxHit(player, boss) >= release.damage);
    // 3번째 행동은 보통 행동이다(충전 · 강타 차례가 아니다).
    const heavy = act(player, { ...boss, actionCount: 2, pattern: { guardChance: 0, heavyChance: 1 } }).damage;
    assert.ok(heavy > 0);
    assert.ok(release.damage > heavy, '방어력이 낮으면 강타보다 크다');
});

test('위험 중립(Q3 (a)) — 충전 + 강타 두 행동의 피해 ≤ 보통 두 행동의 기대 피해, 어떤 방어력 · 패턴에서도', () => {
    const patterns = [
        { guardChance: 0.2, heavyChance: 0.2 }, { guardChance: 0, heavyChance: 0.6 }, { guardChance: 0.4, heavyChance: 0.4 },
        { guardChance: 0, heavyChance: 0 }, { guardChance: 0.5, heavyChance: 0.1 },
    ];
    let checked = 0;
    for (const pattern of patterns) {
        for (const def of [0, 30, 100, 250, 400, 600]) {
            const player = makePlayer({ def });
            const boss = makeBoss({ pattern });
            // 보통 행동은 3번째 행동(충전 · 강타 차례 밖)으로 잰다.
            const normalHit = act(player, { ...boss, actionCount: 2, pattern: { guardChance: 0, heavyChance: 0 } }).damage;
            const heavyHit = act(player, { ...boss, actionCount: 2, pattern: { guardChance: 0, heavyChance: 1 } }).damage;
            assert.ok(normalHit > 0 && heavyHit > 0);
            const expectedTwo = 2 * (pattern.heavyChance * heavyHit + (1 - pattern.guardChance - pattern.heavyChance) * normalHit);
            const release = act(player, { ...boss, actionCount: 1, chargeArmed: true, chargeHpMark: boss.hp }).damage;
            assert.ok(release <= Math.ceil(expectedTwo) + 1, `${JSON.stringify(pattern)} def ${def}: 강타 ${release} ≤ 보통 둘 ${expectedTwo}`);
            checked += 1;
        }
    }
    assert.equal(checked, 30);
    assert.ok(Math.abs(getChargeReleaseMult({ guardChance: 0.2, heavyChance: 0.2 }) - 2 * (0.2 * BALANCE.ENEMY_HEAVY_HIT_MULT + 0.6)) < 1e-9);
});

test('충전 → 브레스(레드 드래곤 모양) — 브레스는 모은 뒤에만, 충전 차례를 기절로 넘기면 브레스가 없다', () => {
    const player = makePlayer();
    const dragon = makeBoss({
        pattern: { guardChance: 0, heavyChance: 0 },
        mechanics: { breath: { every: 3, mult: 1.6, status: 'burn' }, charge: { name: '화염 브레스', every: 3 } },
    });
    // 주기 3 · 첫 강타 2번째: 충전 1 · 4번째, 브레스 2 · 5번째.
    const [charged, breath, normal, charged2, breath2] = runActions(player, dragon, 5);
    for (const c of [charged, charged2]) {
        assert.equal(c.damage, 0);
        assert.equal(c.updatedEnemy.chargeArmed, true);
    }
    for (const b of [breath, breath2]) assert.ok(texts(b).includes(MSG.ENEMY_BREATH_HIT('시험 보스', b.damage)), '모은 다음 행동은 브레스');
    assert.ok(!texts(normal).some((t) => t.includes('브레스')), '3번째 행동은 보통 공격');
    // 충전 차례(1번째)에 기절 — 2번째 행동은 모은 상태가 아니므로 브레스가 아니다.
    const skipped = act(player, { ...dragon, stunnedTurns: 1 });
    assert.equal(skipped.updatedEnemy.chargeArmed, undefined);
    assert.equal(isBreathAction({ ...skipped.updatedEnemy, actionCount: 2 }), false);
    const second = act(player, skipped.updatedEnemy);
    assert.ok(!texts(second).some((t) => t.includes('브레스')), '모으지 못한 2번째 행동은 보통 공격');
});

test('충전을 선언하지 않은 보스는 판정이 모두 거짓이다', () => {
    const boss = makeBoss({ mechanics: undefined, actionCount: 3, chargeArmed: true });
    assert.equal(isChargeTurn({ ...boss, actionCount: 3 }), false);
    assert.equal(isChargeBrokenByDamage({ ...boss, hp: 1 }), false);
});

test('예고 칩은 끊기까지 남은 피해를 정확한 숫자로 말한다 — 깎을수록 줄어든다', () => {
    const player = makePlayer();
    const [charged] = runActions(player, makeBoss(), 1);
    const armed = charged.updatedEnemy;
    const need = getChargeBreakDamage(armed);
    assert.equal(CombatEngine.predictEnemyNextAction(armed).label, MSG.ENEMY_TELEGRAPH_CHARGE('대지 분쇄', need));
    const dealt = Math.floor(need / 3);
    const hurt = { ...armed, hp: armed.hp - dealt };
    assert.equal(CombatEngine.predictEnemyNextAction(hurt).label, MSG.ENEMY_TELEGRAPH_CHARGE('대지 분쇄', need - dealt));
    assert.doesNotMatch(MSG.ENEMY_TELEGRAPH_CHARGE('대지 분쇄', 1), /하세요|추천|권장/, '권하지 않는다(Wave 88)');
});

test('첫 강타 차례 — 보스 데이터 `first`가 우선이고, 강타는 첫 강타 뒤 `every`번째마다다', () => {
    const boss = makeBoss();
    assert.equal(getChargeFirstStrike(boss), BALANCE.BOSS_CHARGE_FIRST_STRIKE);
    const strikes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => isChargeStrikeCount(boss, n));
    assert.deepEqual(strikes, [2, 6, 10]);
    const late = makeBoss({ mechanics: { charge: { name: '대지 분쇄', first: 4 } } });
    assert.equal(getChargeFirstStrike(late), 4);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].filter((n) => isChargeStrikeCount(late, n)), [4, 8]);
    // 강타 차례는 2번째보다 앞설 수 없다(첫 행동이 충전이어야 한다).
    assert.equal(getChargeFirstStrike(makeBoss({ mechanics: { charge: { name: '대지 분쇄', first: 1 } } })), 2);
});
