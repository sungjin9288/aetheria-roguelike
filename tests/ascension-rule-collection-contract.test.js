import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ASCENSION_RULES, OUTLOOK_DEFAULT_SAMPLES, UNBOUND_SIGNATURE_GROUP } from '../src/data/ascensionRules.js';
import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import signatureRegistry from '../src/data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../src/data/signatureSets.json' with { type: 'json' };
import { TITLES, TITLE_PASSIVES } from '../src/data/titles.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import {
    getActiveAscensionRule,
    getAscensionRule,
    getAscensionRuleById,
    getAscensionRuleCycle,
    getAscensionRuleOffer,
    getConqueredRuleIds,
    resolveAscensionRuleChoice,
    getRuleSignatureDropMult,
    getSignatureSetMemberNames,
} from '../src/systems/ascensionRule.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { getCollectionSummary, getAscensionRulePreview, getAscensionRuleOfferView } from '../src/utils/ascensionRuleView.js';
import { getChallengeRewardPercent } from '../src/utils/challengeRules.js';
import { checkTitles } from '../src/utils/gameUtils.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { buildRunChallengeModifiers, getChallengeSlotCount } from '../src/utils/runStart.js';
import { countDiscoveredSignatures } from '../src/utils/signatureDiscovery.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import Codex from '../src/components/Codex.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 89 (소유자 결정 §93.4 (b) "회차마다 이름 있는 규칙" + "반복하면서 칭호 · 세트를 다 모으는 콜렉터의 재미를 완수할 수 있게").
 *
 * 계승 단계(rank) ≥ 1의 회차마다 규칙 하나가 붙는다 — 비틀기(도전 조건 하나 강제) · 표적 세트(그 세트 각인 드롭 ×3) · 정복 보상
 * (그 단계에서 마왕을 처음 쓰러뜨리면 칭호 + 아직 없는 각인 하나). 규칙은 rank에서 도출되므로 저장하지 않는다.
 */

const NOW = 1_700_000_000_000;
const RULE_COUNT = ASCENSION_RULES.length;
const KNOWN_MODIFIERS = new Set(BALANCE.CHALLENGE_MODIFIERS.map((modifier) => modifier.id));

const playerAt = (rank, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '수집가', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank },
    ...extra,
});

// 2026-10 Wave 94: 규칙을 읽는 함수는 meta를 받는다 — 고른 카드(`ascensionRule`)가 없는 meta는 고정 순서다.
const rk = (rank) => ({ prestigeRank: rank });
const ALL_RULE_IDS = ASCENSION_RULES.map((rule) => rule.id);
// 패를 규칙 하나로 좁힌다 — 나머지를 정복한 것으로 두면 정복하지 않은 규칙이 그 하나뿐이라 패에 반드시 들어간다.
const onlyUnconquered = (ruleId) => ALL_RULE_IDS.filter((id) => id !== ruleId);

const demonKing = { name: '마왕', baseName: '마왕', isBoss: true, hp: 0, maxHp: 10_000, atk: 500, def: 100, exp: 9_000, gold: 9_000 };

const killDemonKing = (player, receiptKey) => resolveEndgameVictory({
    player, deadEnemy: demonKing, receiptKey, rng: () => 0.99, now: NOW,
});

const withDiscovered = (player, names) => {
    const codex = structuredClone(player.stats.codex);
    for (const name of names) {
        const item = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((entry) => entry.name === name);
        const bucket = item.type === 'weapon' ? 'weapons' : item.type === 'shield' ? 'shields' : 'armors';
        codex[bucket] = { ...codex[bucket], [name]: true };
    }
    return { ...player, stats: { ...player.stats, codex } };
};

// ── 규칙 표 ────────────────────────────────────────────────────────────

test('규칙은 rank에서 도출된다 — rank 0은 없고 1 ~ 5가 서로 다른 규칙, 6부터 다시 돈다', () => {
    assert.equal(getAscensionRule(0), null);
    assert.equal(getAscensionRule(undefined), null);
    const firstCycle = Array.from({ length: RULE_COUNT }, (_, i) => getAscensionRule(i + 1));
    assert.equal(new Set(firstCycle.map((rule) => rule.id)).size, RULE_COUNT);
    for (let rank = 1; rank <= RULE_COUNT * 3; rank += 1) {
        assert.equal(getAscensionRule(rank), firstCycle[(rank - 1) % RULE_COUNT], `rank ${rank}`);
    }
});

test('규칙 데이터는 실제 도전 조건 · 실제 세트 · 실제 칭호를 가리키고, 다섯 세트 + 세트 밖 묶음을 한 번씩 표적으로 삼는다', () => {
    const setKeys = Object.keys(signatureSetsData.sets);
    assert.deepEqual([...ASCENSION_RULES.map((rule) => rule.signatureSet)].sort(), [...setKeys, UNBOUND_SIGNATURE_GROUP.key].sort());
    assert.equal(new Set(ASCENSION_RULES.map((rule) => rule.modifier)).size, ASCENSION_RULES.length, '비틀기는 규칙마다 다르다');
    for (const rule of ASCENSION_RULES) {
        assert.ok(KNOWN_MODIFIERS.has(rule.modifier), `${rule.id}의 비틀기는 알려진 도전 조건이다`);
        const expectedMembers = rule.signatureSet === UNBOUND_SIGNATURE_GROUP.key
            ? Object.keys(signatureRegistry.entries).filter((name) => !setKeys.some((key) => signatureSetsData.sets[key].members.includes(name)))
            : signatureSetsData.sets[rule.signatureSet].members;
        assert.deepEqual(
            [...getSignatureSetMemberNames(rule.signatureSet)].sort(),
            [...expectedMembers].sort(),
            `${rule.signatureSet} 구성원은 레지스트리 setGroup과 세트 정의가 같다(세트 밖 묶음은 setGroup이 없는 각인 전부)`,
        );
        const title = TITLES.find((entry) => entry.id === rule.conquestTitle.id);
        assert.ok(title, `${rule.conquestTitle.id} 칭호가 있다`);
        assert.equal(title.name, rule.conquestTitle.name);
        assert.ok(TITLE_PASSIVES[rule.conquestTitle.id]?.label, '정복 칭호에도 장착 패시브가 있다');
    }
    for (const id of ['conquest_all', 'set_collector', 'legend_complete']) {
        assert.ok(TITLES.some((entry) => entry.id === id) && TITLE_PASSIVES[id], `${id}`);
    }
    // 표적 묶음이 레지스트리 25개를 빠짐없이 덮는다 — 정복만으로도 모든 각인에 닿는다.
    const covered = ASCENSION_RULES.flatMap((rule) => getSignatureSetMemberNames(rule.signatureSet));
    assert.deepEqual([...covered].sort(), Object.keys(signatureRegistry.entries).sort());
});

