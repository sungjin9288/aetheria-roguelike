import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { MIRROR_NODES } from '../src/data/mirror.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getAscensionRuleOffer } from '../src/systems/ascensionRule.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getCycleStart, getCycleSummary, getCycleSummaryLines, snapshotCycleStart } from '../src/utils/cycleSummary.js';
import { ELITE_TITLE_MAPS, getEliteTitleId } from '../src/utils/eliteTitles.js';
import { registerLootToCodex } from '../src/utils/gameUtils.js';
import { applyRuleConquest } from '../src/utils/ruleConquest.js';
import { SIGNATURE_NAMES } from '../src/utils/signatureDiscovery.js';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 100 (원장 §104.4 c — 소유자 결정 "c로 진행"): 계승 화면이 "이번 회차 요약"을 그린다 — 회차 규칙 정복 · 새 전설 각인 · 새 정예 칭호 ·
 * 끝없는 거울(Wave 99). 각인 · 정예 칭호는 계정 단위로 쌓여서 "이번 회차에 새로"는 회차 시작 기준점(`meta.cycleStart`)과의 차이다.
 * 기준점은 계승(`ASCEND`) 한 곳이 새 단계로 남기고 영구 meta라 사망 재시작을 넘는다. 기준점 없는 이전 세이브(단계 ≥ 1)는 그 줄을 그리지 않는다.
 * Wave 108부터 정예 칭호는 계승 · 사망에서, 도감(각인)은 사망에서 빈다 — 요약은 지금 가진 것 − 기준점이다.
 */

const FULL_TREE = Object.fromEntries(MIRROR_NODES.map((node) => [node.id, node.maxLevel]));
const findItem = (name) => [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => item.name === name);
const discover = (player, name) => registerLootToCodex(player, [{ ...findItem(name), id: `t-${name}` }]);
const eliteAt = (state, mapName) => gameReducer(
    { ...state, player: { ...state.player, loc: mapName } },
    { type: AT.SET_ENEMY, payload: { name: '정예 표적', baseName: '표적', isElite: true, hp: 10, maxHp: 10, atk: 1, def: 0, exp: 1, gold: 1 } },
);

const veteran = (meta = {}, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '기록가', job: '전사', level: 50, loc: '마왕성', hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    ...extra,
    meta: {
        ...structuredClone(INITIAL_STATE.player.meta),
        prestigeRank: 2, bonusAtk: 50, bonusHp: 250, bonusMp: 150,
        endgame: { lastEndgameReceiptKey: 'rk-summary' },
        ...meta,
    },
});
const stateOf = (player, gameState = GS.IDLE) => ({ ...structuredClone(INITIAL_STATE), gameState, bootStage: 'ready', player });
const ascend = (state) => gameReducer({ ...state, gameState: GS.ASCENSION }, {
    type: AT.ASCEND,
    payload: {
        expectedPrestigeRank: state.player.meta.prestigeRank, sourceReceiptKey: state.player.meta.endgame.lastEndgameReceiptKey,
        seed: 1, challengeModifiers: [],
    },
});
const lineOf = (player, id) => getCycleSummaryLines(getCycleSummary(player)).find((line) => line.id === id);

test('Wave 100: 계승이 새 단계의 수집 기준점을 남기고, 그 회차의 새 각인 · 새 정예 칭호를 그 차이로 센다', () => {
    let start = veteran({}, { titles: [getEliteTitleId(ELITE_TITLE_MAPS[0])] });
    start = discover(start, SIGNATURE_NAMES[0]);
    const ascended = ascend(stateOf(start, GS.ASCENSION));
    assert.equal(ascended.player.meta.prestigeRank, 3);
    // 2026-10 Wave 108: 정예 칭호는 계승에서 비고(칭호 초기화) 도감(각인)은 남는다 — 기준점도 그 상태다.
    assert.deepEqual(ascended.player.meta.cycleStart, { rank: 3, signatures: [SIGNATURE_NAMES[0]], eliteTitles: 0 });
    const fresh = getCycleSummary(ascended.player);
    assert.deepEqual(fresh.signatures.newNames, []);
    assert.equal(fresh.eliteTitles.gained, 0);

    let state = ascended;
    state = { ...state, player: discover(discover(state.player, SIGNATURE_NAMES[1]), SIGNATURE_NAMES[2]) };
    state = eliteAt(eliteAt(state, ELITE_TITLE_MAPS[1]), ELITE_TITLE_MAPS[2]);
    const summary = getCycleSummary(state.player);
    assert.deepEqual(summary.signatures.newNames, [SIGNATURE_NAMES[1], SIGNATURE_NAMES[2]]);
    assert.equal(summary.signatures.discovered, 3);
    assert.equal(summary.signatures.total, SIGNATURE_NAMES.length);
    assert.deepEqual([summary.eliteTitles.gained, summary.eliteTitles.owned, summary.eliteTitles.total], [2, 2, ELITE_TITLE_MAPS.length]);
});

