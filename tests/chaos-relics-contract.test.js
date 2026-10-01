import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.js';
import { RELICS, getActiveRelicSynergies } from '../src/data/relics.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import {
    CHAOS_HEART_ELIGIBILITY,
    borrowChaosHeartRelic,
    getChaosHeartPool,
} from '../src/systems/chaosHeart.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { endCombatScopedRelics } from '../src/utils/combatScopedRelics.js';
import { formatSynergyDrawback } from '../src/utils/relicSynergyHint.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import SystemTab from '../src/components/tabs/SystemTab.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 57 — 혼돈의 심장 · 혼돈의 보석(소유자 결정 "이번에 설계 · 구현").
 *   혼돈의 심장 "전투마다 무작위 유물 효과 발동": 가지지 않은 유물 하나를 그 전투 동안 빌린다 — 조합(대가 포함)까지
 *   켜진다(소유자 답 "조합까지 켜지게"). 전투가 끝나는 모든 경로가 돌려준다.
 *   혼돈의 보석 "전투가 시작되면 공격력 또는 방어력 30% 증가": 그 전투 내내다(이전에는 강화 칸에 3턴).
 */

const relic = (name) => {
    const found = RELICS.find((r) => r.name === name);
    assert.ok(found, name);
    return { ...found };
};
const makePlayer = (relicNames = [], extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '시험자', job: '전사', loc: '고요한 숲', level: 30, hp: 1_000, maxHp: 1_000, mp: 200, maxMp: 200,
    atk: 100, def: 20, exp: 0, nextExp: 1_000_000,
    equip: { weapon: null, armor: null, offhand: null }, status: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {},
    relics: relicNames.map(relic), ...extra,
});
const makeEnemy = (extra = {}) => ({
    name: '시험 적', baseName: '시험 적', level: 30, hp: 10_000, maxHp: 10_000, atk: 50, def: 0, exp: 0, gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});
/** 혼돈의 심장 풀에서 `name`을 고르는 난수 — 빌릴 때 한 번만 쓰고 그 뒤는 `after`. */
const rngPicking = (owned, name, after = 0.99) => {
    const pool = getChaosHeartPool(owned);
    const index = pool.findIndex((r) => r.name === name);
    assert.ok(index >= 0, `${name} 풀에 있음`);
    let first = true;
    return () => {
        if (first) { first = false; return (index + 0.5) / pool.length; }
        return after;
    };
};
const start = (player, rng, logs = []) => applyBattleStartRelics(player, player.relics, calculateFullStats(player), {
    addLog: (_type, text) => logs.push(text), rng,
});
const borrowedOf = (player) => (player.relics || []).filter((r) => r.borrowed === true);

test('빌릴 수 있는 유물: 전투 안에서 작동하는 효과만 · 가진 유물과 효과가 같은 유물은 아니다', () => {
    // 데이터의 모든 효과가 분류돼 있다(타입이 강제하지만 런타임에도 확인).
    for (const r of RELICS) assert.ok(CHAOS_HEART_ELIGIBILITY[r.effect], r.name);
    const pool = getChaosHeartPool([relic('혼돈의 심장')]);
    assert.ok(pool.length >= 40);
    assert.ok(pool.every((r) => CHAOS_HEART_ELIGIBILITY[r.effect] === 'combat'));
    for (const excluded of ['혼돈의 심장', '피의 서약', '황금 자석', '경험 증폭기', '허공의 왕좌', '세계 포식자',
        '영혼 수집가', '별의 핵', '고대 지도', '허공의 눈', '허공의 심장', '심연의 공명', '심연의 지배']) {
        assert.ok(!pool.some((r) => r.name === excluded), excluded);
    }
    // 가진 유물 · 가진 유물과 같은 효과(주문 메아리 ↔ 시공의 반지)는 빌리지 않는다.
    const withEcho = getChaosHeartPool([relic('혼돈의 심장'), relic('주문 메아리')]);
    assert.ok(!withEcho.some((r) => r.name === '주문 메아리' || r.name === '시공의 반지'));
    // 혼돈의 심장이 없으면 빌리지 않고 난수도 쓰지 않는다.
    let draws = 0;
    assert.equal(borrowChaosHeartRelic([relic('주문 메아리')], () => { draws += 1; return 0.5; }).relic, null);
    assert.equal(draws, 0);
});

test('혼돈의 심장: 전투 시작 때 유물 하나를 빌린다 — 빌린 유물의 전투 시작 효과가 같이 걸리고 줄을 남긴다', () => {
    const base = makePlayer(['혼돈의 심장']);
    const logs = [];
    const started = start(base, rngPicking(base.relics, '그림자 망토'), logs);
    const borrowed = borrowedOf(started);
    assert.deepEqual(borrowed.map((r) => r.name), ['그림자 망토']);
    assert.equal(started.combatFlags.cloakEvadePending, true, '빌린 망토의 전투 시작 효과');
    assert.ok(logs.includes(MSG.CHAOS_HEART_BORROW('그림자 망토', relic('그림자 망토').desc)));
    // 이미 빌린 유물이 남은 채 다시 시작해도 빌린 유물은 하나다.
    const restarted = start(started, rngPicking(base.relics, '재생 코어'));
    assert.deepEqual(borrowedOf(restarted).map((r) => r.name), ['재생 코어']);
    assert.equal(restarted.relics.length, 2);
});