test('Wave 90: 비틀기는 측정한 무게 순이다 — 가벼운 셋(위치 · 골드 · 물약)이 먼저, 정예가 맨 뒤', () => {
    assert.deepEqual(ASCENSION_RULES.map((rule) => rule.modifier), ['blindMap', 'noGold', 'noPotion', 'randomSkills', 'halfHp', 'eliteOnly']);
    assert.equal(getAscensionRule(4).signatureSet, UNBOUND_SIGNATURE_GROUP.key);
});

// ── 비틀기: 도전 조건 강제 ─────────────────────────────────────────────

test('비틀기는 맨 앞에 붙고, 고른 것과 겹치면 한 번만이며, 고르는 칸을 쓰지 않는다 — rank 0은 그대로다', () => {
    assert.deepEqual(buildRunChallengeModifiers(['halfHp'], rk(0)), ['halfHp']);
    assert.deepEqual(buildRunChallengeModifiers([], rk(1)), ['blindMap']);
    assert.deepEqual(buildRunChallengeModifiers(['blindMap', 'halfHp'], rk(1)), ['blindMap', 'halfHp']);
    const slots = getChallengeSlotCount(1);
    const picked = BALANCE.CHALLENGE_MODIFIERS.map((m) => m.id).filter((id) => id !== 'blindMap').slice(0, slots);
    const mods = buildRunChallengeModifiers(picked, rk(1));
    assert.equal(mods.length, slots + 1, '강제 1 + 고른 칸 전부');
    assert.deepEqual(mods, ['blindMap', ...picked]);
    assert.deepEqual(buildRunChallengeModifiers('noGold', rk(2)), ['noGold'], '배열이 아니어도 비틀기는 붙는다');
});

test('계승(ASCEND)은 새 단계의 규칙을 붙이고 시작 로그로 알린다', () => {
    const veteran = playerAt(0, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'rk' } } });
    const next = gameReducer(
        { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, player: veteran, bootStage: 'ready' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'rk', seed: 1, challengeModifiers: ['halfHp'],
            ruleId: getAscensionRuleOffer(veteran, 1).find((card) => card.modifier !== 'halfHp').id } },
    );
    const rule = getActiveAscensionRule(next.player.meta);
    assert.equal(next.player.meta.prestigeRank, 1);
    assert.deepEqual(next.player.challengeModifiers, [rule.modifier, 'halfHp']);
    assert.ok(next.logs.some((log) => log.text.includes(`[${rule.name}]`)), '회차 규칙 시작 로그');
});

test('새 게임 · 사망 재시작(start)도 지금 단계의 규칙을 붙인다 — 빈손의 성전은 시작 골드 0', () => {
    let dispatched = null;
    const logs = [];
    const player = playerAt(2);
    createCharacterActions({
        player, gameState: GS.IDLE, dispatch: (action) => { if (action.type === AT.SET_PLAYER && !dispatched) dispatched = action; },
        addLog: (type, text) => logs.push(text), addStoryLog: () => {},
        getFullStats: (p) => calculateFullStats(p),
    }, { emitUnlockedTitles: () => {} }).start('수집가', 'male', '모험가', []);
    assert.deepEqual(dispatched.payload.challengeModifiers, ['noGold']);
    assert.equal(dispatched.payload.gold, 0);
    assert.ok(logs.some((text) => text.includes(`[${getAscensionRule(2).name}]`)));
});

// ── 표적 세트: 드롭 배율 ───────────────────────────────────────────────

test('표적 세트 각인만 드롭 배율이 붙고, 난수 소비 수는 규칙과 무관하다', () => {
    assert.equal(getRuleSignatureDropMult(playerAt(1), '세계수의 검'), BALANCE.ASCENSION_RULE_SIGNATURE_MULT);
    assert.equal(getRuleSignatureDropMult(playerAt(2), '세계수의 검'), 1, '다른 회차의 표적이 아니다');
    assert.equal(getRuleSignatureDropMult(playerAt(0), '세계수의 검'), 1, '첫 회차는 규칙이 없다');
    assert.equal(getRuleSignatureDropMult(playerAt(1), '요정의 날개'), 1, '각인이 아니다');

    // 숲 요정 — 세계수의 검 3%. 고정 굴림 0.06은 기본 확률(3%)은 못 넘고 ×3(9%)은 넘는다.
    const enemy = { ...DB.MONSTERS['숲 요정'], name: '숲 요정', baseName: '숲 요정', exp: 30, level: 8 };
    const loot = (rank, roll) => {
        let draws = 0;
        const result = CombatEngine.processLoot(enemy, playerAt(rank, { level: 8 }), 1, () => { draws += 1; return roll; }, () => NOW);
        return { draws, names: result.items.map((item) => item.name) };
    };
    const has = (names) => names.some((name) => name.endsWith('세계수의 검'));
    assert.ok(!has(loot(0, 0.06).names));
    assert.ok(has(loot(1, 0.06).names), '표적 세트 회차에는 나온다');
    assert.ok(!has(loot(2, 0.06).names));
    for (const rank of [0, 1, 2]) assert.equal(loot(rank, 0.999).draws, loot(0, 0.999).draws, `rank ${rank} 난수 소비`);
});

