import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { HUNT_CONTRACTS, getHuntContract } from '../src/data/huntContracts.js';
import { MSG } from '../src/data/messages.js';
import { RELICS } from '../src/data/relics.js';
import { runQuietRollAndCombat } from '../src/hooks/gameActions/exploreFlow.ts';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getEssenceGainFromExp } from '../src/systems/essenceLedger.js';
import { getEssenceRewardMult } from '../src/systems/essenceRewardMult.js';
import { matchesQuestTarget } from '../src/utils/enemyIdentity.js';
import { canEquip } from '../src/utils/equipmentValidation.js';
import {
    HUNT_STAGE_CHAMPION, HUNT_STAGE_DONE, HUNT_STAGE_ELITES, HUNT_STAGE_KILLS,
    advanceHuntContractOnVictory, applyHuntChampion, getHuntChampionAtkMult, getHuntChampionEssence, getHuntContractRows, getHuntEliteGoal,
    getHuntEliteMaterials, getHuntKillGoal, getHuntRoundMult, getHuntStageGold, getHuntTraceGoal, pickHuntChampionGear,
} from '../src/utils/huntContracts.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import HuntContractCard from '../src/components/tabs/HuntContractCard.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 80 (소유자 결정 "C" → "회차마다 다시 하는 지역 토벌 의뢰") — Lv41 ~ 45 구간의 세 지역(천공 정원 · 어둠의 지하 감옥 ·
 * 지하 미궁)에 3단계 의뢰: 처치 → 정예 처치 → 그 지역의 우두머리. 진행은 런 범위이고 판정은 난수를 쓰지 않는다.
 *
 * 하네스는 실제 탐험 흐름(`runQuietRollAndCombat`)과 실제 리듀서 전투 전이(`RESOLVE_COMBAT_ACTION` → 승리 정산)다.
 */

const NOW = 1_700_000_000_000;
const SKY = '천공 정원';
const HARMLESS_RELIC = RELICS.find((relic) => relic.effect === 'gold_mult');

const basePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '용사', job: '전사', level: 44, hp: 5_000, maxHp: 5_000, mp: 200, maxMp: 200, atk: 400, loc: SKY,
    relics: [structuredClone(HARMLESS_RELIC)],
    stats: { ...structuredClone(INITIAL_STATE.player.stats), exploreState: { sinceRelic: 0, quietStreak: 0 }, explores: 12 },
    ...overrides,
});

const withContract = (player, map, stage, progress = 0, round = 1) => ({ ...player, huntContracts: { ...(player.huntContracts || {}), [map]: { stage, progress, round } } });

/** 호출 수를 세는 난수(상수). */
const counting = (value) => {
    const rng = () => { rng.calls += 1; return value; };
    rng.calls = 0;
    return rng;
};

const noRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random 호출 금지'); };
    try { return fn(); } finally { Math.random = original; }
};

/** 실제 탐험 흐름으로 적을 띄운 리듀서 상태. */
const spawnState = (player, rng = counting(0.9)) => {
    let state = { ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], gameState: GS.IDLE, player };
    const dispatch = (action) => { state = gameReducer(state, action); };
    runQuietRollAndCombat(player, DB.MAPS[player.loc], {
        dispatch,
        addLog: (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } }),
        addStoryLog: () => {},
        commitExploreOutcome: () => {},
        getFullStats: () => calculateFullStats(state.player),
        rng,
    });
    return { state, rng };
};

const win = (state) => gameReducer({ ...state, enemy: { ...state.enemy, hp: 1 } }, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn || 0, seed: 42, now: NOW },
});

const logTexts = (state) => (state.logs || []).map((log) => log.text);

// ── 데이터 ─────────────────────────────────────────────────────────