test('혼돈의 심장: 빌린 유물이 조합을 완성하면 조합과 대가가 이번 전투에 켜진다', () => {
    const base = makePlayer(['혼돈의 심장', '피의 서약']);
    const logs = [];
    const started = start(base, rngPicking(base.relics, '영혼 흡수'), logs);
    const synergy = getActiveRelicSynergies(started.relics).find((s) => s.label === '흡혈 군주');
    assert.ok(synergy, '흡혈 군주 조합이 켜진다');
    assert.ok(logs.includes(MSG.CHAOS_HEART_SYNERGY('흡혈 군주', formatSynergyDrawback(synergy))));
    assert.equal(calculateFullStats(started).damageTakenMult, 1 + synergy.drawback.pct, '대가(받는 피해 증가)도 켜진다');
    const ended = endCombatScopedRelics(started);
    assert.ok(!getActiveRelicSynergies(ended.relics).some((s) => s.label === '흡혈 군주'));
    assert.equal(calculateFullStats(ended).damageTakenMult, 1);
});

test('혼돈의 심장: 빌린 유물이 빌드 성향을 바꿔 실효 최대치를 낮추면 현재치를 내린다', () => {
    // 무당 + 마나 수정이 허공의 파편을 빌리면 빌드 성향이 바뀌어 실효 최대 기력이 10 낮아진다.
    const base = makePlayer(['혼돈의 심장', '마나 수정'], { job: '무당', level: 12, hp: 300, maxHp: 300, mp: 150, maxMp: 150 });
    const fullMp = calculateFullStats(base).maxMp;
    const full = { ...base, mp: fullMp };
    const started = start(full, rngPicking(full.relics, '허공의 파편'));
    const loweredMax = calculateFullStats(started).maxMp;
    assert.ok(loweredMax < fullMp, `빌린 유물이 최대 기력을 낮춘다 (${fullMp} → ${loweredMax})`);
    assert.equal(started.mp, loweredMax, '현재 기력을 실효 최대로 내린다');
    // 빌린 유물이 최대치를 올리기만 하면 현재치는 그대로다(올리지 않는다).
    const raised = start(full, rngPicking(full.relics, '난공불락'));
    assert.equal(raised.hp, full.hp);
});

test('승리: 정산 전에 돌려준다 — 빌린 유물이 켠 조합의 원정 누적(절멸자)이 남지 않는다', () => {
    const base = makePlayer(['혼돈의 심장', '허공의 왕좌']);
    const started = start(base, rngPicking(base.relics, '처형자의 날'));
    assert.ok(getActiveRelicSynergies(started.relics).some((s) => s.label === '절멸자'));
    const stats = calculateFullStats(started);
    const won = CombatEngine.handleVictory(started, makeEnemy(), { activeSynergies: stats.activeSynergies }, {}).updatedPlayer;
    assert.deepEqual(borrowedOf(won), []);
    assert.deepEqual(won.relics.map((r) => r.name), ['혼돈의 심장', '허공의 왕좌']);
    // 허공의 왕좌 혼자의 처치당 5%만 쌓인다(절멸자 +7%가 아니다).
    assert.equal(won.adventureRelicBonuses?.killStackAtk, relic('허공의 왕좌').val.perKill);
});

test('도주 · 패배: 돌려주고, 런 요약의 유물 수에 빌린 유물을 세지 않는다', () => {
    const base = makePlayer(['혼돈의 심장']);
    const started = start(base, rngPicking(base.relics, '암석 피부'));
    assert.equal(borrowedOf(started).length, 1);

    const escaped = resolveCombatActionTurn({
        player: started, enemy: makeEnemy(), kind: 'escape', initialPlayer: base, seed: 1, now: 1, rng: () => 0.99,
    });
    assert.equal(escaped.kind, 'escape');
    assert.deepEqual(borrowedOf(escaped.player), []);

    const dying = { ...started, hp: 1 };
    const defeated = resolveCombatActionTurn({
        player: dying, enemy: makeEnemy({ atk: 1_000_000 }), kind: 'attack', initialPlayer: base, seed: 1, now: 1,
        rng: () => 0.5,
    });
    assert.equal(defeated.kind, 'defeat');
    assert.equal(defeated.runSummary.relicsFound, 1);
});

test('빌린 유물이 올린 최대 생명은 돌려준 뒤 현재 생명을 실효 최대로 내린다', () => {
    const base = makePlayer(['혼돈의 심장']);
    const started = start(base, rngPicking(base.relics, '난공불락'));
    const boostedMax = calculateFullStats(started).maxHp;
    const plainMax = calculateFullStats(base).maxHp;
    assert.ok(boostedMax > plainMax);
    const ended = endCombatScopedRelics({ ...started, hp: boostedMax });
    assert.equal(ended.hp, plainMax);
    // 아무것도 없으면 같은 참조.
    assert.equal(endCombatScopedRelics(base), base);
});