// ── 정복 보상 ──────────────────────────────────────────────────────────

test('그 단계에서 마왕을 처음 쓰러뜨리면 정복 칭호와 표적 세트의 아직 없는 첫 각인을 받는다(도감 등록 · 가방 상한 무시)', () => {
    const rule = getAscensionRule(1);
    const firstMember = getSignatureSetMemberNames(rule.signatureSet)[0];
    const fullBag = Array.from({ length: 40 }, (_, i) => ({ id: `junk-${i}`, name: '돌멩이', type: 'mat' }));
    const result = killDemonKing(playerAt(1, { inv: fullBag }), 'rk-1');
    assert.equal(result.outcome, 'ascension');
    assert.ok(result.player.titles.includes(rule.conquestTitle.id));
    assert.deepEqual(result.player.stats.ruleConquestRanks, [1]);
    const granted = result.player.inv.find((item) => item.id === 'rule-conquest:rk-1');
    assert.equal(granted?.name, firstMember);
    assert.equal(result.player.inv.length, fullBag.length + 1);
    assert.equal(countDiscoveredSignatures(result.player), 1, '도감에 등록된다');
    const texts = result.logs.map((log) => log.text);
    assert.ok(texts.includes(MSG.ASCENSION_RULE_CONQUERED(rule.name)));
    assert.ok(texts.includes(MSG.ASCENSION_RULE_CONQUEST_SIGNATURE(firstMember)));
    assert.equal(result.player.stats.demonKingSlain, 1);
});

test('정복은 단계마다 한 번이다 — 같은 영수증 재생 · 같은 단계 두 번째 처치 · 사망 재시작 뒤 처치 모두 다시 주지 않는다', () => {
    const first = killDemonKing(playerAt(1), 'rk-a');
    assert.equal(killDemonKing(first.player, 'rk-a').outcome, 'replay');
    const second = killDemonKing(first.player, 'rk-b');
    assert.deepEqual(second.player.stats.ruleConquestRanks, [1]);
    assert.ok(!second.player.inv.some((item) => item.id === 'rule-conquest:rk-b'));
    assert.ok(!second.logs.some((log) => log.text === MSG.ASCENSION_RULE_CONQUERED(getAscensionRule(1).name)));

    const carried = pickPermanentPlayerState(first.player, INITIAL_STATE.player);
    assert.deepEqual(carried.stats.ruleConquestRanks, [1], '정복 기록은 계정 단위로 넘어간다');
    const restarted = { ...playerAt(1), ...carried, inv: [] };
    const again = killDemonKing(restarted, 'rk-c');
    assert.ok(!again.player.inv.some((item) => item.id === 'rule-conquest:rk-c'));
});

test('표적 세트를 다 모았으면 다른 세트의 없는 각인, 전부 모았으면 각인 없이 로그만 남는다', () => {
    const rule = getAscensionRule(4);
    const members = getSignatureSetMemberNames(rule.signatureSet);
    const complete = withDiscovered(playerAt(4), members);
    const fallback = killDemonKing(complete, 'rk-f');
    const granted = fallback.player.inv.find((item) => item.id === 'rule-conquest:rk-f');
    assert.ok(granted && !members.includes(granted.name), `다른 각인: ${granted?.name}`);

    const allNames = Object.keys(signatureRegistry.entries);
    const everything = withDiscovered(playerAt(4), allNames);
    const none = killDemonKing(everything, 'rk-g');
    assert.ok(!none.player.inv.some((item) => item.id === 'rule-conquest:rk-g'));
    assert.ok(none.logs.some((log) => log.text === MSG.ASCENSION_RULE_CONQUEST_COMPLETE));
    assert.ok(none.player.titles.includes(rule.conquestTitle.id), '칭호는 그대로 받는다');
});

test('규칙 수 다음 단계는 1단계 규칙을 다시 돌고, 정복은 새 단계로 다시 받는다 — 칭호는 하나, 각인은 다음 없는 것', () => {
    const cycle = RULE_COUNT + 1;
    const first = killDemonKing(playerAt(1), 'rk-1');
    const again = killDemonKing({ ...first.player, meta: { ...first.player.meta, prestigeRank: cycle, endgame: {} } }, 'rk-again');
    assert.deepEqual(again.player.stats.ruleConquestRanks, [1, cycle]);
    const titleId = getAscensionRule(1).conquestTitle.id;
    assert.equal(again.player.titles.filter((id) => id === titleId).length, 1);
    const second = again.player.inv.find((item) => item.id === 'rule-conquest:rk-again');
    assert.equal(second?.name, getSignatureSetMemberNames(getAscensionRule(1).signatureSet)[1]);
});

test('흩어진 전설 규칙: 세트 밖 각인만 드롭 배율 · 정복은 그 묶음의 없는 첫 각인', () => {
    const rank = ASCENSION_RULES.findIndex((rule) => rule.signatureSet === UNBOUND_SIGNATURE_GROUP.key) + 1;
    const unbound = getSignatureSetMemberNames(UNBOUND_SIGNATURE_GROUP.key);
    assert.equal(unbound.length, 8);
    for (const name of unbound) assert.equal(getRuleSignatureDropMult(playerAt(rank), name), BALANCE.ASCENSION_RULE_SIGNATURE_MULT, name);
    assert.equal(getRuleSignatureDropMult(playerAt(rank), '세계수의 검'), 1, '세트 각인은 표적이 아니다');
    const result = killDemonKing(playerAt(rank), 'rk-u');
    assert.equal(result.player.inv.find((item) => item.id === 'rule-conquest:rk-u')?.name, unbound[0]);
    assert.ok(result.player.titles.includes('conquest_unbound'));
});