test('데이터: 의뢰 지역 일곱은 Lv18 ~ 44의 사냥 지역이고 우두머리 칭호는 종 이름 · 접두어와 겹치지 않는다', () => {
    // Wave 80 셋(Lv41 ~ 45 구간) + Wave 81 셋(1회차 긴 공백 Lv26 ~ 40) + Wave 83 몰락한 전초기지(2회차 긴 공백 Lv16 ~ 25), 지역 레벨 순서.
    assert.deepEqual(HUNT_CONTRACTS.map((contract) => contract.map), ['몰락한 전초기지', '고대 마법 탑', '용의 둥지', '용암 지대', '천공 정원', '어둠의 지하 감옥', '지하 미궁']);
    assert.deepEqual(HUNT_CONTRACTS.map((contract) => DB.MAPS[contract.map].level), [18, 25, 25, 36, 40, 42, 44]);
    const prefixes = new Set(CONSTANTS.MONSTER_PREFIXES.map((prefix) => prefix.name));
    for (const contract of HUNT_CONTRACTS) {
        const map = DB.MAPS[contract.map];
        assert.ok(map && map.type !== 'safe' && map.monsters.length > 0, `${contract.map}: 사냥 지역`);
        assert.equal(DB.MONSTERS[contract.champion], undefined, `${contract.champion}: 몬스터 이름이 아니다`);
        for (const word of contract.champion.split(' ')) assert.ok(!prefixes.has(word), `${contract.champion}: 접두어 낱말 없음`);
    }
});

// ── 단계 진행 ──────────────────────────────────────────────────────

test('1단계: 그 지역 처치 40번이 게시 → 완료(골드)로 이어지고, 다른 지역 처치는 세지 않는다', () => {
    let player = basePlayer({ gold: 0 });
    const first = advanceHuntContractOnVictory(player, { isElite: false }, () => NOW);
    assert.deepEqual(first.logs.map((log) => log.text), [MSG.HUNT_CONTRACT_POSTED(SKY, BALANCE.HUNT_CONTRACT_KILL_GOAL)]);
    player = first.player;
    for (let kill = 2; kill < BALANCE.HUNT_CONTRACT_KILL_GOAL; kill += 1) {
        const step = advanceHuntContractOnVictory(player, { isElite: false }, () => NOW);
        assert.equal(step.logs.length, 0, '게시는 한 번');
        player = step.player;
    }
    assert.deepEqual(player.huntContracts[SKY], { stage: HUNT_STAGE_KILLS, progress: BALANCE.HUNT_CONTRACT_KILL_GOAL - 1, round: 1 });
    const elsewhere = advanceHuntContractOnVictory({ ...player, loc: '기계 폐도' }, { isElite: false }, () => NOW);
    assert.equal(elsewhere.player.huntContracts[SKY].progress, BALANCE.HUNT_CONTRACT_KILL_GOAL - 1, '의뢰 밖 지역');
    const done = advanceHuntContractOnVictory(player, { isElite: false }, () => NOW);
    assert.equal(done.completedStage, HUNT_STAGE_KILLS);
    assert.deepEqual(done.player.huntContracts[SKY], { stage: HUNT_STAGE_ELITES, progress: 0, round: 1 });
    assert.equal(done.player.gold, getHuntStageGold(SKY));
    assert.equal(getHuntStageGold(SKY), DB.MAPS[SKY].level * BALANCE.HUNT_CONTRACT_GOLD_PER_LEVEL);
    assert.deepEqual(done.logs.map((log) => log.text), [MSG.HUNT_CONTRACT_STAGE_KILLS_DONE(SKY, getHuntStageGold(SKY), getHuntTraceGoal(1), BALANCE.HUNT_CONTRACT_ELITE_TRACE)]);
});

