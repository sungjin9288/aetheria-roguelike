import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CLASSES } from '../src/data/classes.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { DB } from '../src/data/db.ts';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.ts';
import { RELICS } from '../src/data/relics.ts';
import { getStructuredFallbackTransaction } from '../src/data/structuredFallbackEvents.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getSkillElement, isDamagingSkill } from '../src/systems/skillPower.ts';
import { buildEventPackage } from '../src/utils/aiEventUtils.ts';
import { getCombatForecast } from '../src/utils/combatForecast.ts';
import * as graveUtils from '../src/utils/graveUtils.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';

/**
 * 원장 §61.5 남은 관찰 4건 (2026-10 Wave 65, 원장 §66). 넷 다 같은 일을 하는 두 경로가 갈라져 있었다.
 *
 * ① 저작 폴백 이벤트 — 로컬 풀의 2지선다 저작 이벤트 12개에 지역 선택지("살펴본다")가 셋째로 붙고 그 칸의 절차적 보상이
 *    손으로 쓴 결과보다 컸다. 이제 저작 선택지 그대로다(모델 이벤트 · 결과 없는 풀 항목은 지금처럼 채운다).
 * ② 체인 유물 지급(그림자 길드 상인의 인장) — 선택 · 교체 지급과 달리 실효 최대치 내리기를 거치지 않았다.
 * ③ 묘비 침공 확률 — 화면은 저장 공격력, 판정은 실효 공격력이었다(Wave 65에 둘 다 `getInvasionAttackPower`).
 *   Wave 70에 확률 침공 자체가 없어졌다 — 다른 차원의 묘비는 망령과 실제로 싸운다(`tests/dimension-grave-event-contract.test.js`).
 * ④ 전투 예고의 "약점" — 기술 `type`만 봤다. 엔진은 `type`이 없으면 무기 원소를 쓴다. 이제 둘 다 `getSkillElement`.
 */

const SRC = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// ── ① 저작 폴백 이벤트 ─────────────────────────────────────────────────────────

const authoredTwoChoiceEntries = () => Object.entries(FALLBACK_EVENT_POOL).flatMap(([key, list]) => list
    .filter((entry) => !getStructuredFallbackTransaction(entry.fallbackTransactionId))
    .filter((entry) => entry.choices.length === 2 && Array.isArray(entry.outcomes) && entry.outcomes.length >= entry.choices.length)
    .map((entry) => ({ key, entry })));

const fallbackContext = (level) => ({
    location: '고요한 숲',
    source: 'fallback',
    playerSnapshot: { level, maxHp: 500, maxMp: 200 },
    mapSnapshot: { level },
});

test('① 로컬 폴백 풀의 2지선다 저작 이벤트는 저작한 두 선택지 그대로다 — 셋째 칸이 붙지 않는다', () => {
    const entries = authoredTwoChoiceEntries();
    assert.equal(entries.length, 12, '감사가 센 12개');
    for (const { key, entry } of entries) {
        for (const level of [5, 40, 80]) {
            const pkg = buildEventPackage({ ...entry, source: 'fallback' }, fallbackContext(level));
            assert.deepEqual(pkg.choices, [...entry.choices], `${key}: ${entry.desc.slice(0, 20)} (Lv${level})`);
            assert.equal(pkg.outcomes.length, entry.choices.length);
            assert.deepEqual(pkg.outcomes.map((outcome) => outcome.choiceIndex), [0, 1]);
        }
    }
});

test('[대조] 모델 이벤트와 결과가 없는 풀 항목은 지금처럼 셋째 칸을 채운다 — 출처는 호출자 권한이다', () => {
    const [{ entry }] = authoredTwoChoiceEntries();
    // 같은 저작 모양을 모델이 보내도(출처 'ai') 이전처럼 채운다 — 모델은 폴백 분기를 자칭할 수 없다.
    const asModel = buildEventPackage({ ...entry, source: 'fallback' }, { ...fallbackContext(40), source: 'ai' });
    assert.equal(asModel.choices.length, 3);
    // 결과가 없는 2지선다 풀 항목은 선택지마다 절차적 결과라 셋째 칸도 같은 규칙이다.
    const proceduralOnly = Object.values(FALLBACK_EVENT_POOL).flat()
        .filter((candidate) => candidate.choices.length === 2 && !candidate.outcomes);
    assert.ok(proceduralOnly.length > 0);
    for (const candidate of proceduralOnly) {
        assert.equal(buildEventPackage({ ...candidate, source: 'fallback' }, fallbackContext(40)).choices.length, 3);
    }
});