// 2026-10 Wave 108 (소유자 결정 "죽으면 도감도 초기화"): 기준점은 사망 재시작을 넘지만 도감은 비므로, 요약은 사망 뒤 다시 모은 것만 센다.
test('Wave 100 → Wave 108: 기준점은 사망 재시작을 넘고, 사망이 비운 도감은 요약에서도 빠진다', () => {
    const ascended = ascend(stateOf(veteran(), GS.ASCENSION));
    const found = discover(ascended.player, SIGNATURE_NAMES[3]);
    assert.deepEqual(getCycleSummary(found).signatures.newNames, [SIGNATURE_NAMES[3]]);
    const restarted = CombatEngine.handleDefeat(found, structuredClone(INITIAL_STATE.player), () => 0.5, () => 1).updatedPlayer;
    assert.equal(restarted.level, 1, '사망 재시작이 적용됐다');
    assert.deepEqual(restarted.meta.cycleStart, ascended.player.meta.cycleStart);
    assert.deepEqual(getCycleSummary(restarted).signatures.newNames, [], '사망이 도감을 비웠다');
    const again = discover(restarted, SIGNATURE_NAMES[4]);
    assert.deepEqual(getCycleSummary(again).signatures.newNames, [SIGNATURE_NAMES[4]]);
});

test('Wave 100: 처음 시작한 여정(단계 0)은 빈 기준점 — 기준점 없는 이전 세이브의 계승 단계는 각인 · 정예 줄을 그리지 않는다', () => {
    const firstRun = discover(veteran({ prestigeRank: 0 }, { titles: [getEliteTitleId(ELITE_TITLE_MAPS[0])] }), SIGNATURE_NAMES[0]);
    assert.deepEqual(getCycleStart(firstRun), { rank: 0, signatures: [], eliteTitles: 0 });
    assert.deepEqual(getCycleSummary(firstRun).signatures.newNames, [SIGNATURE_NAMES[0]]);
    assert.equal(getCycleSummary(firstRun).eliteTitles.gained, 1);
    assert.equal(getCycleSummary(firstRun).rule, null, '단계 0에는 회차 규칙이 없다');

    const legacy = veteran({ prestigeRank: 4 });
    assert.equal(getCycleStart(legacy), null);
    const stale = veteran({ prestigeRank: 4, cycleStart: { rank: 3, signatures: [], eliteTitles: 0 } });
    assert.equal(getCycleStart(stale), null, '단계가 다른 기준점은 쓰지 않는다');
    const ids = getCycleSummaryLines(getCycleSummary(legacy)).map((line) => line.id);
    assert.deepEqual(ids, ['rule'], '모르는 값은 지어내지 않는다 — 규칙 줄만 남는다');
});