test('정복 칭호는 정복 기록으로 복구된다 — 규칙마다 · 모든 규칙 · 세트 다섯 완성 · 각인 전부', () => {
    const base = playerAt(1, { titles: [] });
    const ranks = Array.from({ length: RULE_COUNT }, (_, i) => i + 1);
    assert.ok(checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: [RULE_COUNT + 1] } }).includes(getAscensionRule(1).conquestTitle.id));
    const allButOne = checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: ranks.slice(0, -1) } });
    assert.ok(!allButOne.includes('conquest_all'));
    const all = checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: ranks } });
    assert.ok(all.includes('conquest_all'));
    const allSets = withDiscovered(base, Object.values(signatureSetsData.sets).flatMap((set) => set.members));
    assert.ok(checkTitles(allSets).includes('set_collector'));
    assert.ok(!checkTitles(allSets).includes('legend_complete'));
    assert.ok(checkTitles(withDiscovered(base, Object.keys(signatureRegistry.entries))).includes('legend_complete'));
});

// ── 화면 ──────────────────────────────────────────────────────────────

test('도전 규칙 선택: 규칙의 비틀기는 잠겨 켜져 있고 칸 수에 들지 않으며 보상 % 에는 센다', () => {
    const rule = getAscensionRulePreview(rk(1));
    const html = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: ['halfHp'], slots: 3, onToggle: () => {}, rule,
    }));
    assert.match(html, /data-testid="probe-ascension-rule"/);
    assert.ok(html.includes(MSG.ASCENSION_RULE_NEXT(rule.name)));
    const lockedButton = html.match(/<button[^>]*data-testid="probe-challenge-blindMap"[^>]*>/)[0];
    assert.match(lockedButton, /aria-pressed="true"/);
    assert.match(lockedButton, /aria-disabled="true"/);
    assert.ok(html.includes('>1/3<'), '고른 칸은 halfHp 하나');
    assert.ok(html.includes(MSG.CHALLENGE_PICKER_REWARD(getChallengeRewardPercent(2))), '보상은 규칙 + 고른 것 = 2개');

    const none = renderStatic(createElement(ChallengeModifierPicker, { testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {} }));
    assert.ok(!none.includes('probe-ascension-rule'));
    assert.equal(getAscensionRulePreview(rk(0)), null);
});

test('도감 수집 완주: 세트별 발견 수 · 정복 수 · 이번 회차 표적 세트를 그린다', () => {
    const rule = getAscensionRule(1);
    const member = getSignatureSetMemberNames(rule.signatureSet)[0];
    const player = withDiscovered(playerAt(1, { stats: { ...playerAt(1).stats, ruleConquestRanks: [1, 2] } }), [member]);
    const summary = getCollectionSummary(player);
    assert.equal(summary.conquered, 2);
    const unboundRow = summary.sets.find((entry) => entry.key === UNBOUND_SIGNATURE_GROUP.key);
    assert.equal(unboundRow?.total, 8, '세트 밖 묶음도 수집 요약 한 줄이다');
    const row = summary.sets.find((entry) => entry.key === rule.signatureSet);
    assert.equal(row.owned, 1);
    assert.equal(row.featured, true);
    const html = renderStatic(createElement(Codex, { player, dispatch: () => {} }));
    assert.match(html, /data-testid="codex-collection"/);
    const escaped = (text) => text.replace(/'/g, '&#x27;');
    assert.ok(html.includes(escaped(summary.conquestLabel)));
    assert.ok(html.includes(escaped(summary.featuredLabel)));
    assert.ok(html.includes(escaped(row.label)));
    const firstRun = getCollectionSummary(playerAt(0));
    assert.equal(firstRun.featuredLabel, null, '첫 회차는 표적 세트가 없다');
});

// ── Wave 91: 무거운 규칙 셋은 선택형(기본 받아들임) ─────────────────────────

// 2026-10 Wave 94: 패를 고정 순서의 다음 규칙 하나로 좁혀 그 카드를 고른다(Wave 91 계약은 규칙 내용을 본다).
const ascendFrom = (rank, payload = {}, ruleId = getAscensionRule(rank + 1).id) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready',
        player: playerAt(rank, {
            meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: 'rk' } },
            stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: onlyUnconquered(ruleId) },
        }) },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: rank, sourceReceiptKey: 'rk', seed: 1, challengeModifiers: [], ruleId, ...payload } },
);

test('Wave 91: 가벼운 셋(1 ~ 3단계)은 강제, 무거운 셋(4 ~ 6단계)은 선택형이고 내용은 그대로다', () => {
    assert.deepEqual(ASCENSION_RULES.map((rule) => rule.optional === true), [false, false, false, true, true, true]);
    assert.deepEqual(ASCENSION_RULES.map((rule) => rule.modifier), ['blindMap', 'noGold', 'noPotion', 'randomSkills', 'halfHp', 'eliteOnly']);
    assert.deepEqual(buildRunChallengeModifiers([], rk(4)), ['randomSkills'], '기본은 받아들임');
    assert.deepEqual(buildRunChallengeModifiers(['noGold'], rk(4), true), ['noGold'], '거절하면 비틀기가 없다');
    assert.deepEqual(buildRunChallengeModifiers([], rk(1), true), ['blindMap'], '강제 규칙은 거절할 수 없다');
});