test('2단계 정예 추적: 정예 10점 · 일반 1점(보스 · 우두머리 제외), 목표 30점 — 완료하면 강화 재료', () => {
    const TRACE = BALANCE.HUNT_CONTRACT_ELITE_TRACE;
    assert.equal(getHuntTraceGoal(1), BALANCE.HUNT_CONTRACT_ELITE_GOAL * TRACE);
    let player = withContract(basePlayer({ inv: [] }), SKY, HUNT_STAGE_ELITES);
    for (const enemy of [{ isElite: true, isBoss: true }, { isElite: true, huntChampion: SKY }, { isElite: false, isBoss: true }]) {
        assert.equal(advanceHuntContractOnVictory(player, enemy, () => NOW).player, player, JSON.stringify(enemy));
    }
    assert.equal(advanceHuntContractOnVictory(player, { isElite: false }, () => NOW).player.huntContracts[SKY].progress, 1, '일반 처치 1점');
    assert.equal(advanceHuntContractOnVictory(player, { isElite: true }, () => NOW).player.huntContracts[SKY].progress, TRACE, '정예 처치 10점');
    // 일반 처치만으로도 끝난다(30번) — 정예가 드문 지역에서 단계가 멈추지 않는다.
    let normalsOnly = player;
    for (let kill = 1; kill < getHuntTraceGoal(1); kill += 1) normalsOnly = advanceHuntContractOnVictory(normalsOnly, { isElite: false }, () => NOW).player;
    assert.equal(normalsOnly.huntContracts[SKY].stage, HUNT_STAGE_ELITES);
    assert.equal(advanceHuntContractOnVictory(normalsOnly, { isElite: false }, () => NOW).completedStage, HUNT_STAGE_ELITES);
    for (let kill = 1; kill < BALANCE.HUNT_CONTRACT_ELITE_GOAL; kill += 1) player = advanceHuntContractOnVictory(player, { isElite: true }, () => NOW).player;
    const done = advanceHuntContractOnVictory(player, { isElite: true }, () => NOW);
    assert.equal(done.completedStage, HUNT_STAGE_ELITES);
    assert.deepEqual(done.player.huntContracts[SKY], { stage: HUNT_STAGE_CHAMPION, progress: 0, round: 1 });
    assert.equal(done.items.length, BALANCE.HUNT_CONTRACT_ENHANCE_MATERIALS);
    assert.ok(done.items.every((item) => item.name === CONSTANTS.ENHANCE_MATERIAL_NAME));
    assert.equal(done.player.inv.length, BALANCE.HUNT_CONTRACT_ENHANCE_MATERIALS);
    assert.deepEqual(done.logs.map((log) => log.text), [MSG.HUNT_CONTRACT_STAGE_ELITES_DONE(
        SKY, BALANCE.HUNT_CONTRACT_ENHANCE_MATERIALS, CONSTANTS.ENHANCE_MATERIAL_NAME, getHuntContract(SKY).champion, BALANCE.HUNT_CHAMPION_OMEN_KILLS,
    )]);
});

test('기척 → 접근: 2단계 뒤 그 지역 승리(우두머리 아닌)가 기척을 채우고, 다 차면 접근 경보 한 번 · 거기서 멈춘다', () => {
    const OMEN = BALANCE.HUNT_CHAMPION_OMEN_KILLS;
    let player = withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION);
    const nearLogs = [];
    for (let kill = 1; kill <= OMEN + 5; kill += 1) {
        const step = advanceHuntContractOnVictory(player, { isElite: kill % 2 === 0 }, () => NOW);
        nearLogs.push(...step.logs.map((log) => log.text));
        player = step.player;
        assert.equal(player.huntContracts[SKY].stage, HUNT_STAGE_CHAMPION, '우두머리를 잡기 전에는 3단계 그대로');
        assert.equal(player.huntContracts[SKY].progress, Math.min(kill, OMEN));
    }
    assert.deepEqual(nearLogs, [MSG.HUNT_CHAMPION_NEAR(getHuntContract(SKY).champion, SKY)], '접근 경보는 기척을 다 채울 때 한 번');
    const elsewhere = advanceHuntContractOnVictory({ ...withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION), loc: '기계 폐도' }, { isElite: false }, () => NOW);
    assert.equal(elsewhere.player.huntContracts[SKY].progress, 0, '다른 지역 승리는 기척을 채우지 않는다');
});

