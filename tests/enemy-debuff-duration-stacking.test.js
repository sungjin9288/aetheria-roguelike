import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * 2026-09 Wave 44 — 적 약화(실명 · 공포 · 저주 · 도발)의 "N턴"은 영향받는 적 행동 N번이고,
 * 겹친 약화는 각자 자기 턴만큼 작동한다.
 *
 * 원장 §44: 두 결함이 한 함수(`tickEnemyStatus`)에 있었다.
 * 1. 턴 감소가 적 행동 **전에** 일어나 "3턴" 공포는 공격 2번, "2턴" 연막탄은 1번, "3턴" 도발은 강타 2번만
 *    바꿨다(기절은 이미 N번이었다). 전투 화면의 "공포 · 1턴"은 다음 공격이 줄지 않는 상태였다.
 * 2. 약화가 공격력 배율 하나(`atkMult`)를 함께 쓰고 만료가 그 값을 지워, 먼저 끝난 약화가 남은 약화의
 *    감소까지 없앴다(흑마법사 다크메터 → 공포: 공포 1턴이 남았는데 전량 피해).
 *
 * 2026-10 Wave 55: 실명은 공격력 ×0.65가 아니라 적 공격의 35% 빗나감이다(연막탄 "적 명중률 하락").
 * 턴 모델은 같다 — "2턴" 실명은 적 행동 2번에 빗나감을 굴린다. 공격력 배율 계산에서는 빠졌다.
 */

const ENEMY_ATK = 1000;
// 공격 판정용 rng — 0.5는 기본 패턴(방어 0 · 강타 0)에서 일반 공격, 도발(강타 1.0)에서 강타다.
const ATTACK_RNG = () => 0.5;
// 실명 빗나감이 걸리는 rng — 0.1 < BLIND_ENEMY_MISS_CHANCE(0.35). 실명이 없으면 0.5와 같은 일반 공격이다.
const MISS_RNG = () => 0.1;
// 시전용 rng — 확률 부여 분기(effectChance)도 항상 걸리게 한다.
const CAST_RNG = () => 0;
const STATS = { atk: 60, def: 0, relics: [], activeSynergies: [], maxMp: 9999 };
const makePlayer = (job) => ({
    hp: 900000, maxHp: 900000, mp: 9999, maxMp: 9999, status: [], job, equip: {},
    skillLoadout: { selected: 0, cooldowns: {} },
});
const makeEnemy = (extra = {}) => ({
    name: '검증용 몬스터', hp: 5e6, maxHp: 5e6, atk: ENEMY_ATK, def: 0,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});

/** 적 행동 한 번 — 생명을 되돌려 다음 행동도 같은 조건에서 잰다. */
const enemyAct = (player, enemy, rng = ATTACK_RNG) => {
    const result = CombatEngine.enemyAttack(player, enemy, STATS, rng);
    return { damage: player.hp - result.updatedPlayer.hp, enemy: result.updatedEnemy, logs: result.logs };
};

/** 약화별 영향받은 적 행동의 피해 — 엔진 헬퍼가 아니라 데이터 · 상수에서 직접 만든 오라클. */
const DEBUFF_FIELD = { blind: 'blindTurns', fear: 'fearTurns', curse: 'cursedTurns', taunt: 'tauntTurns' };
const DEFAULT_TURNS = { blind: 2, fear: 2, curse: 3, taunt: 3 };

/** 모든 직업 기술 + 분기 변형 중 실명 · 공포 · 저주 · 도발을 거는 것(기절 · 빙결과 함께 거는 분기는 뒤 케이스). */
const debuffSkills = () => {
    const rows = [];
    for (const [job, def] of Object.entries(CLASSES)) {
        for (const base of def.skills || []) {
            if (base.passive) continue;
            const variants = [{ id: `${job}/${base.name}`, skill: base }];
            for (const branch of def.skillBranches?.[base.name] || []) {
                variants.push({ id: `${job}/${base.name}/${branch.choice}`, skill: { ...base, ...branch.override } });
            }
            for (const { id, skill } of variants) {
                const effects = [skill.effect, skill.secondEffect].filter(Boolean);
                if (effects.some((effect) => effect === 'stun' || effect === 'freeze')) continue;
                const debuff = effects.find((effect) => effect in DEBUFF_FIELD);
                if (debuff) rows.push({ id, job, skill, debuff });
            }
        }
    }
    return rows;
};

const expectedTurns = (skill, debuff) => {
    if (debuff === 'curse') return Math.floor(skill.curseTurn || DEFAULT_TURNS.curse);
    return Math.floor(skill.turn || 0) > 0 ? Math.floor(skill.turn) : DEFAULT_TURNS[debuff];
};
const expectedAffectedDamage = (skill, debuff) => {
    if (debuff === 'blind') return 0; // MISS_RNG에서 빗나간다(Wave 55)
    if (debuff === 'curse') return Math.floor(ENEMY_ATK * BALANCE.CURSE_ATK_MULT);
    if (debuff === 'taunt') return Math.floor(ENEMY_ATK * 1.4);
    const fearMult = typeof skill.val === 'number' && skill.val > 0 && skill.val < 1 ? skill.val : BALANCE.FEAR_ATK_MULT;
    return Math.floor(ENEMY_ATK * fearMult);
};

