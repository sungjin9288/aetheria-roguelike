import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { ASCENSION_RULES } from '../src/data/ascensionRules.js';
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

test('규칙 데이터는 실제 도전 조건 · 실제 세트 · 실제 칭호를 가리키고, 다섯 세트를 한 번씩 표적으로 삼는다', () => {
    const setKeys = Object.keys(signatureSetsData.sets);
    assert.deepEqual([...ASCENSION_RULES.map((rule) => rule.signatureSet)].sort(), [...setKeys].sort());
    for (const rule of ASCENSION_RULES) {
        assert.ok(KNOWN_MODIFIERS.has(rule.modifier), `${rule.id}의 비틀기는 알려진 도전 조건이다`);
        assert.deepEqual(
            [...getSignatureSetMemberNames(rule.signatureSet)].sort(),
            [...signatureSetsData.sets[rule.signatureSet].members].sort(),
            `${rule.signatureSet} 구성원은 레지스트리 setGroup과 세트 정의가 같다`,
        );
        const title = TITLES.find((entry) => entry.id === rule.conquestTitle.id);
        assert.ok(title, `${rule.conquestTitle.id} 칭호가 있다`);
        assert.equal(title.name, rule.conquestTitle.name);
        assert.ok(TITLE_PASSIVES[rule.conquestTitle.id]?.label, '정복 칭호에도 장착 패시브가 있다');
    }
    for (const id of ['conquest_all', 'set_collector', 'legend_complete']) {
        assert.ok(TITLES.some((entry) => entry.id === id) && TITLE_PASSIVES[id], `${id}`);
    }
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

test('6단계는 1단계 규칙을 다시 돌고, 정복은 새 단계로 다시 받는다 — 칭호는 하나, 각인은 다음 없는 것', () => {
    const first = killDemonKing(playerAt(1), 'rk-1');
    const sixth = killDemonKing({ ...first.player, meta: { ...first.player.meta, prestigeRank: 6, endgame: {} } }, 'rk-6');
    assert.deepEqual(sixth.player.stats.ruleConquestRanks, [1, 6]);
    const titleId = getAscensionRule(1).conquestTitle.id;
    assert.equal(sixth.player.titles.filter((id) => id === titleId).length, 1);
    const second = sixth.player.inv.find((item) => item.id === 'rule-conquest:rk-6');
    assert.equal(second?.name, getSignatureSetMemberNames(getAscensionRule(1).signatureSet)[1]);
});

test('정복 칭호는 정복 기록으로 복구된다 — 규칙마다 · 다섯 모두 · 세트 다섯 완성 · 각인 전부', () => {
    const base = playerAt(1, { titles: [] });
    assert.ok(checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: [6] } }).includes(getAscensionRule(1).conquestTitle.id));
    const four = checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: [1, 2, 3, 4] } });
    assert.ok(!four.includes('conquest_all'));
    const five = checkTitles({ ...base, stats: { ...base.stats, ruleConquestRanks: [1, 2, 3, 4, 5] } });
    assert.ok(five.includes('conquest_all'));
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
