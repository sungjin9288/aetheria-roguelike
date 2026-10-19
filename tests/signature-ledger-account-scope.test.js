import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { checkTitles } from '../src/utils/gameUtils.js';
import { getCumulativeQuestProgress } from '../src/utils/cumulativeQuestProgress.js';
import { getCycleSummary } from '../src/utils/cycleSummary.js';
import { getMapDiscoveredSignatureDrops, getMapSignatureDrops } from '../src/utils/mapSignatureHints.js';
import { pickRuleConquestSignature } from '../src/utils/ruleConquest.js';
import {
    SIGNATURE_NAMES,
    countCodexSignatures,
    countCompletedSignatureSets,
    countDiscoveredSignatures,
    getSignatureDiscoveryProgress,
    getSignatureLedger,
    getVisibleCraftRecipes,
    isEquipmentDiscovered,
    isSignatureDiscovered,
    withoutUndiscoveredSignatures,
} from '../src/utils/signatureDiscovery.js';
import { ACHIEVEMENT_TARGET_SCOPE, TITLE_COND_SCOPE } from '../src/utils/journeyScope.js';
import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { renderStatic } from './helpers/render.ts';
import signatureSetsData from '../src/data/signatureSets.json' with { type: 'json' };

/**
 * 2026-10 Wave 125 (소유자 결정 "각인 수집만 계정 단위") — 전설 각인 발견은 사망 · 다시 시작 · 계승을 넘는다.
 *
 * Wave 108 뒤로 사망이 도감을 비워 전설 각인 수집이 회차 끝 중앙값 3개(25개 중)에서 멈췄다 — 무사망 회차가 10 ~ 30%뿐이라
 * 수집이 회차를 넘어 쌓이지 않았다(원장 §132). 이제 발견은 계정 장부(`stats.signatureLedger`)로 넘고, 도감 · 도감 보너스는
 * 그대로 비워진다. 장부는 사망 · 계승 전이 한 곳(`pickPermanentPlayerState`)이 쓴다.
 */

const NOW = 1_700_000_000_000;
const clone = (value) => structuredClone(value);

const ITEM_BY_NAME = new Map([...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])].map((item) => [item.name, item]));
const bucketOf = (name) => {
    const type = ITEM_BY_NAME.get(name)?.type;
    return type === 'weapon' ? 'weapons' : type === 'shield' ? 'shields' : 'armors';
};
const codexWith = (names, extra = {}) => {
    const codex = { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {}, ...clone(extra) };
    for (const name of names) codex[bucketOf(name)][name] = { discovered: true };
    return codex;
};

const [SIG_A, SIG_B, SIG_C] = SIGNATURE_NAMES;
const PLAIN_WEAPON = (DB.ITEMS.weapons || []).find((item) => !SIGNATURE_NAMES.includes(item.name)).name;

const traveller = ({ codexNames = [SIG_A, SIG_B], ledger, meta = {}, stats = {}, ...rest } = {}) => {
    const base = clone(INITIAL_STATE.player);
    return {
        ...base,
        name: '각인 검증', job: '전사', level: 40, hp: 800, maxHp: 800, mp: 200, maxMp: 200, atk: 200, def: 80, gold: 5000,
        meta: { ...base.meta, ...meta },
        stats: {
            ...base.stats,
            codex: codexWith([...codexNames, PLAIN_WEAPON], { monsters: { 슬라임: true } }),
            codexBonusAtk: 3, codexBonusDef: 2, codexBonusHp: 15,
            ...(ledger ? { signatureLedger: ledger } : {}),
            ...stats,
        },
        ...rest,
    };
};

const TRANSITIONS = {
    사망: (before) => CombatEngine.handleDefeat(before, clone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer,
    '다시 시작': (before) => gameReducer({ ...clone(INITIAL_STATE), bootStage: 'ready', player: before }, { type: AT.RESET_GAME }).player,
    계승: (before) => gameReducer(
        { ...clone(INITIAL_STATE), gameState: GS.ASCENSION, bootStage: 'ready', player: before },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 1, sourceReceiptKey: 'dk-ledger', seed: 1, challengeModifiers: [] } },
    ).player,
};
const ascensionReady = (player) => ({
    ...player,
    meta: { ...player.meta, prestigeRank: 1, endgame: { lastEndgameReceiptKey: 'dk-ledger' } },
    stats: { ...player.stats, demonKingSlain: 1 },
});

