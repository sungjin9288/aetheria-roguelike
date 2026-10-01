import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { RELICS, getActiveRelicSynergies } from '../src/data/relics.js';
import { MAPS } from '../src/data/maps.js';
import { AT } from '../src/reducers/actionTypes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import { buildPassiveBonusWithScout } from '../src/hooks/combatActions/_helpers.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';

/**
 * 2026-10 Wave 56 — 유물 · 조합 설명 감사(원장 §56). 소유자 결정:
 *   (1) 설명대로 하면 약해지는 것 — 영혼 수집가만 설명대로, 나머지는 문구를 동작에 맞춘다.
 *   (2) 설명대로 하면 강해지는 것 — 전부 설명대로 구현하고 측정한다.
 * 이 파일은 설명이 약속한 효과를 실제 엔진 호출로 확인한다(난수는 주입).
 */

const relic = (name) => {
    const found = RELICS.find((r) => r.name === name);
    assert.ok(found, name);
    return { ...found };
};
const makePlayer = (relicNames = [], extra = {}) => ({
    name: '시험자', job: '모험가', level: 30, hp: 1_000, maxHp: 1_000, mp: 200, maxMp: 200, atk: 100, def: 20,
    inv: [], equip: {}, status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {},
    relics: relicNames.map(relic), ...extra,
});
const statsOf = (player) => calculateFullStats(player);
const makeEnemy = (extra = {}) => ({
    name: '시험 적', baseName: '시험 적', hp: 10_000, maxHp: 10_000, atk: 300, def: 0, level: 30,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});
const enemyAct = (player, enemy, rng = () => 0.5) => CombatEngine.enemyAttack(player, enemy, statsOf(player), rng);
const skill = (extra = {}) => ({ name: '시험 일격', mp: 0, mult: 2, cooldown: 1, ...extra });
const castSkill = (player, enemy, sk = skill(), rng = () => 0.5) => CombatEngine.performSkill(player, enemy, statsOf(player), sk, rng);

test('그림자 망토: 전투에서 처음 받는 실제 적 공격을 반드시 피한다 — 방어 자세 턴은 쓰지 않고, 두 번째 공격은 맞는다', () => {
    const base = makePlayer(['그림자 망토']);
    const started = applyBattleStartRelics(base, base.relics, statsOf(base), { addLog: () => {}, rng: () => 0.5 });
    assert.equal(started.combatFlags.cloakEvadePending, true);
    // 첫 행동이 방어 자세면 망토는 남는다.
    const guarded = enemyAct(started, makeEnemy({ pattern: { guardChance: 1, heavyChance: 0 } }));
    assert.equal(guarded.updatedPlayer.combatFlags.cloakEvadePending, true);
    const first = enemyAct(guarded.updatedPlayer, makeEnemy());
    assert.equal(first.damage, 0);
    assert.ok(first.logs.some((log) => log.text === MSG.CLOAK_EVADE_PROC('시험 적')));
    const second = enemyAct(first.updatedPlayer, makeEnemy());
    assert.ok(second.damage > 0, '두 번째 공격은 맞는다');
    // 망토가 없으면 첫 공격도 맞는다.
    const plain = makePlayer();
    const plainStart = applyBattleStartRelics(plain, [], statsOf(plain), { addLog: () => {}, rng: () => 0.5 });
    assert.ok(enemyAct(plainStart, makeEnemy()).damage > 0);
});

test('운명의 거울: 받은 피해의 30%를 적에게 돌려준다 — 절대 반사(거울 + 가시 갑옷)는 50%', () => {
    const mirror = makePlayer(['운명의 거울']);
    const hit = enemyAct(mirror, makeEnemy());
    assert.ok(hit.damage > 0);
    assert.equal(10_000 - hit.updatedEnemy.hp, Math.floor(hit.damage * 0.3));
    assert.ok(hit.logs.some((log) => log.text === MSG.MIRROR_REFLECT_PROC(Math.floor(hit.damage * 0.3))));

    const both = makePlayer(['운명의 거울', '가시 갑옷']);
    assert.ok(getActiveRelicSynergies(both.relics).some((s) => s.label === '절대 반사'));
    const bothHit = enemyAct(both, makeEnemy(), () => 0.99); // 0.99 — 반사 기절은 굴리지 않는다
    const thorns = Math.floor(statsOf(both).def * 0.5);
    assert.equal(10_000 - bothHit.updatedEnemy.hp, thorns + Math.floor(bothHit.damage * 0.5));
});