test('Wave 100: 회차 규칙 줄 — 실제 정복 경로는 정복 · 칭호, 선택형 거절은 거절, 정복 전은 아직', () => {
    const open = veteran({ prestigeRank: 2 });
    const rule = getCycleSummary(open).rule;
    assert.equal(rule.status, 'open');
    assert.equal(lineOf(open, 'rule').text, MSG.CYCLE_SUMMARY_RULE_OPEN(rule.name));

    const conquered = applyRuleConquest(open, 'rk-summary').player;
    assert.equal(getCycleSummary(conquered).rule.status, 'conquered');
    assert.equal(lineOf(conquered, 'rule').text, MSG.CYCLE_SUMMARY_RULE_CONQUERED(rule.name, rule.titleName));
    assert.equal(lineOf(conquered, 'rule').highlight, true);

    // 선택형 규칙(rank 4 고정 순서)을 거절한 회차.
    const optionalRank = veteran({ prestigeRank: 4 }, { ascensionRuleDeclined: true });
    assert.equal(getCycleSummary(optionalRank).rule.status, 'declined');
    assert.equal(lineOf(optionalRank, 'rule').text, MSG.CYCLE_SUMMARY_RULE_DECLINED(getCycleSummary(optionalRank).rule.name));
});

test('Wave 100: 각인 줄은 앞의 셋과 나머지 수, 거울 줄은 끝없는 거울이 열렸을 때만이다', () => {
    let player = veteran({ prestigeRank: 3, cycleStart: { rank: 3, signatures: [], eliteTitles: 0 } });
    for (const name of SIGNATURE_NAMES.slice(0, 5)) player = discover(player, name);
    const signatures = lineOf(player, 'signatures');
    assert.equal(signatures.text, MSG.CYCLE_SUMMARY_SIGNATURES(
        5, MSG.CYCLE_SUMMARY_SIGNATURES_MORE(SIGNATURE_NAMES.slice(0, 3).join(' · '), 2), 5, SIGNATURE_NAMES.length,
    ));
    assert.equal(lineOf(veteran({ prestigeRank: 3, cycleStart: { rank: 3, signatures: [], eliteTitles: 0 } }), 'signatures').text,
        MSG.CYCLE_SUMMARY_SIGNATURES_NONE(0, SIGNATURE_NAMES.length));

    assert.equal(lineOf(player, 'mirror'), undefined, '거울이 잠겨 있으면 거울 줄이 없다');
    const mirrored = veteran({ prestigeRank: 3, mirror: FULL_TREE, mirrorEndlessCycle: { rank: 3, atk: 2, hp: 1, mp: 0 } });
    assert.equal(lineOf(mirrored, 'mirror').text, MSG.ASCEND_MIRROR_ENDLESS_CYCLE(3, 2, 5, 0));
});

test('Wave 100: 계승 화면은 요약 칸에 같은 줄을 그린다 — 거울 기록 줄(Wave 99)도 이 칸 안이다', () => {
    let player = veteran({ prestigeRank: 3, mirror: FULL_TREE, essence: 9_000, cycleStart: { rank: 3, signatures: [], eliteTitles: 0 } },
        { titles: [getEliteTitleId(ELITE_TITLE_MAPS[4])] });
    player = discover(player, SIGNATURE_NAMES[5]);
    const html = renderStatic(createElement(AscensionScreen, { player }));
    assert.ok(html.includes('data-testid="ascension-cycle-summary"'));
    for (const line of getCycleSummaryLines(getCycleSummary(player))) {
        assert.ok(html.includes(`data-testid="ascension-cycle-${line.id}"`), line.id);
        assert.ok(html.includes(line.text), line.text);
    }
    assert.ok(html.includes('data-testid="ascension-mirror-endless"'), 'Wave 98 줄(지금 살 수 있는 것)은 영구 성장 칸에 남는다');
    assert.equal(html.split('ascension-cycle-mirror').length - 1, 1, '거울 기록 줄은 요약 칸에 한 번만');
});

test('Wave 100: 기준점은 패 · 규칙 선택과 무관하다(계승 판정은 그대로) — 기준점이 있어도 회차 규칙 패는 같다', () => {
    const base = veteran();
    const withStart = veteran({ cycleStart: { rank: 2, signatures: [SIGNATURE_NAMES[0]], eliteTitles: 3 } });
    assert.deepEqual(getAscensionRuleOffer(base, 3).map((rule) => rule.id), getAscensionRuleOffer(withStart, 3).map((rule) => rule.id));
    assert.deepEqual(snapshotCycleStart(base, 3), { rank: 3, signatures: [], eliteTitles: 0 });
});