test('약화 기술의 "N턴"은 적 행동 N번에 작동하고, 남은 턴 표시는 앞으로 영향받을 행동 수다', () => {
    const rows = debuffSkills();
    // 표본이 비면 이 계약은 공허하다 — 실명 · 공포 · 저주 · 도발이 모두 들어 있어야 한다.
    assert.deepEqual([...new Set(rows.map((row) => row.debuff))].sort(), ['blind', 'curse', 'fear', 'taunt']);

    for (const { id, job, skill, debuff } of rows) {
        const turns = expectedTurns(skill, debuff);
        const affected = expectedAffectedDamage(skill, debuff);
        const cast = CombatEngine.performSkill(makePlayer(job), makeEnemy(), STATS, skill, CAST_RNG);
        assert.equal(cast.success, true, `${id} 시전 성공`);
        let enemy = cast.updatedEnemy;
        const player = makePlayer(job);
        const damages = [];
        const rng = debuff === 'blind' ? MISS_RNG : ATTACK_RNG;
        for (let action = 0; action < turns + 2; action += 1) {
            const act = enemyAct(player, enemy, rng);
            damages.push(act.damage);
            enemy = act.enemy;
            // 행동 뒤 남은 턴 = 이후 영향받을 행동 수(전투 화면이 그대로 그린다).
            const remaining = Math.max(0, turns - action - 1);
            assert.equal(enemy[DEBUFF_FIELD[debuff]] ?? 0, remaining, `${id} ${action + 1}번째 행동 뒤 남은 턴`);
        }
        const expected = [...Array(turns).fill(affected), ENEMY_ATK, ENEMY_ATK];
        assert.deepEqual(damages, expected, `${id}: ${turns}턴 = 적 행동 ${turns}번`);
    }
});

test('겹친 약화는 각자 자기 턴만큼 작동한다 — 적 행동마다 걸려 있는 약화 중 가장 강한 배율', () => {
    // 공포 배율 셋: 0.6 · 군주의 위엄 0.65 · 저주보다 약한 0.8 — 순서와 강도가 어긋나는 값을 함께 잰다.
    //   실명은 Wave 55부터 배율에 끼지 않는다(빗나감 확률) — ATTACK_RNG(0.5)에서는 빗나가지 않으므로 실명이 걸려 있어도
    //   피해는 공포 · 저주만으로 정해지고, 실명 턴은 그대로 줄어든다.
    let cases = 0;
    for (const FEAR_MULT of [0.6, 0.65, 0.8]) for (let blind = 0; blind <= 3; blind += 1) {
        for (let fear = 0; fear <= 3; fear += 1) {
            for (let curse = 0; curse <= 3; curse += 1) {
                let enemy = makeEnemy({
                    ...(blind ? { blindTurns: blind } : {}),
                    ...(fear ? { fearTurns: fear, fearAtkMult: FEAR_MULT } : {}),
                    ...(curse ? { cursedTurns: curse, cursed: true } : {}),
                });
                const player = makePlayer('전사');
                for (let action = 0; action <= 4; action += 1) {
                    const active = [
                        ...(fear > action ? [FEAR_MULT] : []),
                        ...(curse > action ? [BALANCE.CURSE_ATK_MULT] : []),
                    ];
                    const expected = Math.floor(ENEMY_ATK * 1 * Math.min(1, ...active));
                    const act = enemyAct(player, enemy);
                    assert.equal(act.damage, expected, `실명 ${blind} · 공포 ${fear}(×${FEAR_MULT}) · 저주 ${curse} — ${action + 1}번째 행동`);
                    assert.equal(act.enemy.blindTurns ?? 0, Math.max(0, blind - action - 1), `실명 ${blind} — ${action + 1}번째 행동 뒤 남은 턴`);
                    enemy = act.enemy;
                    cases += 1;
                }
            }
        }
    }
    assert.equal(cases, 3 * 4 * 4 * 4 * 5);
});

test('실경로 재현: 흑마법사 다크메터 → 공포 — 저주가 먼저 끝나도 공포의 감소는 남는다', () => {
    const job = '흑마법사';
    const skill = (name) => CLASSES[job].skills.find((entry) => entry.name === name);
    const player = makePlayer(job);
    let enemy = CombatEngine.performSkill(makePlayer(job), makeEnemy(), STATS, skill('다크메터'), CAST_RNG).updatedEnemy;
    const damages = [];
    let act = enemyAct(player, enemy);
    damages.push(act.damage);
    enemy = CombatEngine.performSkill(makePlayer(job), act.enemy, STATS, skill('공포'), CAST_RNG).updatedEnemy;
    for (let action = 0; action < 4; action += 1) {
        act = enemyAct(player, enemy);
        damages.push(act.damage);
        enemy = act.enemy;
    }
    // 저주(3턴)는 행동 1~3, 공포(3턴)는 행동 2~4. 행동 3에서 저주가 끝나지만 공포 −30%는 행동 4까지 남는다.
    assert.deepEqual(damages, [750, 700, 700, 700, 1000]);
});