test('처형자의 날 · 예언의 돌판 · 허공의 심장: 위력 있는 기술에도 적용한다', () => {
    const plain = makePlayer();
    const low = makeEnemy({ hp: 2_000, isBoss: true });
    const base = 2_000 - castSkill(plain, low).updatedEnemy.hp;
    const exec = makePlayer(['처형자의 날']);
    assert.equal(2_000 - castSkill(exec, low).updatedEnemy.hp, Math.floor(base * 1.5), '처형 +50%');
    const prophecy = makePlayer(['예언의 돌판']);
    assert.equal(2_000 - castSkill(prophecy, low).updatedEnemy.hp, Math.floor(base * 2), '보스 25% 미만 ×2');
    assert.equal(2_000 - castSkill(prophecy, { ...low, isBoss: false }).updatedEnemy.hp, base, '보스가 아니면 그대로');
    const heart = makePlayer(['허공의 심장'], { combatFlags: { voidHeartArmed: true } });
    const armed = castSkill(heart, makeEnemy());
    assert.equal(10_000 - armed.updatedEnemy.hp, Math.floor((10_000 - castSkill(plain, makeEnemy()).updatedEnemy.hp) * 3));
    assert.equal(armed.updatedPlayer.combatFlags.voidHeartArmed, false, '한 번 쓰면 사라진다');
    // 보조 기술(위력 없음)에는 붙지 않는다.
    const support = castSkill(heart, makeEnemy(), skill({ mult: 0, type: 'buff', effect: 'atk_up', val: 1.3, turn: 2 }));
    assert.equal(support.updatedPlayer.combatFlags.voidHeartArmed, true);
});

test('동결의 닻: 위력 있는 기술이 적중해도 15% 빙결을 굴린다', () => {
    const anchor = makePlayer(['동결의 닻']);
    const frozen = castSkill(anchor, makeEnemy(), skill(), () => 0.1);
    assert.ok((frozen.updatedEnemy.stunnedTurns ?? 0) >= 1);
    assert.ok(frozen.logs.some((log) => log.text === MSG.RELIC_FREEZE_ON_HIT('시험 적')));
    const missed = castSkill(anchor, makeEnemy(), skill(), () => 0.5);
    assert.equal(missed.updatedEnemy.stunnedTurns ?? 0, 0);
});

test('흡혈 군주 · 혈맹 불사: 기술 피해도 흡혈하고, 둘 다 켜지면 큰 비율(100%)을 쓴다', () => {
    const lord = makePlayer(['피의 서약', '영혼 흡수'], { hp: 100 });
    const cast = castSkill(lord, makeEnemy());
    const dealt = 10_000 - cast.updatedEnemy.hp;
    // 영혼 흡수 10% + 흡혈 군주 50%.
    assert.equal(cast.updatedPlayer.hp, 100 + Math.floor(dealt * 0.1) + Math.floor(dealt * 0.5));
    const immortal = makePlayer(['피의 서약', '영혼 흡수', '허공의 심장'], { hp: 100 });
    const swing = CombatEngine.attack(immortal, makeEnemy(), statsOf(immortal), () => 0.5);
    const swingDealt = 10_000 - swing.updatedEnemy.hp;
    assert.equal(swing.updatedPlayer.hp, Math.min(statsOf(immortal).maxHp, 100 + swingDealt), '일반 공격 100% 흡혈');
});