test('Wave 91: 계승에서 거절하면 비틀기 · 표적 배율 · 정복이 모두 없고 기록은 런 범위다', () => {
    const declined = ascendFrom(3, { declineRule: true });
    assert.equal(declined.player.meta.prestigeRank, 4);
    assert.equal(declined.player.ascensionRuleDeclined, true);
    assert.deepEqual(declined.player.challengeModifiers, []);
    assert.ok(declined.logs.some((log) => log.text === MSG.ASCENSION_RULE_DECLINED_START(getAscensionRule(4).name)));
    const unbound = getSignatureSetMemberNames(UNBOUND_SIGNATURE_GROUP.key)[0];
    assert.equal(getRuleSignatureDropMult(declined.player, unbound), 1);
    const kill = killDemonKing({ ...declined.player, meta: { ...declined.player.meta, endgame: {} } }, 'rk-d');
    assert.ok(!kill.player.inv.some((item) => item.id === 'rule-conquest:rk-d'), '정복 각인 없음');
    assert.deepEqual(kill.player.stats.ruleConquestRanks || [], [], '정복 기록 없음 — 그 단계는 순환이 다시 올 때');
    assert.equal(pickPermanentPlayerState(declined.player, INITIAL_STATE.player).ascensionRuleDeclined, undefined, '영구 상태가 아니다');

    const accepted = ascendFrom(3);
    assert.equal(accepted.player.ascensionRuleDeclined, false);
    assert.deepEqual(accepted.player.challengeModifiers, ['randomSkills']);
    assert.equal(getRuleSignatureDropMult(accepted.player, unbound), BALANCE.ASCENSION_RULE_SIGNATURE_MULT);

    const forced = ascendFrom(0, { declineRule: true });
    assert.equal(forced.player.ascensionRuleDeclined, false, '강제 규칙 단계에서 거절 요청은 무시된다');
    assert.deepEqual(forced.player.challengeModifiers, ['blindMap']);
});

test('Wave 91: 새 게임 · 사망 재시작(start)도 거절을 받는다', () => {
    let dispatched = null;
    createCharacterActions({
        player: playerAt(5), gameState: GS.IDLE, dispatch: (action) => { if (action.type === AT.SET_PLAYER && !dispatched) dispatched = action; },
        addLog: () => {}, addStoryLog: () => {}, getFullStats: (p) => calculateFullStats(p),
    }, { emitUnlockedTitles: () => {} }).start('수집가', 'male', '모험가', [], true);
    assert.equal(dispatched.payload.ascensionRuleDeclined, true);
    assert.deepEqual(dispatched.payload.challengeModifiers, []);
});

test('Wave 91: 선택 화면 — 선택형 규칙은 받아들임/거절 단추, 거절하면 잠긴 칸 · 보상 % 없음, 강제 규칙은 단추 없음', () => {
    const optional = getAscensionRulePreview(rk(4));
    assert.equal(optional.optional, true);
    const render = (props) => renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: optional, ...props,
    }));
    const accepted = render({ ruleDeclined: false });
    assert.match(accepted, /data-testid="probe-ascension-rule-toggle"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-testid="probe-ascension-rule-toggle"/);
    assert.match(accepted.match(/<button[^>]*data-testid="probe-challenge-randomSkills"[^>]*>/)[0], /aria-disabled="true"/);
    assert.ok(accepted.includes(MSG.CHALLENGE_PICKER_REWARD(getChallengeRewardPercent(1))));
    const declined = render({ ruleDeclined: true });
    assert.ok(declined.includes(MSG.ASCENSION_RULE_DECLINED_DETAIL));
    assert.doesNotMatch(declined.match(/<button[^>]*data-testid="probe-challenge-randomSkills"[^>]*>/)[0], /aria-disabled/);
    assert.ok(!declined.includes('probe-challenge-reward'), '고른 것도 규칙도 없으면 보상 줄이 없다');
    const forced = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: getAscensionRulePreview(rk(1)), ruleDeclined: true,
    }));
    assert.ok(!forced.includes('probe-ascension-rule-toggle'));
    assert.match(forced.match(/<button[^>]*data-testid="probe-challenge-blindMap"[^>]*>/)[0], /aria-disabled="true"/, '강제 규칙은 거절 값을 무시한다');
});

test('Wave 91: 도감 수집 요약 — 거절한 회차에는 표적 묶음이 없다', () => {
    assert.ok(getCollectionSummary(playerAt(4)).featuredLabel);
    assert.equal(getCollectionSummary(playerAt(4, { ascensionRuleDeclined: true })).featuredLabel, null);
    assert.ok(getCollectionSummary(playerAt(1, { ascensionRuleDeclined: true })).featuredLabel, '강제 규칙은 거절이 없다');
});

test('Wave 92 · 93: 측정 미리보기는 선택형 규칙에만 있고, 순환마다 받아들임이 거절보다 위험하고 각인을 더 준다(측정 그대로)', () => {
    const cycles = new Set();
    for (const rule of ASCENSION_RULES) {
        if (!rule.optional) {
            assert.equal(rule.outlook, undefined, `${rule.id}: 강제 규칙에는 고를 차이가 없다`);
            continue;
        }
        // 2026-10 Wave 114: 두 번째 순환 측정은 Wave 108 전 값이라 지웠다 — 지금은 첫 순환 측정 하나다(원장 §121.7).
        assert.ok(Array.isArray(rule.outlook) && rule.outlook.length >= 1, `${rule.id}: 선택형 규칙은 첫 순환 측정을 든다`);
        cycles.add(rule.outlook.length);
        rule.outlook.forEach((o, i) => {
            for (const value of Object.values(o)) assert.ok(Number.isFinite(value) && value >= 0);
            assert.equal(o.measuredRank, ASCENSION_RULES.indexOf(rule) + 1 + i * ASCENSION_RULES.length, `${rule.id} 순환 ${i + 1}: 잰 단계는 고정 순서의 그 자리다`);
            assert.ok(o.acceptedDeaths > o.declinedDeaths, `${rule.id} 순환 ${i + 1}: 받아들이면 더 위험하다`);
            assert.ok(o.acceptedSignatures > o.declinedSignatures, `${rule.id} 순환 ${i + 1}: 받아들이면 각인을 더 얻는다`);
        });
    }
    assert.equal(cycles.size, 1, '선택형 규칙은 같은 순환까지 잰다');
});