for (const [label, transition] of Object.entries(TRANSITIONS)) {
    test(`${label}: 전설 각인 발견은 남고 도감 · 도감 보너스는 범위 그대로다`, () => {
        const before = label === '계승' ? ascensionReady(traveller()) : traveller();
        const after = transition(clone(before));
        assert.deepEqual(after.stats.signatureLedger, [SIG_A, SIG_B], '장부에 이번 여정 도감의 각인이 남는다');
        assert.ok(isSignatureDiscovered(SIG_A, after) && isSignatureDiscovered(SIG_B, after));
        assert.ok(!isSignatureDiscovered(SIG_C, after), '발견하지 않은 각인은 장부에 없다');
        assert.equal(countDiscoveredSignatures(after), 2);
        if (label === '계승') {
            assert.ok(after.stats.codex.weapons[PLAIN_WEAPON], '계승은 도감을 남긴다');
            assert.equal(after.stats.codexBonusHp, 15);
        } else {
            assert.equal(countCodexSignatures(after), 0, '사망은 도감을 비운다');
            assert.equal(after.stats.codexBonusHp, 0, '도감 보너스는 사망하면 비워진다');
            assert.ok(!isEquipmentDiscovered(PLAIN_WEAPON, after), '전설 각인이 아닌 장비는 장부에 오르지 않는다');
            assert.ok(!(after.stats.signatureLedger || []).includes(PLAIN_WEAPON));
        }
    });
}

test('사망이 거듭되어도 장부는 줄지 않고 여정마다 쌓인다', () => {
    const first = TRANSITIONS.사망(traveller({ codexNames: [SIG_A] }));
    const nextJourney = { ...first, stats: { ...first.stats, codex: codexWith([SIG_C]) } };
    const second = TRANSITIONS.사망(nextJourney);
    assert.deepEqual(new Set(second.stats.signatureLedger), new Set([SIG_A, SIG_C]));
    const third = TRANSITIONS.사망(clone(second));
    assert.deepEqual(new Set(third.stats.signatureLedger), new Set([SIG_A, SIG_C]), '빈 도감으로 죽어도 장부는 그대로다');
});

test('장부가 없는 이전 세이브는 계정에 남은 발견 흔적(회차 기준점 · 직업 여정 각인)으로 채운다', () => {
    const legacy = traveller({
        codexNames: [],
        meta: { prestigeRank: 2, cycleStart: { rank: 2, signatures: [SIG_A], eliteTitles: 0 } },
        classJourney: { version: 2, sequence: 1, byJob: { 전사: { expeditionIds: [], skillBranches: [], signatureItems: [SIG_B, '없는 각인'], bossNames: [], regions: [], encounterDiscoveries: [], representativeExpeditionId: null } } },
    });
    assert.deepEqual(new Set(getSignatureLedger(legacy)), new Set([SIG_A, SIG_B]), '각인 이름만 받는다');
    assert.ok(isSignatureDiscovered(SIG_A, legacy) && isSignatureDiscovered(SIG_B, legacy));
    const after = TRANSITIONS.사망(clone(legacy));
    assert.deepEqual(new Set(after.stats.signatureLedger), new Set([SIG_A, SIG_B]));
    // 장부가 생긴 뒤로는 장부가 정본이다.
    assert.deepEqual(getSignatureLedger({ ...legacy, stats: { ...legacy.stats, signatureLedger: [SIG_C] } }), [SIG_C]);
});