test('지속 피해 유물은 틱에도 붙는다 — 죽음의 낙인 독 · 화상 ×3(출혈 제외), 저주의 결정 전부 ×1.5(저주 포함)', () => {
    const tick = (names, enemyExtra) => {
        const player = makePlayer(names);
        const enemy = makeEnemy({ hp: 100_000, maxHp: 100_000, atk: 0, ...enemyExtra });
        return 100_000 - CombatEngine.enemyAttack(player, enemy, statsOf(player), () => 0.5).updatedEnemy.hp;
    };
    const base = Math.floor(100_000 * BALANCE.STATUS_DOT_RATIO);
    assert.equal(tick(['죽음의 낙인'], { dots: ['poison'] }), Math.floor(base * 3));
    assert.equal(tick(['죽음의 낙인'], { dots: ['burn'] }), Math.floor(base * 3));
    assert.equal(tick(['죽음의 낙인'], { dots: ['bleed'] }), base, '출혈은 대상 밖');
    assert.equal(tick(['저주의 결정'], { dots: ['bleed'] }), Math.floor(base * 1.5));
    const curseBase = Math.floor(100_000 * BALANCE.CURSE_DOT_RATIO);
    assert.equal(tick(['저주의 결정'], { cursed: true, cursedTurns: 3 }), Math.floor(curseBase * 1.5));
    // 둘 다: 독은 강한 쪽(3) × 죽음의 예언자(1.5), 저주 틱도 예언자가 키운다.
    assert.equal(tick(['죽음의 낙인', '저주의 결정'], { dots: ['poison'] }), Math.floor(base * 1.5 * 3));
    assert.equal(tick(['죽음의 낙인', '저주의 결정'], { cursed: true, cursedTurns: 3 }), Math.floor(curseBase * 1.5 * 1.5));
});

test('조합 최댓값 — 시간의 지배자(강화) 30% · 원초의 분노 치명 2.5배 · 엔트로피의 신 매 행동 15%', () => {
    const time = makePlayer(['시간 군주의 왕관', '시간의 파편', '시공의 반지']);
    const extra = castSkill(time, makeEnemy(), skill(), () => 0.2);
    assert.equal(extra.updatedPlayer.extraTurnGranted, true, '0.2 < 30%');

    const wrath = makePlayer(['고대의 분노', '드래곤 발톱', '광전사의 분노', '허공의 왕좌']);
    const labels = getActiveRelicSynergies(wrath.relics).map((s) => s.label);
    assert.ok(labels.includes('원초의 분노') && labels.includes('공허의 용'));
    const critSeq = [0.5, 0];
    let i = 0;
    const crit = CombatEngine.attack(wrath, makeEnemy(), { ...statsOf(wrath), critChance: 1 }, () => critSeq[(i++) % 2]);
    let j = 0;
    const plainSeq = [0.5, 0.99];
    const normal = CombatEngine.attack(wrath, makeEnemy(), { ...statsOf(wrath), critChance: 0 }, () => plainSeq[(j++) % 2]);
    const critDealt = 10_000 - crit.updatedEnemy.hp;
    const normalDealt = 10_000 - normal.updatedEnemy.hp;
    assert.ok(crit.isCrit);
    assert.ok(critDealt > normalDealt);
    // 선택 규칙: 두 조합이 함께 켜져도 원초의 분노만 켜졌을 때와 같은 치명 피해다(공허의 용 2.0에 가려지지 않는다).
    const synergies = getActiveRelicSynergies(wrath.relics);
    const primordialOnly = synergies.filter((s) => s.label !== '공허의 용');
    const critWith = (activeSynergies) => {
        let n = 0;
        return 10_000 - CombatEngine.attack(wrath, makeEnemy(), { ...statsOf(wrath), critChance: 1, activeSynergies }, () => critSeq[(n++) % 2]).updatedEnemy.hp;
    };
    assert.equal(critWith(synergies), critWith(primordialOnly), '큰 배율(2.5)을 쓴다');
    assert.ok(critWith(synergies) > critWith(synergies.filter((s) => s.label !== '원초의 분노')), '2.5 > 2.0');

    const god = makePlayer(['엔트로피 엔진', '죽음의 낙인', '혼돈의 보석']);
    let p = god;
    let enemy = makeEnemy({ hp: 100_000, maxHp: 100_000 });
    const ticks = [];
    for (let k = 0; k < 3; k += 1) {
        const r = CombatEngine.attack(p, enemy, statsOf(p), () => 0.5);
        ticks.push(r.logs.some((log) => log.text === MSG.ENTROPY_TICK_PROC(MSG.ENTROPY_LABEL_GOD, '시험 적', 15_000)));
        p = r.updatedPlayer;
        enemy = r.updatedEnemy;
    }
    assert.deepEqual(ticks, [true, true, true]);
});