test('공격력 감소 로그는 실제로 줄어든 공격에만, 실명 빗나감 로그는 빗나간 공격에만 남는다', () => {
    const player = makePlayer('전사');
    let enemy = CombatEngine.performSkill(makePlayer('전사'), makeEnemy(), STATS, CLASSES['전사'].skills.find((s) => s.name === '전투 함성'), CAST_RNG).updatedEnemy;
    const reducedLogs = [];
    for (let action = 0; action < 5; action += 1) {
        const act = enemyAct(player, enemy);
        reducedLogs.push(act.damage < ENEMY_ATK && act.logs.some((log) => log.type === 'info' && log.text.includes('공포')));
        enemy = act.enemy;
    }
    assert.deepEqual(reducedLogs, [true, true, true, false, false], '전투 함성 3턴');

    // Wave 55: 연막탄(실명 2턴) — 빗나감을 굴리는 행동은 2번이고, 빗나간 공격만 로그를 남긴다.
    const rogue = makePlayer('도적');
    enemy = CombatEngine.performSkill(makePlayer('도적'), makeEnemy(), STATS, CLASSES['도적'].skills.find((s) => s.name === '연막탄'), CAST_RNG).updatedEnemy;
    const missLogs = [];
    const damages = [];
    for (let action = 0; action < 4; action += 1) {
        const act = enemyAct(rogue, enemy, MISS_RNG);
        missLogs.push(act.logs.some((log) => log.text === MSG.ENEMY_BLIND_MISS(enemy.name)));
        damages.push(act.damage);
        enemy = act.enemy;
    }
    assert.deepEqual(missLogs, [true, true, false, false]);
    assert.deepEqual(damages, [0, 0, ENEMY_ATK, ENEMY_ATK]);
});

test('도발 예고는 다음 행동과 같다 — 남은 턴이 있으면 강타, 없으면 평소 패턴', () => {
    const provoke = CLASSES['나이트'].skills.find((s) => s.name === '도발');
    assert.ok(provoke, '나이트/도발');
    const player = makePlayer('나이트');
    let enemy = CombatEngine.performSkill(makePlayer('나이트'), makeEnemy(), STATS, provoke, CAST_RNG).updatedEnemy;
    let checked = 0;
    for (let action = 0; action < provoke.turn + 2; action += 1) {
        const telegraph = CombatEngine.predictEnemyNextAction(enemy);
        const act = enemyAct(player, enemy);
        const heavy = act.damage > ENEMY_ATK;
        assert.equal(telegraph.type === 'heavy', heavy, `${action + 1}번째 행동 예고(${telegraph.type})와 실제(${heavy ? '강타' : '일반'})`);
        enemy = act.enemy;
        checked += 1;
    }
    assert.equal(checked, provoke.turn + 2);
});

test('약한 공포가 이미 걸린 강한 공포를 덮어쓰지 않는다 — 배율은 강한 쪽, 턴은 새로 건 기술', () => {
    const battleCry = CLASSES['전사'].skills.find((s) => s.name === '전투 함성'); // 0.75 · 3턴
    const enemy = makeEnemy({ fearTurns: 1, fearAtkMult: 0.65 });
    const after = CombatEngine.performSkill(makePlayer('전사'), enemy, STATS, battleCry, CAST_RNG).updatedEnemy;
    assert.equal(after.fearAtkMult, 0.65);
    assert.equal(after.fearTurns, battleCry.turn);
    const fresh = CombatEngine.performSkill(makePlayer('전사'), makeEnemy(), STATS, battleCry, CAST_RNG).updatedEnemy;
    assert.equal(fresh.fearAtkMult, battleCry.val, '공포가 없던 적에는 기술 값 그대로');
});

test('구세이브 전투 중 적: 남은 atkMult는 읽지 않고, 배율 없는 공포는 기본값이다', () => {
    const player = makePlayer('전사');
    // Wave 44 이전 세이브는 약화가 끝난 뒤에도 atkMult가 남을 수 있었다(만료 경로 밖에서 저장된 경우).
    assert.equal(enemyAct(player, makeEnemy({ atkMult: 0.65 })).damage, ENEMY_ATK, '약화 없는 적의 잔여 atkMult는 피해를 줄이지 않는다');
    assert.equal(
        enemyAct(player, makeEnemy({ fearTurns: 2, atkMult: 0.65 })).damage,
        Math.floor(ENEMY_ATK * BALANCE.FEAR_ATK_MULT),
        '배율이 저장되지 않은 공포는 BALANCE.FEAR_ATK_MULT',
    );
});