test('3단계: 그 지역 우두머리 처치만 완수 — 착용 가능한 이 직업 장비 + 정수(처치 정수 × 50), 1차 뒤에는 2차 의뢰가 이어진다', () => {
    for (const job of ['전사', '마법사', '도적']) {
        for (const contract of HUNT_CONTRACTS) {
            const player = withContract(basePlayer({ job, loc: contract.map, inv: [] }), contract.map, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS);
            assert.equal(advanceHuntContractOnVictory(player, { isElite: true }, () => NOW).player, player, '일반 정예는 아니다');
            assert.equal(advanceHuntContractOnVictory(player, { isElite: true, huntChampion: '다른 지역' }, () => NOW).player, player);
            const done = advanceHuntContractOnVictory(player, { isElite: true, huntChampion: contract.map }, () => NOW);
            assert.equal(done.completedStage, HUNT_STAGE_CHAMPION);
            assert.deepEqual(done.player.huntContracts[contract.map], { stage: HUNT_STAGE_KILLS, progress: 0, round: 2 }, '2차 의뢰');
            assert.ok(done.logs.some((log) => log.text === MSG.HUNT_CONTRACT_NEXT_ROUND(contract.map, 2, BALANCE.HUNT_CONTRACT_MAX_ROUNDS, getHuntKillGoal(2))));
            assert.equal(done.items.length, 1, `${job} · ${contract.map}: 장비 하나`);
            assert.ok(canEquip(done.items[0], player, {}).ok, `${job} · ${contract.map}: ${done.items[0].name} 착용 가능`);
            const essence = getHuntChampionEssence(player, contract.map);
            assert.equal(essence, getEssenceGainFromExp(10 + DB.MAPS[contract.map].level * 10, getEssenceRewardMult(player.meta)) * BALANCE.HUNT_CONTRACT_CHAMPION_ESSENCE_KILLS);
            assert.equal((done.player.meta.essenceLifetime || 0) - (player.meta.essenceLifetime || 0), essence);
            assert.ok(done.logs.some((log) => log.text === MSG.HUNT_CONTRACT_COMPLETE(contract.map, contract.champion, done.items[0].name, essence)));
            assert.equal(advanceHuntContractOnVictory(done.player, { isElite: true, huntChampion: contract.map }, () => NOW).player.huntContracts[contract.map].stage, HUNT_STAGE_KILLS, '2차 의뢰는 처치부터');
        }
    }
});

test('결정론: 판정 · 보상은 Math.random을 쓰지 않고, 같은 상태는 같은 장비를 준다', () => {
    const player = withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS);
    const a = noRandom(() => advanceHuntContractOnVictory(player, { isElite: true, huntChampion: SKY }, () => NOW));
    const b = noRandom(() => advanceHuntContractOnVictory(player, { isElite: true, huntChampion: SKY }, () => NOW));
    assert.deepEqual(a.items, b.items);
    assert.equal(pickHuntChampionGear(player, SKY)?.name, a.items[0].name);
    noRandom(() => advanceHuntContractOnVictory(withContract(basePlayer(), SKY, HUNT_STAGE_ELITES, BALANCE.HUNT_CONTRACT_ELITE_GOAL - 1), { isElite: true }, () => NOW));
    noRandom(() => advanceHuntContractOnVictory(withContract(basePlayer(), SKY, HUNT_STAGE_KILLS, BALANCE.HUNT_CONTRACT_KILL_GOAL - 1), { isElite: false }, () => NOW));
    noRandom(() => advanceHuntContractOnVictory(withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS - 1), { isElite: false }, () => NOW));
});

// ── Wave 84: 저주 우두머리의 공격력 ──

test('Wave 84: 받는 피해를 키우는 상태(저주)를 거는 우두머리는 공격력 배율을 그 증폭으로 나눈다 — 저주 뒤 실효 타격이 다른 지역과 같다', () => {
    for (const contract of HUNT_CONTRACTS) {
        const expected = contract.status === 'curse'
            ? BALANCE.HUNT_CHAMPION_ATK_MULT / BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT
            : BALANCE.HUNT_CHAMPION_ATK_MULT;
        assert.equal(getHuntChampionAtkMult(contract.status), expected, contract.map);
    }
    assert.ok(HUNT_CONTRACTS.some((contract) => contract.status === 'curse'), '저주 우두머리가 있다(탑의 대마도사)');
    // 실제 엔진: 저주에 걸린 플레이어가 저주 우두머리에게 받는 피해 ≈ 저주 없는 플레이어가 전체 배율 우두머리에게 받는 피해.
    const TOWER = '고대 마법 탑';
    const species = { name: '마법 인형', baseName: '마법 인형', hp: 900, maxHp: 900, atk: 115, def: 28, exp: 10, gold: 10, level: 25 };
    const tower = applyHuntChampion(species, withContract(basePlayer({ loc: TOWER }), TOWER, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS), DB.MAPS[TOWER]);
    assert.equal(tower.huntChampion, TOWER);
    const plainHit = { ...tower, atk: Math.floor(species.atk * BALANCE.HUNT_CHAMPION_ATK_MULT), statusOnHit: undefined, pattern: { guardChance: 0, heavyChance: 0 } };
    const curseHit = { ...tower, statusOnHit: undefined, pattern: { guardChance: 0, heavyChance: 0 } };
    const victim = basePlayer({ loc: TOWER, def: 20, status: [] });
    const cursed = { ...victim, status: ['curse'] };
    const hit = (player, enemy) => CombatEngine.enemyAttack(player, enemy, calculateFullStats(player), () => 0.9).damage;
    const base = hit(victim, plainHit);
    const amplified = hit(cursed, curseHit);
    assert.ok(base > 0);
    // 방어 경감이 증폭 전에 빠지므로 저주 쪽이 약간 낮다(같거나 10% 안).
    assert.ok(amplified <= base && amplified >= base * 0.9, `저주 우두머리 ${amplified} ≈ 기준 ${base}`);
    assert.ok(hit(cursed, plainHit) > base * 1.2, '나누지 않으면 저주가 같은 배율 위에 곱해진다');
});