test('절멸자 · 공허의 용: 실제 승리 경로(buildPassiveBonusWithScout → handleVictory)에서 처치 공격력이 쌓인다', () => {
    const player = makePlayer(['허공의 왕좌', '처형자의 날', '드래곤 발톱']);
    const stats = statsOf(player);
    const bonus = buildPassiveBonusWithScout(stats, { ...makeEnemy({ exp: 10, gold: 10 }) });
    const result = CombatEngine.handleVictory(player, makeEnemy({ exp: 10, gold: 10 }), bonus, {});
    // 허공의 왕좌 5% + 절멸자 7% + 공허의 용 8% = 20%.
    assert.ok(Math.abs(result.updatedPlayer.adventureRelicBonuses.killStackAtk - 0.2) < 1e-9);
});

test('지옥의 수확자: 심연의 계약 생명 소모가 5% → 3%', () => {
    const player = makePlayer(['심연의 계약', '영혼 흡수'], { hp: 1_000, maxHp: 1_000 });
    const tick = CombatEngine.tickCombatState(player);
    assert.equal(tick.updatedPlayer.hp, 1_000 - 30);
});

test('비전 파동 기력 무소모 확률 ×2 · 비전 특이점 최소 35% · 기술 피해 ×1.3', () => {
    const surge = makePlayer(['마나 수정', '주문 메아리']);
    const echo = RELICS.find((r) => r.name === '주문 메아리');
    assert.equal(echo.effect, 'free_skill');
    const probe = echo.val * 2 - 0.01; // 혼자면 실패, 두 배면 성공하는 경계
    const surgeCast = castSkill(surge, makeEnemy(), skill({ mp: 20 }), () => probe);
    assert.equal(surgeCast.updatedPlayer.mp, 200, `무소모 (${probe} < ${echo.val} × 2)`);
    const single = makePlayer(['주문 메아리']);
    assert.equal(castSkill(single, makeEnemy(), skill({ mp: 20 }), () => probe).updatedPlayer.mp, 180);

    const sing = makePlayer(['마나 수정', '주문 메아리', '정신 연소']);
    assert.equal(castSkill(sing, makeEnemy(), skill({ mp: 20 }), () => 0.34).updatedPlayer.mp, 200, '0.34 < 35%');
    // 최소 35%이지 더하기가 아니다 — 0.4는 (주문 메아리 × 2 = 16%)와 35% 중 큰 값보다 크다.
    assert.equal(castSkill(sing, makeEnemy(), skill({ mp: 20 }), () => 0.4).updatedPlayer.mp, 180, '0.4 ≥ 35%');
    const singNoSyn = { ...statsOf(sing), activeSynergies: getActiveRelicSynergies(sing.relics).filter((s) => s.label !== '비전 특이점') };
    const withSyn = CombatEngine.performSkill(sing, makeEnemy(), statsOf(sing), skill(), () => 0.99);
    const withoutSyn = CombatEngine.performSkill(sing, makeEnemy(), singNoSyn, skill(), () => 0.99);
    const ratio = (10_000 - withSyn.updatedEnemy.hp) / (10_000 - withoutSyn.updatedEnemy.hp);
    assert.ok(Math.abs(ratio - 1.3) < 0.01, `기술 피해 배율 ${ratio}`);
});

test('부활 조합은 어느 부활 수단에도 — 불멸의 전사(불사조) 50%, 난공불락 조합은 사망 방지에 30%를 더한다', () => {
    const phoenixOnly = makePlayer(['불사조의 깃털'], { hp: 10 });
    const phoenix = CombatEngine.applyFatalProtection(phoenixOnly, phoenixOnly.relics, 9_999, [], getActiveRelicSynergies(phoenixOnly.relics));
    // 2026-10 Wave 58: 부활 회복의 "최대 생명"은 실효 최대다(패시브 · 장비 보너스 포함).
    const maxOf = (p) => statsOf(p).maxHp;
    assert.equal(phoenix.updatedPlayer.hp, Math.floor(maxOf(phoenixOnly) * 0.3), '불사조 단독 30%');
    const warrior = makePlayer(['불사조의 깃털', '피의 서약'], { hp: 10 });
    const revived = CombatEngine.applyFatalProtection(warrior, warrior.relics, 9_999, [], getActiveRelicSynergies(warrior.relics));
    assert.equal(revived.updatedPlayer.hp, Math.floor(maxOf(warrior) * 0.5), '불멸의 전사 50%');
    const fortress = makePlayer(['강철 의지', '난공불락', '불사조의 깃털'], { hp: 10 });
    const saved = CombatEngine.applyFatalProtection(fortress, fortress.relics, 9_999, [], getActiveRelicSynergies(fortress.relics));
    assert.equal(saved.updatedPlayer.hp, Math.floor(maxOf(fortress) * 0.3) + Math.floor(maxOf(fortress) * 0.3), '불사조 30% + 난공불락 30%');
    // 부활하지 않은 피격에는 붙지 않는다.
    const alive = CombatEngine.applyFatalProtection(fortress, fortress.relics, 5, [], getActiveRelicSynergies(fortress.relics));
    assert.equal(alive.updatedPlayer.hp, 5);
});

