import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { CLASSES } from '../src/data/classes.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 Wave 55 — 소유자 결정 "전부 설명대로 구현"(기술 설명 전수 감사 ④, 원장 §55).
 *
 * 1. 지속 피해의 "N턴간": 출혈베기 · 영혼 소환은 "3턴간"을 말하지만 지속 피해는 전투 내내였다. 이제 `turn`이 있는
 *    지속 피해 기술은 적 행동 N번 피해를 주고 사라진다. `turn`이 없는 기술의 지속 피해는 전투 내내다(이전과 같다).
 * 2. 지속 피해 "+50%": 심층 출혈 · 맹독 · 독 보강 · 역병의 안개는 지속 피해 강화를 말하지만 직접 피해 배율만
 *    (또는 아무것도) 바꿨다. 이제 `dotDamageMult`가 그 지속 피해의 틱 피해를 키운다.
 * 3. 실명 = 명중률: 연막탄은 "적 명중률 하락"을 말하지만 적 공격력 ×0.65였다. 이제 적 공격이 35% 빗나간다
 *    (기대 피해는 같다 — 1 − 0.65).
 */

const MAX_HP = 1_000_000;
const DOT_TICK = Math.floor(MAX_HP * BALANCE.STATUS_DOT_RATIO);
const CAST_RNG = () => 0; // 확률 부여(effectChance)가 항상 걸린다
const HIT_RNG = () => 0.5; // 기본 패턴(방어 0 · 강타 0)에서 일반 공격, 실명 빗나감(0.35) 밖
const STATS = { atk: 60, def: 0, relics: [], activeSynergies: [], maxMp: 9999 };
// 적 방어력은 시전 피해를 1로 눌러 둔다(적 생명 변화가 지속 피해 틱만 남도록 — 실명 케이스는 상관없다).
const DOT_IDS = ['burn', 'poison', 'bleed'];

const makePlayer = (job, skillChoices = {}) => ({
    hp: 900_000, maxHp: 900_000, mp: 9999, maxMp: 9999, status: [], job, equip: {}, skillChoices,
    skillLoadout: { selected: 0, cooldowns: {} },
});
const makeEnemy = (extra = {}) => ({
    name: '검증용 몬스터', hp: MAX_HP, maxHp: MAX_HP, atk: 1000, def: 1e9,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});
const baseSkill = (job, name) => {
    const skill = CLASSES[job].skills.find((entry) => entry.name === name);
    assert.ok(skill, `${job}/${name}`);
    return skill;
};
const castOn = (job, name, enemy = makeEnemy(), choice) => CombatEngine.performSkill(
    makePlayer(job, choice ? { [name]: choice } : {}), enemy, STATS, baseSkill(job, name), CAST_RNG,
).updatedEnemy;

/** 적 행동 한 번 — 이번 행동에서 적이 잃은 생명(= 지속 피해 틱 합)과 다음 적 상태. */
const enemyAct = (enemy, rng = HIT_RNG) => {
    const result = CombatEngine.enemyAttack(makePlayer('전사'), enemy, STATS, rng);
    return { enemy: result.updatedEnemy, damage: result.damage, logs: result.logs, hpLost: enemy.hp - result.updatedEnemy.hp };
};

/** 모든 직업 기술 + 분기 변형 중 지속 피해를 거는 것. */
const dotVariants = () => {
    const rows = [];
    for (const [job, def] of Object.entries(CLASSES)) {
        for (const base of def.skills || []) {
            if (base.passive) continue;
            const variants = [{ id: `${job}/${base.name}`, skill: base, choice: undefined }];
            for (const branch of def.skillBranches?.[base.name] || []) {
                variants.push({ id: `${job}/${base.name}/${branch.label}`, skill: { ...base, ...branch.override }, choice: branch.choice, desc: branch.desc });
            }
            for (const row of variants) {
                const dots = [row.skill.effect, row.skill.secondEffect].filter((effect) => DOT_IDS.includes(effect));
                if (dots.length) rows.push({ ...row, job, name: base.name, dots });
            }
        }
    }
    return rows;
};