// ── 우두머리 출현 ──────────────────────────────────────────────────

test('우두머리: 기척을 다 채운 지역의 다음 일반 개체가 우두머리다 — 종 · 탐험 난수 소비는 그대로, 50%에서 격노', () => {
    for (const contract of HUNT_CONTRACTS) {
        const plain = spawnState(basePlayer({ loc: contract.map }));
        const omen = spawnState(withContract(basePlayer({ loc: contract.map }), contract.map, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS - 1));
        assert.equal(omen.state.enemy.huntChampion, undefined, `${contract.map}: 기척을 다 채우기 전에는 나오지 않는다`);
        const hunting = spawnState(withContract(basePlayer({ loc: contract.map }), contract.map, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS));
        assert.equal(hunting.rng.calls, plain.rng.calls, `${contract.map}: 난수 소비 동일`);
        const before = plain.state.enemy;
        const champion = hunting.state.enemy;
        assert.equal(hunting.state.gameState, GS.COMBAT);
        assert.equal(champion.baseName, before.baseName, '종은 그대로');
        assert.equal(champion.huntChampion, contract.map);
        assert.equal(champion.isElite, true);
        assert.equal(champion.name, MSG.HUNT_CHAMPION_NAME(contract.champion, before.baseName));
        assert.equal(champion.maxHp, Math.floor(before.maxHp * BALANCE.HUNT_CHAMPION_HP_MULT));
        assert.equal(champion.atk, Math.floor(before.atk * getHuntChampionAtkMult(contract.status)));
        assert.equal(champion.exp, Math.floor(before.exp * BALANCE.HUNT_CHAMPION_REWARD_MULT));
        assert.equal(champion.phase2.threshold, BALANCE.HUNT_CHAMPION_PHASE_THRESHOLD);
        assert.equal(champion.phase2.name, MSG.HUNT_CHAMPION_ENRAGED_NAME(contract.champion, before.baseName));
        assert.equal(champion.phase2.atkBonus, BALANCE.HUNT_CHAMPION_PHASE_ATK_BONUS);
        assert.ok(matchesQuestTarget(champion.baseName, before.baseName), '임무 목표 판정은 종으로');
        assert.ok(logTexts(hunting.state).includes(MSG.HUNT_CHAMPION_APPEAR(contract.champion, contract.map)));
        assert.equal(plain.state.enemy.huntChampion, undefined, '의뢰 0단계에는 우두머리가 없다');
    }
});

test('우두머리: 보스 · 정예 · 접두어 개체 · 다른 단계 · 다른 지역 · 심연에서는 바꾸지 않는다', () => {
    const player = withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS);
    const enemy = { name: '하늘 정령', baseName: '하늘 정령', hp: 100, maxHp: 100, atk: 10, def: 1, exp: 10, gold: 10 };
    const map = DB.MAPS[SKY];
    assert.equal(applyHuntChampion(enemy, player, map).huntChampion, SKY);
    for (const other of [{ ...enemy, isBoss: true }, { ...enemy, isElite: true }, { ...enemy, name: '거대한 하늘 정령' }]) {
        assert.equal(applyHuntChampion(other, player, map), other);
    }
    assert.equal(applyHuntChampion(enemy, withContract(basePlayer(), SKY, HUNT_STAGE_ELITES), map), enemy);
    assert.equal(applyHuntChampion(enemy, withContract(basePlayer(), SKY, HUNT_STAGE_DONE), map), enemy);
    assert.equal(applyHuntChampion(enemy, { ...player, loc: '기계 폐도' }, DB.MAPS['기계 폐도']), enemy);
    assert.equal(applyHuntChampion(enemy, player, { ...map, level: 'infinite' }), enemy);
});