test('룬 왕관 최대 기력 +40%(배율) · 전투 중 기력 상한 · 별의 핵은 실효 최대 기력까지', () => {
    const crown = makePlayer(['룬 왕관'], { mp: 250 });
    assert.equal(statsOf(crown).maxMp, 280, '200 × 1.4');
    assert.equal(CombatEngine.getEffectiveMaxMp(crown, crown.relics), 280);
    const star = makePlayer(['별의 핵', '룬 왕관'], { mp: 10 });
    const result = CombatEngine.handleVictory(star, makeEnemy({ exp: 1, gold: 1 }), buildPassiveBonusWithScout(statsOf(star), makeEnemy()), {});
    assert.equal(result.updatedPlayer.mp, 280);
});

test('영혼 수집가: 얻은 뒤의 처치만 센다 — 계정 평생 처치 수는 읽지 않는다', () => {
    const veteran = makePlayer(['영혼 수집가'], { stats: { kills: 5_000 } });
    const fresh = makePlayer([], { stats: { kills: 5_000 } });
    assert.equal(statsOf(veteran).atk, statsOf(fresh).atk, '줍자마자 공격력이 오르지 않는다');
    let player = veteran;
    for (let k = 0; k < 50; k += 1) {
        player = CombatEngine.handleVictory(player, makeEnemy({ exp: 0, gold: 0 }), {}, {}).updatedPlayer;
    }
    assert.equal(player.relics[0].kills, 50);
    assert.ok(statsOf(player).atk > statsOf(fresh).atk, '50마리 뒤 한 단계');
});

test('허공의 눈: 해금되지 않은 숨은 보스를 부르지 않고, 풀에 있는 보스의 가중치만 세 배로', () => {
    const temple = { ...MAPS['공중 신전'] };
    const seeker = makePlayer(['허공의 눈'], { loc: '공중 신전', job: '전사', level: 40 });
    let hidden = 0;
    for (let k = 0; k < 400; k += 1) {
        const r = (k + 0.5) / 400;
        const { baseName } = spawnEnemy(temple, seeker, seeker.relics, { addLog: () => {} }, { rng: () => r });
        if (baseName === '시간의 파수꾼') hidden += 1;
    }
    assert.equal(hidden, 0, '시간술사가 아니면 시간의 파수꾼은 나오지 않는다');
    const nest = MAPS['용의 둥지'];
    const bosses = nest.bossMonsters;
    const count = (relics) => {
        let n = 0;
        for (let k = 0; k < 400; k += 1) {
            const r = (k + 0.5) / 400;
            const p = makePlayer(relics, { loc: '용의 둥지' });
            const { baseName } = spawnEnemy(nest, p, p.relics, { addLog: () => {} }, { rng: () => r });
            if (bosses.includes(baseName)) n += 1;
        }
        return n;
    };
    assert.ok(count(['허공의 눈']) > count([]), '보스 비중이 오른다');
});