test('지속 턴을 가진 지속 피해 기술은 적 행동 N번 피해를 주고 사라진다 — 전수(출혈베기 · 분기 둘 · 영혼 소환)', () => {
    const timed = dotVariants().filter((row) => (row.skill.turn ?? 0) > 0);
    assert.deepEqual(timed.map((row) => row.id).sort(), [
        '무당/영혼 소환', '전사/출혈베기', '전사/출혈베기/심층 출혈', '전사/출혈베기/이중 상처',
    ]);
    for (const { id, job, name, choice, skill, dots } of timed) {
        assert.ok(skill.desc.includes(`${skill.turn}턴간`), `${id}: 설명의 지속 턴`);
        let enemy = castOn(job, name, makeEnemy(), choice);
        for (const dot of dots) assert.equal(enemy.dotTurns?.[dot], skill.turn, `${id}: ${dot} 남은 턴`);
        const ticksPerAction = [];
        for (let action = 0; action < skill.turn + 2; action += 1) {
            const act = enemyAct(enemy);
            ticksPerAction.push(act.hpLost);
            enemy = act.enemy;
        }
        const mult = skill.dotDamageMult ?? 1;
        const perAction = dots.length * Math.floor(MAX_HP * BALANCE.STATUS_DOT_RATIO * mult);
        assert.deepEqual(ticksPerAction, [...Array(skill.turn).fill(perAction), 0, 0], `${id}: 지속 피해 ${skill.turn}번`);
        for (const dot of dots) assert.equal((enemy.dots ?? []).includes(dot), false, `${id}: ${dot} 사라짐`);
        assert.equal(enemy.dotTurns, undefined, `${id}: 남은 턴 기록도 사라진다`);
        assert.equal(enemy.dotMults, undefined, `${id}: 배율 기록도 사라진다`);
    }
});

test('끝날 때 사라졌다는 줄을 남기고, 턴이 없는 지속 피해는 전투 내내다 (독바르기 · 화염구 등 — 이전과 같다)', () => {
    let enemy = castOn('전사', '출혈베기');
    const expiredLogs = [];
    for (let action = 0; action < 4; action += 1) {
        const act = enemyAct(enemy);
        expiredLogs.push(act.logs.some((log) => log.text === MSG.ENEMY_DOT_EXPIRED(MSG.DOT_LABELS.bleed, enemy.name)));
        enemy = act.enemy;
    }
    assert.deepEqual(expiredLogs, [false, false, true, false]);

    const untimed = dotVariants().filter((row) => !((row.skill.turn ?? 0) > 0));
    assert.ok(untimed.length >= 10, `턴 없는 지속 피해 기술 ${untimed.length}개`);
    for (const { id, job, name, choice, dots } of untimed) {
        let permanent = castOn(job, name, makeEnemy(), choice);
        assert.equal(permanent.dotTurns, undefined, `${id}: 남은 턴 없음`);
        for (let action = 0; action < 6; action += 1) permanent = enemyAct(permanent).enemy;
        for (const dot of dots) assert.ok((permanent.dots ?? []).includes(dot), `${id}: ${dot} 6번 뒤에도 남는다`);
    }
});

test('전투 내내 걸린 지속 피해를 짧은 기술이 줄이지 않고, 다시 걸면 턴이 처음부터다', () => {
    // 독바르기 B(이중 독)가 건 전투 내내 출혈 위에 출혈베기 — 출혈은 여전히 끝나지 않는다.
    const permanent = castOn('전사', '출혈베기', makeEnemy({ dots: ['bleed'] }));
    assert.equal(permanent.dotTurns?.bleed, undefined);
    let enemy = permanent;
    for (let action = 0; action < 6; action += 1) enemy = enemyAct(enemy).enemy;
    assert.ok(enemy.dots.includes('bleed'));

    // 1턴 남은 출혈에 다시 출혈베기 — 3턴으로 돌아간다.
    const refreshed = castOn('전사', '출혈베기', makeEnemy({ dots: ['bleed'], dotTurns: { bleed: 1 } }));
    assert.equal(refreshed.dotTurns.bleed, 3);

    // 시간 제한 출혈 위에 턴 없는 기술이 출혈을 걸면 전투 내내로 바뀐다(독바르기 B 이중 독).
    const promoted = castOn('도적', '독바르기', makeEnemy({ dots: ['bleed'], dotTurns: { bleed: 2 } }), 'B');
    assert.equal(promoted.dotTurns?.bleed, undefined);
});