// ── 실제 승리 정산 ─────────────────────────────────────────────────

test('실제 승리 정산: 우두머리를 이기면 의뢰 완수 · 장비 · 정수 · 도감', () => {
    const { state } = spawnState(withContract(basePlayer({ inv: [] }), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS));
    const after = win(state);
    assert.notEqual(after.gameState, GS.COMBAT, '전투가 끝났다');
    assert.deepEqual(after.player.huntContracts[SKY], { stage: HUNT_STAGE_KILLS, progress: 0, round: 2 }, '1차 완수 → 2차 의뢰');
    // 보상은 승리 정산 뒤의 레벨로 고른다 — 우두머리 경험치로 레벨이 오르면(44 → 45) 그 레벨에 착용할 수 있는 등급이다.
    const gear = pickHuntChampionGear({ ...state.player, level: after.player.level }, SKY);
    assert.ok(canEquip(gear, after.player, {}).ok);
    assert.ok(after.player.inv.some((item) => item.name === gear.name), `${gear.name}이 가방에`);
    assert.ok(logTexts(after).some((text) => text.startsWith('🏆 [토벌 의뢰 완수]')));
    assert.ok((after.player.meta.essenceLifetime || 0) - (state.player.meta.essenceLifetime || 0) >= getHuntChampionEssence(state.player, SKY));
});

test('실제 전투: 우두머리는 생명 50% 아래에서 격노한다(이름 · 공격력)', () => {
    const { state } = spawnState(withContract(basePlayer({ hp: 50_000, maxHp: 50_000 }), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS));
    const champion = state.enemy;
    const hurt = { ...state, enemy: { ...champion, hp: Math.floor(champion.maxHp * 0.45) } };
    const after = gameReducer(hurt, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: hurt.combatTurn || 0, seed: 7, now: NOW } });
    assert.equal(after.gameState, GS.COMBAT, '전제: 한 번에 쓰러지지 않는다');
    assert.equal(after.enemy.phase2Triggered, true);
    assert.equal(after.enemy.name, champion.phase2.name);
    assert.equal(after.enemy.atk, Math.floor(champion.atk * (1 + BALANCE.HUNT_CHAMPION_PHASE_ATK_BONUS)));
    assert.equal(after.enemy.huntChampion, SKY, '격노해도 의뢰의 우두머리다');
    assert.ok(logTexts(after).some((text) => text.includes(MSG.HUNT_CHAMPION_ENRAGE_LOG(getHuntContract(SKY).champion))));
});

test('실제 승리 정산: 의뢰 지역의 일반 승리는 처치를 하나 센다(첫 처치가 게시)', () => {
    const { state } = spawnState(basePlayer());
    const after = win(state);
    assert.deepEqual(after.player.huntContracts[SKY], { stage: HUNT_STAGE_KILLS, progress: 1, round: 1 });
    assert.ok(logTexts(after).includes(MSG.HUNT_CONTRACT_POSTED(SKY, BALANCE.HUNT_CONTRACT_KILL_GOAL)));
    const outside = win(spawnState(basePlayer({ loc: '기계 폐도' })).state);
    assert.equal(outside.player.huntContracts, undefined, '의뢰 밖 지역은 진행이 없다');
});

// ── Wave 82: 차수 · 지역 상태 이상 ──────────────────────────────────