test('Wave 93: 순환 번호는 계승 단계에서 도출된다 — rank 1 ~ 6 = 1, 7 ~ 12 = 2', () => {
    assert.deepEqual([0, 1, 6, 7, 12, 13, 18, 19].map(getAscensionRuleCycle), [0, 1, 1, 2, 2, 3, 3, 4]);
});

test('Wave 92 · 93 · 94: 미리보기 줄은 그 순환의 측정을 그대로 그리고, 출처는 잰 단계(고정 순서)를 밝힌다', () => {
    const r1 = (value) => (Math.round(value * 10) / 10).toFixed(1);
    for (const rank of [4, 5, 6, 10, 11, 12, 16, 17, 18]) {
        const rule = getAscensionRule(rank);
        const cycle = getAscensionRuleCycle(rank);
        const measuredCycle = Math.min(cycle, rule.outlook.length);
        const o = rule.outlook[measuredCycle - 1];
        const preview = getAscensionRulePreview(rk(rank));
        assert.equal(preview.outlook.accepted, MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(r1(o.acceptedDeaths), r1(o.acceptedSignatures)), `rank ${rank}`);
        assert.equal(preview.outlook.declined, MSG.ASCENSION_RULE_OUTLOOK_DECLINED(r1(o.declinedDeaths), r1(o.declinedSignatures)), `rank ${rank}`);
        assert.equal(preview.outlook.source, MSG.ASCENSION_RULE_OUTLOOK_SOURCE(o.measuredRank, o.samples ?? OUTLOOK_DEFAULT_SAMPLES), `rank ${rank}`);
        assert.equal(o.measuredRank, ASCENSION_RULES.indexOf(rule) + 1 + (measuredCycle - 1) * ASCENSION_RULES.length, '잰 단계는 고정 순서의 그 규칙 자리다');
    }
    for (const rank of [1, 2, 3, 7, 8, 9]) assert.equal(getAscensionRulePreview(rk(rank)).outlook, null);
    // 2026-10 Wave 114: 두 번째 순환은 첫 순환 측정을 보이고 출처 줄이 잰 단계를 밝힌다(Wave 93 규칙).
    assert.deepEqual(getAscensionRulePreview(rk(10)).outlook, getAscensionRulePreview(rk(4)).outlook, '두 번째 순환은 마지막으로 잰 순환 값을 보인다');
    // 2026-10 Wave 121: 저장소 드라이버 v2 · Wave 118 게임으로 다시 쟀다 — 거절은 그 단계 카드 하나만 거절한 짝(원장 §128).
    assert.equal(getAscensionRulePreview(rk(4)).outlook.accepted, '받아들이면: 사망 11.8회 · 새 각인 +1.2개 · 정복 보상');
    assert.equal(getAscensionRulePreview(rk(5)).outlook.accepted, '받아들이면: 사망 17.3회 · 새 각인 +1.2개 · 정복 보상', '1.15는 1.2로 반올림한다');
    assert.equal(getAscensionRulePreview(rk(5)).outlook.declined, '거절하면: 사망 1.7회 · 새 각인 +0.1개');
    assert.equal(getAscensionRulePreview(rk(6)).outlook.accepted, '받아들이면: 사망 4.4회 · 새 각인 +1.3개 · 정복 보상');
    assert.equal(getAscensionRulePreview(rk(4)).outlook.source, '그 회차 평균 · 모의 플레이 75판 · 고정 순서 계승 4단계에서 잰 값');
    assert.equal(getAscensionRulePreview(rk(17)).outlook.source, '그 회차 평균 · 모의 플레이 120판 · 고정 순서 계승 5단계에서 잰 값');
});

test('Wave 92: 선택 화면 — 두 줄을 함께 보이고 지금 고른 쪽을 밝힌다, 강제 규칙은 줄이 없다, 미리보기는 규칙을 바꾸지 않는다', () => {
    const preview = getAscensionRulePreview(rk(6));
    const render = (ruleDeclined) => renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: preview, ruleDeclined,
    }));
    const lineClass = (html, side) => html.match(new RegExp(`<span[^>]*data-testid="probe-ascension-rule-outlook-${side}"[^>]*>`))[0];
    for (const declined of [false, true]) {
        const html = render(declined);
        assert.ok(html.includes('probe-ascension-rule-outlook'));
        assert.ok(html.includes(preview.outlook.accepted) && html.includes(preview.outlook.declined) && html.includes(preview.outlook.source));
        assert.match(lineClass(html, declined ? 'declined' : 'accepted'), /text-orange-100/);
        assert.match(lineClass(html, declined ? 'accepted' : 'declined'), /text-slate-400/);
    }
    const forced = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: getAscensionRulePreview(rk(2)),
    }));
    assert.ok(!forced.includes('probe-ascension-rule-outlook'));
    // 표시만이다 — 규칙 · 보상 판정은 미리보기 필드를 읽지 않는다.
    assert.deepEqual(buildRunChallengeModifiers([], rk(6)), ['eliteOnly']);
    assert.deepEqual(buildRunChallengeModifiers([], rk(6), true), []);
});

// ── Wave 94: 회차 규칙 카드 뽑기 ──────────────────────────────────────

const veteranAt = (rank, receipt, extra = {}) => playerAt(rank, {
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: receipt } },
    ...extra,
});
const ascendWith = (player, payload = {}) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: player.meta.prestigeRank, sourceReceiptKey: player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [], ...payload } },
);
const RECEIPTS = Array.from({ length: 60 }, (_, i) => `rk-${i}`);

