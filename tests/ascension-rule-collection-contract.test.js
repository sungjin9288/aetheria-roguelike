import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ASCENSION_RULES, UNBOUND_SIGNATURE_GROUP } from '../src/data/ascensionRules.js';
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
    getAscensionRule,
    getRuleSignatureDropMult,
    getSignatureSetMemberNames,
} from '../src/systems/ascensionRule.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { getCollectionSummary, getAscensionRulePreview } from '../src/utils/ascensionRuleView.js';
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
    assert.deepEqual(buildRunChallengeModifiers(['halfHp'], 0), ['halfHp']);
    assert.deepEqual(buildRunChallengeModifiers([], 1), ['blindMap']);
    assert.deepEqual(buildRunChallengeModifiers(['blindMap', 'halfHp'], 1), ['blindMap', 'halfHp']);
    const slots = getChallengeSlotCount(1);
    const picked = BALANCE.CHALLENGE_MODIFIERS.map((m) => m.id).filter((id) => id !== 'blindMap').slice(0, slots);
    const mods = buildRunChallengeModifiers(picked, 1);
    assert.equal(mods.length, slots + 1, '강제 1 + 고른 칸 전부');
    assert.deepEqual(mods, ['blindMap', ...picked]);
    assert.deepEqual(buildRunChallengeModifiers('noGold', 2), ['noGold'], '배열이 아니어도 비틀기는 붙는다');
});

test('계승(ASCEND)은 새 단계의 규칙을 붙이고 시작 로그로 알린다', () => {
    const veteran = playerAt(0, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'rk' } } });
    const next = gameReducer(
        { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, player: veteran, bootStage: 'ready' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: 'rk', seed: 1, challengeModifiers: ['halfHp'] } },
    );
    const rule = getAscensionRule(1);
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
    const rule = getAscensionRulePreview(1);
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
    assert.equal(getAscensionRulePreview(0), null);
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

const ascendFrom = (rank, payload = {}) => gameReducer(
    { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready',
        player: playerAt(rank, { meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: rank, endgame: { lastEndgameReceiptKey: 'rk' } } }) },
    { type: AT.ASCEND, payload: { expectedPrestigeRank: rank, sourceReceiptKey: 'rk', seed: 1, challengeModifiers: [], ...payload } },
);

test('Wave 91: 가벼운 셋(1 ~ 3단계)은 강제, 무거운 셋(4 ~ 6단계)은 선택형이고 내용은 그대로다', () => {
    assert.deepEqual(ASCENSION_RULES.map((rule) => rule.optional === true), [false, false, false, true, true, true]);
    assert.deepEqual(ASCENSION_RULES.map((rule) => rule.modifier), ['blindMap', 'noGold', 'noPotion', 'randomSkills', 'halfHp', 'eliteOnly']);
    assert.deepEqual(buildRunChallengeModifiers([], 4), ['randomSkills'], '기본은 받아들임');
    assert.deepEqual(buildRunChallengeModifiers(['noGold'], 4, true), ['noGold'], '거절하면 비틀기가 없다');
    assert.deepEqual(buildRunChallengeModifiers([], 1, true), ['blindMap'], '강제 규칙은 거절할 수 없다');
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
    const optional = getAscensionRulePreview(4);
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
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: getAscensionRulePreview(1), ruleDeclined: true,
    }));
    assert.ok(!forced.includes('probe-ascension-rule-toggle'));
    assert.match(forced.match(/<button[^>]*data-testid="probe-challenge-blindMap"[^>]*>/)[0], /aria-disabled="true"/, '강제 규칙은 거절 값을 무시한다');
});

test('Wave 91: 도감 수집 요약 — 거절한 회차에는 표적 묶음이 없다', () => {
    assert.ok(getCollectionSummary(playerAt(4)).featuredLabel);
    assert.equal(getCollectionSummary(playerAt(4, { ascensionRuleDeclined: true })).featuredLabel, null);
    assert.ok(getCollectionSummary(playerAt(1, { ascensionRuleDeclined: true })).featuredLabel, '강제 규칙은 거절이 없다');
});

test('Wave 92: 측정 미리보기는 선택형 규칙에만 있고, 받아들임이 거절보다 위험하고 각인을 더 준다(측정 그대로)', () => {
    for (const rule of ASCENSION_RULES) {
        if (!rule.optional) {
            assert.equal(rule.outlook, undefined, `${rule.id}: 강제 규칙에는 고를 차이가 없다`);
            continue;
        }
        const o = rule.outlook;
        assert.ok(o, `${rule.id}: 선택형 규칙은 측정값을 든다`);
        for (const value of Object.values(o)) assert.ok(Number.isFinite(value) && value >= 0);
        assert.ok(o.acceptedDeaths > o.declinedDeaths, `${rule.id}: 받아들이면 더 위험하다`);
        assert.ok(o.acceptedSignatures > o.declinedSignatures, `${rule.id}: 받아들이면 각인을 더 얻는다`);
    }
});

test('Wave 92: 미리보기 줄은 데이터 숫자를 그대로 그리고, 순환이 다시 와도 같은 규칙의 측정을 보인다', () => {
    for (const rank of [4, 5, 6]) {
        const rule = ASCENSION_RULES[rank - 1];
        const preview = getAscensionRulePreview(rank);
        const o = rule.outlook;
        const r1 = (value) => (Math.round(value * 10) / 10).toFixed(1);
        assert.equal(preview.outlook.accepted, MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(r1(o.acceptedDeaths), r1(o.acceptedSignatures)));
        assert.equal(preview.outlook.declined, MSG.ASCENSION_RULE_OUTLOOK_DECLINED(r1(o.declinedDeaths), r1(o.declinedSignatures)));
        assert.equal(preview.outlook.source, MSG.ASCENSION_RULE_OUTLOOK_SOURCE);
        assert.deepEqual(getAscensionRulePreview(rank + ASCENSION_RULES.length).outlook, preview.outlook);
    }
    for (const rank of [1, 2, 3]) assert.equal(getAscensionRulePreview(rank).outlook, null);
    assert.equal(getAscensionRulePreview(4).outlook.accepted, '받아들이면: 사망 3.6회 · 새 각인 +1.6개 · 정복 보상');
    assert.equal(getAscensionRulePreview(5).outlook.declined, '거절하면: 사망 1.7회 · 새 각인 +0.2개');
    assert.equal(getAscensionRulePreview(6).outlook.accepted, '받아들이면: 사망 5.9회 · 새 각인 +1.2개 · 정복 보상', '5.85는 5.9로 반올림한다');
});

test('Wave 92: 선택 화면 — 두 줄을 함께 보이고 지금 고른 쪽을 밝힌다, 강제 규칙은 줄이 없다, 미리보기는 규칙을 바꾸지 않는다', () => {
    const preview = getAscensionRulePreview(6);
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
        testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: getAscensionRulePreview(2),
    }));
    assert.ok(!forced.includes('probe-ascension-rule-outlook'));
    // 표시만이다 — 규칙 · 보상 판정은 미리보기 필드를 읽지 않는다.
    assert.deepEqual(buildRunChallengeModifiers([], 6), ['eliteOnly']);
    assert.deepEqual(buildRunChallengeModifiers([], 6, true), []);
});