test('차수: 처치 목표는 같고(Wave 84) 추적 목표는 늘고 우두머리 · 보상은 +20%씩 — 마지막 차수의 우두머리가 완수다', () => {
    const MAX = BALANCE.HUNT_CONTRACT_MAX_ROUNDS;
    assert.equal(MAX, 5, 'Wave 84: 3차 → 5차');
    const rounds = [1, 2, 3, 4, 5];
    assert.deepEqual(rounds.map(getHuntKillGoal), [40, 40, 40, 40, 40], 'Wave 84: 처치 목표는 차수마다 같다');
    assert.deepEqual(rounds.map(getHuntEliteGoal), [3, 4, 5, 6, 7]);
    assert.deepEqual(rounds.map(getHuntTraceGoal), [30, 40, 50, 60, 70]);
    assert.deepEqual(rounds.map(getHuntRoundMult), [1, 1.2, 1 + 0.2 * 2, 1 + 0.2 * 3, 1 + 0.2 * 4]);
    assert.deepEqual(rounds.map(getHuntEliteMaterials), [2, 3, 4, 5, 6]);
    assert.equal(getHuntStageGold(SKY, 3), Math.floor(DB.MAPS[SKY].level * BALANCE.HUNT_CONTRACT_GOLD_PER_LEVEL * getHuntRoundMult(3)));

    // 2차 1단계: 40번째 처치에서 끝나고 골드도 2차 배율이다.
    let player = withContract(basePlayer({ gold: 0 }), SKY, HUNT_STAGE_KILLS, getHuntKillGoal(2) - 2, 2);
    player = advanceHuntContractOnVictory(player, { isElite: false }, () => NOW).player;
    assert.equal(player.huntContracts[SKY].stage, HUNT_STAGE_KILLS, '39번째에는 아직');
    const killsDone = advanceHuntContractOnVictory(player, { isElite: false }, () => NOW);
    assert.equal(killsDone.player.gold, getHuntStageGold(SKY, 2));
    // 2차 2단계: 정예 4번째에서 재료 3개.
    const elites = advanceHuntContractOnVictory(withContract(basePlayer({ inv: [] }), SKY, HUNT_STAGE_ELITES, getHuntTraceGoal(2) - 1, 2), { isElite: false }, () => NOW);
    assert.equal(elites.items.length, getHuntEliteMaterials(2));

    // 3차 우두머리는 이제 완수가 아니다 — 4차가 이어진다.
    const third = advanceHuntContractOnVictory(withContract(basePlayer({ inv: [] }), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS, 3), { isElite: true, huntChampion: SKY }, () => NOW);
    assert.deepEqual(third.player.huntContracts[SKY], { stage: HUNT_STAGE_KILLS, progress: 0, round: 4 });
    // 마지막 차수의 우두머리 → 완수, 그 뒤로는 아무것도 세지 않는다.
    const last = withContract(basePlayer({ inv: [] }), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS, MAX);
    const done = advanceHuntContractOnVictory(last, { isElite: true, huntChampion: SKY }, () => NOW);
    assert.deepEqual(done.player.huntContracts[SKY], { stage: HUNT_STAGE_DONE, progress: 0, round: MAX });
    assert.ok(!done.logs.some((log) => log.text.includes('차 의뢰가 이어집니다')), '다음 차수 안내 없음');
    assert.equal(getHuntChampionEssence(last, SKY, MAX), Math.floor(getHuntChampionEssence(last, SKY, 1) * getHuntRoundMult(MAX)));
    assert.equal(advanceHuntContractOnVictory(done.player, { isElite: false }, () => NOW).player, done.player, '완수 뒤에는 그대로');
});

test('지역 상태 이상: 우두머리는 그 지역의 상태 이상을 강타와 격노로 걸고, 차수 배율이 생명 · 공격력에 붙는다', () => {
    assert.deepEqual(HUNT_CONTRACTS.map((contract) => contract.status), ['bleed', 'curse', 'burn', 'burn', 'stun', 'bleed', 'poison']);
    assert.ok(HUNT_CONTRACTS.every((contract) => typeof MSG.DOT_LABELS[contract.status] === 'string'), '상태 이상 라벨이 있다');
    const enemy = { name: '하늘 정령', baseName: '하늘 정령', hp: 100, maxHp: 100, atk: 10, def: 1, exp: 10, gold: 10 };
    assert.equal(BALANCE.HUNT_CONTRACT_MAX_ROUNDS, 5, 'Wave 84: 5차까지');
    for (let round = 1; round <= BALANCE.HUNT_CONTRACT_MAX_ROUNDS; round += 1) {
        const champion = applyHuntChampion(enemy, withContract(basePlayer(), SKY, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS, round), DB.MAPS[SKY]);
        assert.equal(champion.statusOnHit, 'stun');
        assert.equal(champion.phase2.statusEffect, 'stun');
        assert.equal(champion.maxHp, Math.floor(100 * BALANCE.HUNT_CHAMPION_HP_MULT * getHuntRoundMult(round)));
        assert.equal(champion.atk, Math.floor(10 * BALANCE.HUNT_CHAMPION_ATK_MULT * getHuntRoundMult(round)));
    }
    // 실제 리듀서 전투: 격노 전환이 지역 상태 이상을 건다(저항 유물 없음).
    const { state } = spawnState(withContract(basePlayer({ loc: '지하 미궁', hp: 50_000, maxHp: 50_000, status: [] }), '지하 미궁', HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS), counting(0.9));
    assert.equal(state.enemy.huntChampion, '지하 미궁');
    const hurt = { ...state, enemy: { ...state.enemy, hp: Math.floor(state.enemy.maxHp * 0.45) } };
    const after = gameReducer(hurt, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: hurt.combatTurn || 0, seed: 7, now: NOW } });
    assert.equal(after.enemy.phase2Triggered, true);
    assert.ok((after.player.status || []).includes('poison'), '격노가 독을 건다');
});