// ── ② 체인 유물 지급 → 실효 최대치 ─────────────────────────────────────────────

const STAFF = DB.ITEMS.weapons.find((item) => item.name === '나무지팡이');
const VOID_EYE = RELICS.find((relic) => relic.id === 'void_eye');
const SEAL = RELICS.find((relic) => relic.id === 'merchant_seal');
const chainStep = (chainId, step) => EVENT_CHAINS.find((entry) => entry.id === chainId).steps.find((entry) => entry.step === step);

const shadowGuildPurchase = (playerOverrides) => {
    const stepData = chainStep('shadow_guild', 1);
    let state = {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        logs: [],
        gameState: GS.EVENT,
        currentEvent: { ...structuredClone(stepData.event), _chainId: 'shadow_guild', _chainStep: 1 },
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '용사',
            job: '모험가',
            level: 40,
            gold: 5_000,
            loc: stepData.loc,
            eventChainProgress: { shadow_guild: 1 },
            ...playerOverrides,
        },
    };
    const dispatch = (action) => { state = gameReducer(state, action); };
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch,
        addLog: (type, text) => dispatch({ type: AT.ADD_LOG, payload: { type, text } }),
        getFullStats: () => calculateFullStats(state.player),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);
    return state;
};

test('② 상인의 인장 구매(실제 훅 + 리듀서)가 비전 성향을 밀어내 최대 기력이 줄면 현재 기력도 내린다', () => {
    assert.ok(STAFF && VOID_EYE && SEAL);
    const base = {
        job: '모험가', level: 40, maxHp: 800, maxMp: 300, hp: 800, atk: 100, def: 50,
        relics: [VOID_EYE], equip: { ...INITIAL_STATE.player.equip, weapon: STAFF },
    };
    const before = calculateFullStats({ ...structuredClone(INITIAL_STATE.player), ...base });
    const after = calculateFullStats({ ...structuredClone(INITIAL_STATE.player), ...base, relics: [VOID_EYE, SEAL] });
    assert.ok(after.maxMp < before.maxMp, `전제: 인장이 최대 기력을 낮춘다 (${before.maxMp} → ${after.maxMp})`);

    const state = shadowGuildPurchase({ ...base, mp: before.maxMp });
    assert.deepEqual(state.player.relics.map((relic) => relic.id), ['void_eye', 'merchant_seal'], '구매가 실제로 일어났다');
    assert.equal(state.player.eventChainProgress.shadow_guild, 2);
    assert.equal(state.player.mp, after.maxMp, '현재 기력이 새 실효 최대치로 내려간다');
    assert.ok(state.player.mp <= calculateFullStats(state.player).maxMp);
});

test('[대조] 최대치가 그대로인 구매는 현재 생명 · 기력을 바꾸지 않는다(올리지 않는다)', () => {
    const state = shadowGuildPurchase({ hp: 77, mp: 33, maxHp: 800, maxMp: 300 });
    assert.ok(state.player.relics.some((relic) => relic.id === 'merchant_seal'));
    assert.equal(state.player.hp, 77);
    assert.equal(state.player.mp, 33);
});

// ── ③ 묘비 침공 확률 ───────────────────────────────────────────────────────────

test('③ 확률 침공은 없다 — 저장/실효 공격력 비대칭이 들어설 판정 자체가 사라졌다(Wave 70, 부재 불변식)', () => {
    for (const name of ['calcInvasionChance', 'resolveInvasion', 'getInvasionAttackPower']) {
        assert.equal(name in graveUtils, false, `graveUtils.${name}`);
    }
    for (const path of ['src/components/GravePanel.tsx', 'src/hooks/useInventoryActions.ts', 'src/utils/dimensionGrave.ts']) {
        const source = SRC(path);
        assert.ok(!/guardPower/.test(source), `${path}: 묘비 방어력으로 승패를 정하지 않는다`);
        assert.ok(!/invadeGrave/.test(source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), `${path}: 목록 침공 액션이 없다`);
    }
});