test('Wave 94: 패는 이번 순환에서 정복하지 않은 규칙에서 서로 다른 최대 3장이고, 같은 처치에서는 같은 패 · 처치마다 다른 패다', () => {
    assert.equal(BALANCE.ASCENSION_RULE_OFFER_COUNT, 3);
    const offers = RECEIPTS.map((receipt) => getAscensionRuleOffer(veteranAt(0, receipt), 1).map((rule) => rule.id));
    for (const offer of offers) assert.equal(new Set(offer).size, 3);
    assert.deepEqual(getAscensionRuleOffer(veteranAt(0, 'rk-1'), 1).map((r) => r.id), offers[1], '같은 영수증 · 단계는 같은 패');
    assert.ok(new Set(offers.map((offer) => offer.join())).size > 10, '처치마다 패가 다르다');
    assert.deepEqual(new Set(offers.flat()), new Set(ALL_RULE_IDS), '여러 처치에 걸쳐 모든 규칙이 나온다');
    assert.ok(new Set(offers.map((offer) => offer[0])).size > 1, '첫 카드도 고정이 아니다');

    const conquered = ['lost_pilgrimage', 'empty_crusade', 'dry_dragon_road'];
    for (const receipt of RECEIPTS) {
        const offer = getAscensionRuleOffer(veteranAt(3, receipt, { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: conquered } }), 4);
        assert.deepEqual(offer.map((rule) => rule.id).sort(), ['fading_dimension', 'shadow_legion', 'tangled_legends'], '정복하지 않은 것만 남으면 그 셋');
    }
    const one = getAscensionRuleOffer(veteranAt(3, 'rk-0', { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: onlyUnconquered('shadow_legion') } }), 4);
    assert.deepEqual(one.map((rule) => rule.id), ['shadow_legion'], '남은 규칙이 하나면 패도 그 하나 — 정복한 규칙으로 칸을 채우지 않는다');
    const two = getAscensionRuleOffer(veteranAt(4, 'rk-0', { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS.slice(0, 4) } }), 5);
    assert.deepEqual(two.map((rule) => rule.id).sort(), ['fading_dimension', 'shadow_legion']);
    assert.deepEqual(getAscensionRuleOffer(veteranAt(0, 'rk-0'), 0), []);
});

test('Wave 94: 계승은 패에서 고른 카드를 붙이고 영구 meta에 남긴다 — 패 밖 · 없음은 패에서 가장 가벼운 카드', () => {
    for (const receipt of RECEIPTS.slice(0, 20)) {
        const player = veteranAt(0, receipt);
        const offer = getAscensionRuleOffer(player, 1);
        const lightest = [...offer].sort((a, b) => ASCENSION_RULES.indexOf(a) - ASCENSION_RULES.indexOf(b))[0];
        for (const card of offer) {
            const next = ascendWith(player, { ruleId: card.id });
            assert.deepEqual(next.player.meta.ascensionRule, { rank: 1, ruleId: card.id });
            assert.equal(next.player.challengeModifiers[0], card.modifier);
            assert.ok(next.logs.some((log) => log.text.includes(`[${card.name}]`)));
        }
        const outside = ALL_RULE_IDS.find((id) => !offer.some((card) => card.id === id));
        assert.equal(ascendWith(player, { ruleId: outside }).player.meta.ascensionRule.ruleId, lightest.id, '패 밖의 id는 받지 않는다');
        assert.equal(ascendWith(player).player.meta.ascensionRule.ruleId, lightest.id, '고르지 않으면 가장 가벼운 카드');
        assert.equal(resolveAscensionRuleChoice(offer, undefined).id, lightest.id);
        assert.equal(getAscensionRuleOfferView(player, 1).defaultId, lightest.id, '화면이 처음 골라 둔 카드 = 리듀서 기본값');
    }
    // 첫 카드가 가장 가벼운 카드가 아닌 처치가 있다(기본값이 "첫 카드"가 아님을 판별).
    assert.ok(RECEIPTS.some((receipt) => {
        const offer = getAscensionRuleOffer(veteranAt(0, receipt), 1);
        return resolveAscensionRuleChoice(offer, undefined).id !== offer[0].id;
    }));
});

test('Wave 94: 고른 규칙은 같은 단계의 사망 재시작 · 표적 배율이 읽고, 다른 단계의 기록이나 이전 세이브는 고정 순서다', () => {
    const picked = playerAt(2, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2, ascensionRule: { rank: 2, ruleId: 'shadow_legion' } } });
    assert.equal(getActiveAscensionRule(picked.meta).id, 'shadow_legion');
    let dispatched = null;
    createCharacterActions({
        player: picked, gameState: GS.IDLE, dispatch: (action) => { if (action.type === AT.SET_PLAYER && !dispatched) dispatched = action; },
        addLog: () => {}, addStoryLog: () => {}, getFullStats: (p) => calculateFullStats(p),
    }, { emitUnlockedTitles: () => {} }).start('수집가', 'male', '모험가', []);
    assert.deepEqual(dispatched.payload.challengeModifiers, ['eliteOnly'], '사망 재시작은 고른 규칙 그대로');
    const shadowSig = getSignatureSetMemberNames('shadow-lord')[0];
    assert.equal(getRuleSignatureDropMult(picked, shadowSig), BALANCE.ASCENSION_RULE_SIGNATURE_MULT);
    assert.equal(getRuleSignatureDropMult(picked, '세계수의 검'), 1);
    const stale = { ...picked.meta, prestigeRank: 3 };
    assert.equal(getActiveAscensionRule(stale).id, getAscensionRule(3).id, '다른 단계의 기록은 쓰지 않는다');
    assert.equal(getActiveAscensionRule(rk(2)).id, getAscensionRule(2).id, '기록이 없으면(이전 세이브) 고정 순서');
    assert.deepEqual(pickPermanentPlayerState(picked, INITIAL_STATE.player).meta.ascensionRule, { rank: 2, ruleId: 'shadow_legion' }, '영구 meta로 넘어간다');
});