// ── 런 범위 · 화면 ────────────────────────────────────────────────

test('런 범위: 진행은 사망 · 계승을 넘지 않는다', () => {
    const player = withContract(basePlayer(), SKY, HUNT_STAGE_DONE);
    assert.equal('huntContracts' in pickPermanentPlayerState(player, structuredClone(INITIAL_STATE.player)), false);
});

test('임무 탭: 지역 레벨 − 5부터 보이고 단계마다 상태 줄이 바뀐다', () => {
    assert.deepEqual(getHuntContractRows(basePlayer({ level: 12 })), []);
    const preview = getHuntContractRows(basePlayer({ level: 13 }));
    assert.deepEqual(preview.map((row) => row.map), ['몰락한 전초기지']);
    assert.equal(preview[0].status, MSG.HUNT_CONTRACT_STATUS_LOCKED(18));
    assert.deepEqual(getHuntContractRows(basePlayer({ level: 20 })).map((row) => row.map), ['몰락한 전초기지', '고대 마법 탑', '용의 둥지']);
    assert.deepEqual(getHuntContractRows(basePlayer({ level: 35 })).map((row) => row.map), ['몰락한 전초기지', '고대 마법 탑', '용의 둥지', '용암 지대', SKY]);
    const DUNGEON = '어둠의 지하 감옥';
    const MAZE = '지하 미궁';
    const player = withContract(withContract(withContract(basePlayer({ level: 44 }), SKY, HUNT_STAGE_CHAMPION, 7), DUNGEON, HUNT_STAGE_DONE, 0, BALANCE.HUNT_CONTRACT_MAX_ROUNDS), MAZE, HUNT_STAGE_CHAMPION, BALANCE.HUNT_CHAMPION_OMEN_KILLS, 2);
    const tag = (round) => MSG.HUNT_CONTRACT_ROUND_TAG(round, BALANCE.HUNT_CONTRACT_MAX_ROUNDS);
    const rows = Object.fromEntries(getHuntContractRows(player).map((row) => [row.map, row]));
    assert.deepEqual(Object.keys(rows), HUNT_CONTRACTS.map((contract) => contract.map));
    assert.equal(rows[SKY].status, tag(1) + MSG.HUNT_CONTRACT_STATUS_OMEN(getHuntContract(SKY).champion, 7, BALANCE.HUNT_CHAMPION_OMEN_KILLS));
    assert.equal(rows[MAZE].status, tag(2) + MSG.HUNT_CONTRACT_STATUS_CHAMPION(getHuntContract(MAZE).champion));
    assert.equal(rows[DUNGEON].status, MSG.HUNT_CONTRACT_STATUS_DONE);
    assert.equal(rows['용암 지대'].status, tag(1) + MSG.HUNT_CONTRACT_STATUS_STAGE(1, MSG.HUNT_CONTRACT_STAGE_LABELS[0], 0, BALANCE.HUNT_CONTRACT_KILL_GOAL));

    const html = renderStatic(createElement(HuntContractCard, { player: withContract(basePlayer(), SKY, HUNT_STAGE_ELITES, 2) }));
    assert.ok(html.includes(MSG.HUNT_CONTRACT_PANEL_TITLE));
    assert.ok(html.includes(MSG.HUNT_CONTRACT_ROUND_TAG(1, BALANCE.HUNT_CONTRACT_MAX_ROUNDS) + MSG.HUNT_CONTRACT_STATUS_STAGE(2, MSG.HUNT_CONTRACT_STAGE_LABELS[1], 2, getHuntTraceGoal(1))));
    assert.equal(renderStatic(createElement(HuntContractCard, { player: basePlayer({ level: 12 }) })), '');
});