test('지속 피해 "+50%" 기술은 그 지속 피해의 틱을 1.5배로 — 전수(심층 출혈 · 맹독 · 독 보강 · 역병의 안개)', () => {
    const amplified = dotVariants().filter((row) => (row.skill.dotDamageMult ?? 1) > 1);
    assert.deepEqual(amplified.map((row) => row.id).sort(), [
        '도적/독 보강', '도적/독바르기/맹독', '무당/역병의 안개', '전사/출혈베기/심층 출혈',
    ]);
    for (const { id, job, name, choice, skill, dots, desc } of amplified) {
        assert.equal(skill.dotDamageMult, 1.5, `${id}: 배율`);
        assert.ok((desc ?? skill.desc).includes('+50%'), `${id}: 설명의 +50%`);
        const enemy = castOn(job, name, makeEnemy(), choice);
        const act = enemyAct(enemy);
        assert.equal(act.hpLost, dots.length * Math.floor(MAX_HP * BALANCE.STATUS_DOT_RATIO * 1.5), `${id}: 틱 피해`);
    }
    // 같은 지속 피해를 강화 없는 기술이 다시 걸어도 강화는 남는다(독 보강 → 독바르기).
    const boosted = castOn('도적', '독 보강');
    const reapplied = castOn('도적', '독바르기', boosted);
    assert.equal(reapplied.dotMults.poison, 1.5);
    assert.equal(enemyAct(reapplied).hpLost, Math.floor(MAX_HP * BALANCE.STATUS_DOT_RATIO * 1.5));
    // 강화 없는 독은 기본 틱이다.
    assert.equal(enemyAct(castOn('도적', '독바르기')).hpLost, DOT_TICK);
    // 실데이터 배율은 모두 1.5라 "강한 쪽 유지"와 "나중 것 덮어쓰기"를 가르지 못한다 — 더 약한 배율로 읽기 경로를 고정한다.
    const weaker = CombatEngine.performSkill(
        makePlayer('도적'), boosted, STATS, { ...baseSkill('도적', '독 보강'), dotDamageMult: 1.2 }, CAST_RNG,
    ).updatedEnemy;
    assert.equal(weaker.dotMults.poison, 1.5, '약한 강화가 강한 강화를 되돌리지 않는다');
    const stronger = CombatEngine.performSkill(
        makePlayer('도적'), boosted, STATS, { ...baseSkill('도적', '독 보강'), dotDamageMult: 2 }, CAST_RNG,
    ).updatedEnemy;
    assert.equal(stronger.dotMults.poison, 2, '더 강한 강화는 올린다');
});

test('실명은 명중률이다 — 실명 중 적 공격이 BLIND_ENEMY_MISS_CHANCE(35%) 확률로 빗나가고, 맞으면 전량이다', () => {
    const smoke = baseSkill('도적', '연막탄');
    const chance = BALANCE.BLIND_ENEMY_MISS_CHANCE;
    assert.equal(chance, 0.35);
    assert.ok(smoke.desc.includes('명중률') && smoke.desc.includes(`${Math.round(chance * 100)}% 빗나감`), '설명');
    const blinded = castOn('도적', '연막탄', makeEnemy({ def: 0 }));
    assert.equal(blinded.blindTurns, smoke.turn);
    // rng가 경계 아래면 빗나감(피해 0, 로그) · 위면 공격력 그대로.
    const miss = enemyAct(blinded, () => chance - 0.01);
    assert.equal(miss.damage, 0);
    assert.ok(miss.logs.some((log) => log.text === MSG.ENEMY_BLIND_MISS(blinded.name)));
    const hit = enemyAct(blinded, () => chance + 0.01);
    assert.equal(hit.damage, 1000, '실명은 공격력을 줄이지 않는다');
    // 실명이 없으면 같은 rng에서도 빗나가지 않는다.
    assert.equal(enemyAct(makeEnemy({ def: 0 }), () => chance - 0.01).damage, 1000);
    // 기대 피해는 이전 공격력 배율(0.65)과 같다.
    assert.ok(Math.abs((1 - chance) - 0.65) < 1e-12);
});

test('전투 화면의 적 약화 칩은 지속 턴이 있는 지속 피해에 남은 턴을 붙인다 — 턴 없는 지속 피해는 이름만', () => {
    const render = (enemy) => renderStatic(createElement(CombatPanel, {
        player: makePlayerFixture(), actions: { getSelectedSkill: () => null },
        enemy: { name: '하수도 쥐', hp: 20, maxHp: 20, ...enemy },
        stats: { atk: 10, def: 5, maxHp: 100, maxMp: 50 }, isAiThinking: false, mobile: false,
    }));
    const timed = render({ dots: ['bleed', 'poison'], dotTurns: { bleed: 2 } });
    assert.ok(timed.includes(MSG.ENEMY_DOT_CHIP_TURNS(MSG.DOT_LABELS.bleed, 2)), '출혈 · 2턴');
    assert.ok(!timed.includes(MSG.ENEMY_DOT_CHIP_TURNS(MSG.DOT_LABELS.poison, 2)), '독은 턴 없음');
    assert.ok(timed.includes(MSG.DOT_LABELS.poison));
});