test('세이브 복원: 전투로 복원하면 빌린 유물 · 보석 표시가 남고, 그 밖의 모드는 끝난다', () => {
    const base = makePlayer(['혼돈의 심장', '혼돈의 보석']);
    const started = start(base, rngPicking(base.relics, '암석 피부', 0.2));
    assert.equal(borrowedOf(started).length, 1);
    assert.equal(started.combatFlags.chaosGemStat, 'atk');
    const restore = (gameState, enemy) => gameReducer(INITIAL_STATE, {
        type: 'LOAD_DATA', payload: migrateData({ version: 5, player: started, gameState, enemy }),
    }).player;
    const inCombat = restore('combat', makeEnemy());
    assert.equal(borrowedOf(inCombat).length, 1);
    assert.equal(inCombat.combatFlags.chaosGemStat, 'atk');
    for (const [mode, enemy] of [['idle', null], ['combat', null], ['dead', null], ['event', null]]) {
        const restored = restore(mode, enemy);
        assert.deepEqual(borrowedOf(restored), [], mode);
        assert.equal(restored.combatFlags?.chaosGemStat, undefined, mode);
    }
});

test('혼돈의 보석: 고른 능력치가 전투 내내 30% 오른다 — 턴이 지나도 · 기술 강화가 걸려도 남고, 전투가 끝나면 사라진다', () => {
    const base = makePlayer(['혼돈의 보석']);
    const gem = relic('혼돈의 보석');
    const logs = [];
    let draws = 0;
    const started = start(base, () => { draws += 1; return 0.2; }, logs);
    assert.equal(draws, 1, '난수는 한 번');
    assert.equal(started.combatFlags.chaosGemStat, 'atk');
    assert.ok(logs.includes(MSG.CHAOS_GEM_PROC('atk', 30)));
    const baseAtk = calculateFullStats(base).atk;
    const boostedAtk = calculateFullStats(started).atk;
    assert.ok(boostedAtk > baseAtk);
    // 강화 칸(tempBuff)을 쓰지 않는다 — 5턴이 지나도 같다.
    assert.equal(started.tempBuff?.name === '혼돈의 보석', false);
    let ticked = started;
    for (let i = 0; i < 5; i += 1) ticked = CombatEngine.tickCombatState(ticked, ticked.relics).updatedPlayer;
    assert.equal(calculateFullStats(ticked).atk, boostedAtk);
    // 기술 강화(공격력 +50%)가 걸리면 둘이 함께 오른다(덮어쓰지 않는다).
    const buffed = { ...ticked, tempBuff: { atk: 0.5, def: 0, turn: 3, name: '광폭화' } };
    assert.ok(calculateFullStats(buffed).atk > calculateFullStats({ ...buffed, combatFlags: {} }).atk);
    // 방어력 쪽.
    const defStart = start(base, () => 0.7);
    assert.equal(defStart.combatFlags.chaosGemStat, 'def');
    assert.ok(calculateFullStats(defStart).def > calculateFullStats(base).def);
    assert.equal(calculateFullStats(defStart).atk, baseAtk);
    // 승리 뒤 사라진다.
    const won = CombatEngine.handleVictory(started, makeEnemy(), {}, {}).updatedPlayer;
    assert.equal(won.combatFlags?.chaosGemStat, undefined);
    assert.equal(calculateFullStats(won).atk, baseAtk);
    // 보석을 빌렸다가 돌려준 뒤 표시가 남아도 효과는 없다.
    assert.equal(calculateFullStats({ ...base, relics: [], combatFlags: { chaosGemStat: 'atk' } }).atk,
        calculateFullStats({ ...base, relics: [] }).atk);
    assert.equal(gem.val, 0.3);
});

test('유물 목록: 빌린 유물은 보유 수에 세지 않고 "이번 전투" 표시를 단다', () => {
    const borrowed = { ...relic('암석 피부'), borrowed: true };
    const html = renderStatic(createElement(SystemTab, {
        player: makePlayerFixture({ relics: [relic('혼돈의 심장'), borrowed] }),
        stats: { maxHp: 150, maxMp: 50 },
        actions: { leaderboard: [], isAdmin: () => false },
        runtime: { viewport: 'mobile', gameState: 'combat', syncStatus: 'synced', isAiThinking: false },
    }));
    assert.ok(html.includes('보유 유물 1/5'), '보유 수는 빌린 유물을 빼고 센다');
    assert.ok(!html.includes('보유 유물 2/5'));
    const tagged = html.match(/data-testid="system-relic-borrowed"/g) || [];
    assert.equal(tagged.length, 1);
    assert.ok(html.includes(MSG.CHAOS_HEART_BORROWED_TAG));
});