test('획득처 공개(Wave 103)는 계정 수집을 읽는다 — 죽어도 아는 각인의 획득처는 남는다', () => {
    const map = DB.MAPS ? Object.keys(DB.MAPS).find((name) => getMapSignatureDrops(name).length > 0) : null;
    assert.ok(map, '각인이 떨어지는 지역이 있다');
    const signature = getMapSignatureDrops(map)[0].name;
    const after = TRANSITIONS.사망(traveller({ codexNames: [signature] }));
    assert.equal(countCodexSignatures(after), 0);
    assert.deepEqual(getMapDiscoveredSignatureDrops(map, after).map(({ name }) => name).includes(signature), true);
    assert.deepEqual(withoutUndiscoveredSignatures([signature], after), [signature]);
    assert.deepEqual(getVisibleCraftRecipes([{ name: signature }], after), [{ name: signature }]);
    const stranger = TRANSITIONS.사망(traveller({ codexNames: [] }));
    assert.deepEqual(withoutUndiscoveredSignatures([signature], stranger), []);
});

test('수집 업적 · 칭호는 계정 범위다 — 죽어도 수령 기록 · 칭호가 남아 같은 보상을 다시 받지 않는다', () => {
    for (const target of ['signaturesDiscovered', 'signatureSetsCompleted']) {
        assert.equal(ACHIEVEMENT_TARGET_SCOPE[target], 'account', target);
        assert.equal(TITLE_COND_SCOPE[target], 'account', target);
    }
    const before = traveller({ titles: ['legend_seeker'], stats: { claimedAchievements: ['ach_sig_first'] } });
    const after = TRANSITIONS.사망(before);
    assert.ok(after.stats.claimedAchievements.includes('ach_sig_first'));
    assert.ok(after.titles.includes('legend_seeker'));
});

test('세트 완성 · 수집 진행 · 전설 도감 화면이 같은 계정 수집을 읽는다', () => {
    const set = Object.values(signatureSetsData.sets)[0];
    const after = TRANSITIONS.사망(traveller({ codexNames: set.members }));
    assert.equal(countCompletedSignatureSets(after), 1);
    assert.equal(getSignatureDiscoveryProgress(after).discovered, set.members.length);
    const html = renderStatic(createElement(LegendaryCodex, { player: after }));
    assert.ok(html.includes(`${set.members.length}/${SIGNATURE_NAMES.length}`), '전설 도감의 수가 계정 수집이다');
});

test('임무 202는 이번 여정에서 손에 넣은 각인을 센다 — 받자마자 끝나는 임무가 되지 않는다', () => {
    const quest = DB.QUESTS.find((entry) => entry.id === 202);
    const veteran = TRANSITIONS.사망(traveller({ codexNames: SIGNATURE_NAMES.slice(0, 15) }));
    assert.equal(countDiscoveredSignatures(veteran), 15);
    assert.equal(getCumulativeQuestProgress(quest, veteran), 0);
    const hunting = { ...veteran, stats: { ...veteran.stats, codex: codexWith([SIG_A, SIG_B]) } };
    assert.equal(getCumulativeQuestProgress(quest, hunting), 2);
});

test('정복 보상은 계정에 아직 없는 각인을 준다', () => {
    const set = Object.entries(signatureSetsData.sets)[0];
    const [setKey, setDef] = set;
    const after = TRANSITIONS.사망(traveller({ codexNames: [setDef.members[0]] }));
    assert.notEqual(pickRuleConquestSignature(after, setKey), setDef.members[0]);
});

test('회차 요약의 새 각인은 사망으로 줄지 않는다', () => {
    const before = traveller({ codexNames: [SIG_A], meta: { prestigeRank: 1, cycleStart: { rank: 1, signatures: [], eliteTitles: 0 } } });
    const after = TRANSITIONS.사망(before);
    assert.deepEqual(getCycleSummary(after).signatures.newNames, [SIG_A]);
});

test('칭호 판정(수집 칭호)도 계정 수집을 읽는다', () => {
    const after = TRANSITIONS.사망(traveller({ codexNames: SIGNATURE_NAMES.slice(0, 5) }));
    assert.ok(checkTitles(after).includes('legend_seeker'));
});