test('고대의 봉인: 사건 결과의 상태 이상도 40% 확률로 막는다', () => {
    const run = (relics, rngValue) => {
        const dispatches = [];
        const logs = [];
        const player = makePlayer(relics, { loc: '고요한 숲', quests: [], history: [], gold: 100 });
        createEventActions({
            player,
            currentEvent: { desc: '시험', choices: ['조사한다'], outcomes: [{ choiceIndex: 0, log: '결과', status: { id: 'poison', turns: 2 } }] },
            dispatch: (action) => dispatches.push(action),
            addLog: (type, text) => logs.push({ type, text }),
            addStoryLog: () => {},
            getFullStats: () => ({ maxHp: 1_000, maxMp: 200, atk: 30, def: 10 }),
            rng: () => rngValue,
        }, { emitUnlockedTitles: () => {}, commitExploreOutcome: () => {} }).handleEventChoice(0);
        const resolved = dispatches.filter((d) => d.type === AT.SET_PLAYER)
            .reduce((acc, action) => (typeof action.payload === 'function' ? action.payload(acc) : action.payload), player);
        return { resolved, logs };
    };
    const blocked = run(['고대의 봉인'], 0.1);
    assert.deepEqual(blocked.resolved.status, []);
    assert.ok(blocked.logs.some((log) => log.text === MSG.ANCIENT_SEAL_RESIST));
    assert.deepEqual(run(['고대의 봉인'], 0.9).resolved.status, ['poison']);
    assert.deepEqual(run([], 0.1).resolved.status, ['poison']);
});

test('회복은 생명을 줄이지 않는다 — 처치 회복 상한은 실효 최대 생명, 레벨업은 현재치를 같은 양 올린다', () => {
    const tank = makePlayer(['피의 서약', '난공불락'], { hp: 1_100, maxHp: 1_000 });
    const effective = statsOf(tank).maxHp;
    assert.ok(effective > 1_100, `실효 최대 ${effective}`);
    const after = CombatEngine.handleVictory(tank, makeEnemy({ exp: 0, gold: 0 }), buildPassiveBonusWithScout(statsOf(tank), makeEnemy()), {});
    assert.ok(after.updatedPlayer.hp > 1_100 && after.updatedPlayer.hp <= effective, `처치 회복 ${after.updatedPlayer.hp}`);
    const leveled = CombatEngine.applyExpGain({ ...tank, exp: 0, nextExp: 1, level: 5 }, 1);
    assert.equal(leveled.updatedPlayer.hp - 1_100, leveled.updatedPlayer.maxHp - 1_000, '현재치가 최대치와 같은 양 오른다(실효 최대 위에서도)');
});

test('회복 상한은 전투 한정 보너스를 걷어 낸 뒤의 실효 최대 생명이다 — 세계 포식자 + 처치 회복이 생명을 실효 최대 위로 올리지 않는다', () => {
    // 자연 플레이 드라이버가 잡은 회귀(`hpAboveFullMaxHp`): 승리 처리가 세계 포식자의 전투 한정 생명을 걷어 낸 뒤에도
    //   처치 회복의 상한으로 전투 중 능력치를 쓰면 생명이 실효 최대를 넘었다.
    const base = makePlayer(['세계 포식자', '피의 서약'], { hp: 900, maxHp: 1_000 });
    const active = { ...base, maxHp: 1_300, hp: 1_200, adventureRelicBonuses: { devour: { phase: 'active', amount: 300 } } };
    const combatStats = statsOf(active);
    const after = CombatEngine.handleVictory(active, makeEnemy({ exp: 0, gold: 0 }), buildPassiveBonusWithScout(combatStats, makeEnemy()), {});
    const effective = statsOf(after.updatedPlayer).maxHp;
    assert.ok(after.updatedPlayer.hp <= effective, `생명 ${after.updatedPlayer.hp} ≤ 실효 최대 ${effective}`);
    // 레벨업도 실효 최대를 넘기지 않는다.
    const leveled = CombatEngine.applyExpGain({ ...base, hp: statsOf(base).maxHp, exp: 0, nextExp: 1, level: 5 }, 1).updatedPlayer;
    assert.ok(leveled.hp <= statsOf(leveled).maxHp);
});

test('문구는 동작과 같다 — 하향 방향 4건은 문구를 동작에 맞췄다', () => {
    const desc = (name) => relic(name).desc;
    assert.match(desc('쌍검 각인'), /160%/);
    assert.match(desc('시간의 파편'), /두 배 빨리/);
    for (const name of ['심연의 공명', '공허의 결정', '심연의 지배']) assert.match(desc(name), /어디서나/);
    const reaper = getActiveRelicSynergies([relic('심연의 계약'), relic('영혼 흡수')]).find((s) => s.label === '지옥의 수확자');
    assert.match(reaper.desc, /일반 공격/);
    assert.match(desc('영혼 수집가'), /얻은 뒤/);
    assert.equal(relic('룬 왕관').mpVal, 0.4);
});