// ── ④ 전투 예고의 약점 표시 ───────────────────────────────────────────────────

const forecastPlayer = { ...structuredClone(INITIAL_STATE.player), hp: 100, maxHp: 100, mp: 9_999, maxMp: 9_999 };
const forecastEnemy = { name: '표적', baseName: '표적', hp: 100, maxHp: 100, atk: 10, def: 0, level: 10, pattern: { guardChance: 0, heavyChance: 0 } };
const forecastFor = (skill, stats, weakness) => getCombatForecast({
    player: { ...forecastPlayer, skillLoadout: { selected: 0, cooldowns: {} } },
    enemy: { ...forecastEnemy, weakness },
    stats,
    selectedSkill: skill,
    skillCooldown: 0,
    enemyTelegraph: { type: 'normal', label: '일반 공격 예상' },
    combatConsumables: [],
});
const allSkills = () => Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || []).map((skill) => ({ job, skill })));

test('④ 무기 원소를 쓰는 위력 기술 24개는 무기 원소가 약점이면 예고가 약점을 말한다', () => {
    const weaponElement = allSkills().filter(({ skill }) => isDamagingSkill(skill) && !skill.type);
    assert.equal(weaponElement.length, 24);
    for (const { job, skill } of weaponElement) {
        const hit = forecastFor(skill, { maxHp: 100, elem: '화염' }, '화염');
        assert.equal(hit.window, '약점 타이밍', `${job} ${skill.name}`);
        const miss = forecastFor(skill, { maxHp: 100, elem: '화염' }, '냉기');
        assert.notEqual(miss.window, '약점 타이밍', `${job} ${skill.name}: 다른 원소`);
    }
});

test('④ 위력이 없는 기술은 무기 원소가 약점이어도 약점을 말하지 않는다 — 엔진이 피해를 굴리지 않는다', () => {
    const support = allSkills().filter(({ skill }) => !isDamagingSkill(skill));
    assert.ok(support.length > 0);
    for (const { job, skill } of support) {
        const forecast = forecastFor(skill, { maxHp: 100, elem: '화염' }, '화염');
        assert.notEqual(forecast.window, '약점 타이밍', `${job} ${skill.name}`);
    }
});

test('④ 예고의 약점 판정은 엔진의 원소 배율과 같다 — 위력 기술 전수 × 약점 일치 / 불일치', () => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: 'tester', level: 40, hp: 5_000, maxHp: 5_000, mp: 9_999, maxMp: 9_999, atk: 400, def: 50,
        equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    };
    const stats = calculateFullStats(player);
    const enemyOf = (weakness) => ({ ...forecastEnemy, hp: 1e7, maxHp: 1e7, weakness });
    let checked = 0;
    for (const { job, skill } of allSkills().filter(({ skill: s }) => isDamagingSkill(s))) {
        const element = getSkillElement(skill, stats);
        for (const weakness of [element, element === '냉기' ? '화염' : '냉기']) {
            const result = CombatEngine.performSkill({ ...player, job }, enemyOf(weakness), stats, skill, () => 0.5);
            const engineWeak = (result.logs || []).some((log) => String(log.text).includes('속성 약점'));
            // 예고의 생명 비율은 실효 최대 생명으로 나눈다 — 위급 판정이 약점 칸을 가리지 않게 생명을 가득 채운 비율(100/100)로 맞춘다.
            const forecastWeak = forecastFor(skill, { ...stats, maxHp: 100 }, weakness).window === '약점 타이밍';
            assert.equal(forecastWeak, engineWeak, `${job} ${skill.name} (약점 ${weakness})`);
            checked += 1;
        }
    }
    assert.ok(checked >= 150, `대조 수 ${checked}`);
});