test('Wave 94: 정복은 규칙 id로 남고 칭호 복구 · 패 · 도감이 그것을 읽는다 — 이전 기록(단계)은 처음 쓸 때 고정 순서로 옮긴다', () => {
    const legacy = { ruleConquestRanks: [1, 2] };
    assert.deepEqual([...getConqueredRuleIds(legacy)].sort(), ['empty_crusade', 'lost_pilgrimage']);
    const player = playerAt(1, {
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 1, ascensionRule: { rank: 1, ruleId: 'shadow_legion' } },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRanks: [2] },
    });
    const kill = killDemonKing(player, 'rk-shadow');
    assert.ok(kill.player.titles.includes('conquest_shadow'), '고른 규칙의 정복 칭호');
    assert.deepEqual([...kill.player.stats.ruleConquestRuleIds].sort(), ['empty_crusade', 'shadow_legion'], '이전 기록(2단계 = 빈손의 성전)을 옮기고 새 정복을 더한다');
    assert.deepEqual(kill.player.stats.ruleConquestRanks, [2, 1]);
    assert.deepEqual(pickPermanentPlayerState(kill.player, INITIAL_STATE.player).stats.ruleConquestRuleIds, kill.player.stats.ruleConquestRuleIds);
    const restored = checkTitles({ ...kill.player, titles: [] });
    assert.ok(restored.includes('conquest_shadow') && restored.includes('conquest_celestial'), '정복 칭호는 규칙 id로 복구된다');
    assert.ok(!restored.includes('conquest_worldtree'), '1단계 정복이지만 고른 규칙이 달랐다');
    assert.equal(getCollectionSummary(kill.player).conquered, 2);
    for (const receipt of RECEIPTS.slice(0, 10)) {
        const offer = getAscensionRuleOffer({ ...kill.player, meta: { ...kill.player.meta, endgame: { lastEndgameReceiptKey: receipt } } }, 2);
        assert.ok(offer.every((rule) => !['shadow_legion', 'empty_crusade'].includes(rule.id)), '정복한 규칙은 패에 오지 않는다(정복하지 않은 것이 셋 이상일 때)');
    }
});

test('Wave 94: 선택 화면 — 패의 카드를 그리고 고른 카드를 밝히며 그 카드의 띠 · 잠긴 칸을 보인다', () => {
    const player = veteranAt(0, 'rk-2');
    const view = getAscensionRuleOfferView(player, 1);
    const picked = view.cards[2];
    const html = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: picked, ruleOffer: view.cards, onSelectRule: () => {},
    }));
    assert.match(html, /data-testid="probe-rule-offer"/);
    assert.ok(html.includes(MSG.ASCENSION_RULE_OFFER_TITLE));
    for (const card of view.cards) {
        const button = html.match(new RegExp(`<button[^>]*data-testid="probe-rule-card-${card.id}"[^>]*>`))[0];
        assert.match(button, new RegExp(`aria-pressed="${card.id === picked.id}"`));
        assert.ok(html.includes(card.name) && html.includes(card.twist));
    }
    assert.ok(html.includes(MSG.ASCENSION_RULE_NEXT(picked.name)));
    for (const lockedId of picked.lockedIds) {
        assert.match(html.match(new RegExp(`<button[^>]*data-testid="probe-challenge-${lockedId}"[^>]*>`))[0], /aria-disabled="true"/);
    }
    const single = renderStatic(createElement(ChallengeModifierPicker, {
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: getAscensionRulePreview(rk(2)),
    }));
    assert.ok(!single.includes('probe-rule-offer'), '인트로(이미 고른 규칙)는 패가 없다');
});

test('Wave 94: 패는 덱이다 — 고르지 않아도(가장 가벼운 카드) 순환마다 여섯 규칙을 모두 거치고, 다 정복하면 다시 찬다', () => {
    // 원장 §99: 정복한 규칙으로 칸을 채우던 첫 구현에서는 고르지 않는 플레이어가 언제나 정복한 가벼운 카드를 받아
    //   무거운 둘(꺼져 가는 차원 · 암흑의 군단)을 720회차 중 한 번도 만나지 않았다.
    for (const receipt of ['a', 'b', 'c', 'd', 'e']) {
        let ledger = [];
        const seen = [];
        for (let rank = 1; rank <= 12; rank += 1) {
            const player = veteranAt(rank - 1, `${receipt}-${rank}`, { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ledger } });
            const rule = resolveAscensionRuleChoice(getAscensionRuleOffer(player, rank), undefined);
            seen.push(rule.id);
            ledger = [...ledger, rule.id];
        }
        assert.deepEqual([...seen.slice(0, 6)].sort(), [...ALL_RULE_IDS].sort(), `${receipt}: 첫 순환에 여섯 규칙 모두`);
        // 2026-10 Wave 105: 둘째 순환부터 덱은 겹친 여섯 규칙이다 — 둘째 순환도 여섯 모두를 거친다.
        assert.deepEqual([...seen.slice(6)].sort(), ALL_RULE_IDS.map((id) => `stacked_${id}`).sort(), `${receipt}: 둘째 순환은 겹친 여섯 규칙 모두`);
    }
    const full = getAscensionRuleOffer(veteranAt(6, 'rk-0', { stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS } }), 7);
    assert.equal(full.length, 3, '여섯을 모두 정복하면 덱이 다시 찬다(겹친 규칙으로)');
    assert.ok(full.every((rule) => rule.stackedOf), '다시 찬 덱은 겹친 규칙이다');
    const kill = killDemonKing(playerAt(1, {
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 1, ascensionRule: { rank: 1, ruleId: 'lost_pilgrimage' } },
        stats: { ...structuredClone(INITIAL_STATE.player.stats), ruleConquestRuleIds: ALL_RULE_IDS },
    }), 'rk-again');
    assert.deepEqual(kill.player.stats.ruleConquestRuleIds, [...ALL_RULE_IDS, 'lost_pilgrimage'], '다시 정복해도 한 줄이 남는다(순환을 센다)');
});
