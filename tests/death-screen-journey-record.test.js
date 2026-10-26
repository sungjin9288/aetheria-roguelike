import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getCycleBestLevel, recordCycleBestLevel } from '../src/utils/cycleBestLevel.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { getJourneyEssenceGain } from '../src/utils/runProgress.js';
import { getAscensionRuleOfferView } from '../src/utils/ascensionRuleView.js';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import DeathScreen from '../src/components/app/DeathScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 사망 화면이 말하는 여정 기록 — 무엇에 쓰러졌는지(적 이름 · 남은 생명 %), 이번 여정에 모은 계승 정수, 이번 회차에 끝낸 여정의
 * 최고 레벨 — 은 실제 전투 패배 전이(`RESOLVE_COMBAT_ACTION` · `USE_COMBAT_ITEM`)가 만든다. 다시 오르는 레벨업 기록은 그 최고
 * 레벨까지 얼마나 남았는지 · 넘었는지를 남긴다. 기준점이 없는 이전 세이브는 그 줄을 그리지 않는다(지어내지 않는다).
 */

const NOW = 1_700_000_000_000;
const ENEMY_NAME = '훈련용 정령';
const potion = { id: 'death-record-potion', name: '전투 회복 물약', type: 'hp', val: 10 };

const makeState = ({ player = {}, meta = {}, stats = {}, enemy = {} } = {}) => {
    const base = structuredClone(INITIAL_STATE);
    return {
        ...base,
        gameState: 'combat',
        player: {
            ...base.player,
            name: '기록자',
            level: 4,
            loc: '고요한 숲',
            hp: 1,
            maxHp: 500,
            inv: [potion],
            ...player,
            meta: { ...base.player.meta, ...meta },
            stats: { ...base.player.stats, ...stats },
        },
        enemy: {
            name: ENEMY_NAME,
            baseName: ENEMY_NAME,
            level: 1,
            hp: 50,
            maxHp: 100,
            atk: 9_999,
            def: 999_999,
            exp: 1,
            gold: 1,
            pattern: { guardChance: 0, heavyChance: 0 },
            ...enemy,
        },
        quickSlots: [potion, null, null],
    };
};

const actionMap = makeCombatActionMap(INITIAL_STATE.player);
const attackToDeath = (state, seed = 1) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn ?? 0, seed, now: NOW },
});
const itemToDeath = (state) => actionMap.USE_COMBAT_ITEM(state, {
    type: AT.USE_COMBAT_ITEM,
    payload: { itemId: potion.id, expectedTurn: 0, seed: 1, now: NOW },
});

test('패배 전이는 쓰러뜨린 적의 표시 이름과 그 순간 남은 생명 %를 기록에 남긴다 — 공격 턴 · 소모품 턴 모두', () => {
    for (const [label, settle] of [['공격', attackToDeath], ['소모품', itemToDeath]]) {
        const next = settle(makeState());
        assert.equal(next.gameState, 'dead', label);
        assert.equal(next.runSummary.killer?.name, ENEMY_NAME, `${label}: 쓰러뜨린 적`);
        const hp = next.runSummary.killer?.hpPercent;
        // 방어력 999,999라 이번 턴 피해는 아주 작다 — 50/100에서 1 ~ 2 깎인 값의 올림.
        assert.ok(Number.isInteger(hp) && hp >= 45 && hp <= 50, `${label}: 남은 생명 % (${hp})`);
    }
});

test('쓰러뜨린 적이 거의 죽었어도 0%로 보이지 않는다 — 살아 있으면 1% 이상', () => {
    const next = attackToDeath(makeState({ enemy: { hp: 3, maxHp: 1_000_000 } }));
    assert.equal(next.runSummary.killer.hpPercent, 1);
});

test('이번 여정에 모은 계승 정수 = 누적 정수 − 여정 시작 기준점, 새 여정은 지금 누적 정수를 기준점으로 연다', () => {
    const base = structuredClone(INITIAL_STATE.player.stats.currentRun);
    const next = attackToDeath(makeState({
        meta: { essence: 120, essenceLifetime: 1_540 },
        stats: { currentRun: { ...base, essenceAtStart: 300 } },
    }));
    assert.equal(next.runSummary.essenceGained, 1_240);
    assert.equal(next.player.stats.currentRun.essenceAtStart, 1_540, '사망 재시작의 기준점');
    assert.equal(getJourneyEssenceGain(next.player), 0, '새 여정은 0부터 센다');
});

test('기준점이 없는 이전 세이브는 모은 계승 정수를 지어내지 않는다(null)', () => {
    const { essenceAtStart: _drop, ...legacyRun } = structuredClone(INITIAL_STATE.player.stats.currentRun);
    const next = attackToDeath(makeState({ meta: { essenceLifetime: 900 }, stats: { currentRun: legacyRun } }));
    assert.equal(next.runSummary.essenceGained, null);
});

test('이번 회차 최고 레벨: 사망마다 더 높은 레벨만 남고, 기록 화면은 그 사망 전의 최고를 말한다', () => {
    const first = attackToDeath(makeState({ player: { level: 9 }, meta: { prestigeRank: 2 } }));
    assert.equal(first.runSummary.previousBestLevel, null, '이번 회차 첫 사망');
    assert.deepEqual(first.player.meta.cycleBestLevel, { rank: 2, level: 9 });

    const lower = attackToDeath(makeState({ player: { level: 5 }, meta: { ...first.player.meta } }));
    assert.equal(lower.runSummary.previousBestLevel, 9);
    assert.deepEqual(lower.player.meta.cycleBestLevel, { rank: 2, level: 9 }, '낮은 레벨 사망은 최고를 내리지 않는다');

    const higher = attackToDeath(makeState({ player: { level: 14 }, meta: { ...lower.player.meta } }));
    assert.equal(higher.runSummary.previousBestLevel, 9);
    assert.deepEqual(higher.player.meta.cycleBestLevel, { rank: 2, level: 14 });
});

test('다른 계승 단계의 최고 레벨 기록은 없는 것으로 읽고, 계승은 기록을 지우며 남기지 않는다', () => {
    const stale = { prestigeRank: 3, cycleBestLevel: { rank: 2, level: 40 } };
    assert.equal(getCycleBestLevel(stale), null);
    assert.deepEqual(recordCycleBestLevel(stale, 6), { rank: 3, level: 6 }, '지금 단계로 0부터 센다');

    const player = { ...structuredClone(INITIAL_STATE.player), level: 30, meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 3, cycleBestLevel: { rank: 3, level: 20 } } };
    assert.deepEqual(pickPermanentPlayerState(player, INITIAL_STATE.player, 'death').meta.cycleBestLevel, { rank: 3, level: 30 });
    assert.deepEqual(pickPermanentPlayerState(player, INITIAL_STATE.player, 'ascension').meta.cycleBestLevel, { rank: 3, level: 20 }, '계승은 기록하지 않는다');
    assert.equal('cycleBestLevel' in getAscensionOutcome(player.meta).meta, false, '계승한 회차는 기록 없이 시작한다');
});

test('다시 시작(RESET_GAME)도 여정을 끝낸 것이라 최고 레벨을 남기고 계승 정수 기준점을 연다', () => {
    const state = makeState({ player: { level: 12 }, meta: { prestigeRank: 1, essenceLifetime: 777 } });
    const next = gameReducer({ ...state, gameState: 'idle', enemy: null }, { type: AT.RESET_GAME });
    assert.deepEqual(next.player.meta.cycleBestLevel, { rank: 1, level: 12 });
    assert.equal(next.player.stats.currentRun.essenceAtStart, 777);
});

const levelUpOnce = (level, meta) => {
    const player = { ...structuredClone(INITIAL_STATE.player), level, exp: 0, nextExp: 100, meta: { ...structuredClone(INITIAL_STATE.player.meta), ...meta } };
    return CombatEngine.applyExpGain(player, 100).logs.map((log) => log.text);
};

test('다시 오르는 레벨업 기록: 최고 레벨까지 남은 레벨 · 다시 닿음 · 넘음을 한 줄씩 남긴다', () => {
    const meta = { prestigeRank: 0, cycleBestLevel: { rank: 0, level: 6 } };
    assert.ok(levelUpOnce(3, meta).includes(MSG.CYCLE_BEST_LEVEL_CLIMB(4, 6)));
    assert.ok(levelUpOnce(5, meta).includes(MSG.CYCLE_BEST_LEVEL_CLIMB(6, 6)));
    assert.match(MSG.CYCLE_BEST_LEVEL_CLIMB(6, 6), /다시 닿았습니다/u);
    const passed = levelUpOnce(6, meta);
    assert.ok(passed.includes(MSG.CYCLE_BEST_LEVEL_PASSED(6)));
    assert.equal(passed.some((text) => text === MSG.CYCLE_BEST_LEVEL_CLIMB(7, 6)), false);
    assert.equal(levelUpOnce(9, meta).some((text) => text.includes('이번 회차 최고 레벨')), false, '이미 넘은 뒤에는 말하지 않는다');
});

test('최고 레벨 기록이 없거나 다른 계승 단계의 기록이면 레벨업 기록은 그대로다', () => {
    const plain = levelUpOnce(3, { prestigeRank: 0 });
    const stale = levelUpOnce(3, { prestigeRank: 1, cycleBestLevel: { rank: 0, level: 30 } });
    for (const logs of [plain, stale]) {
        assert.equal(logs.some((text) => text.includes('이번 회차 최고 레벨')), false);
    }
});

const summary = (overrides = {}) => ({
    level: 17, job: '전사', loc: '고요한 숲', kills: 42, bossKills: 1, relicsFound: 3, totalGold: 2_400,
    prestigeRank: 1, activeTitle: null, primaryBuild: '균형', difficultyLabel: '보통', recentWinRate: 70,
    escapes: 0, discoveries: 2, maxKillStreak: 4, signaturesAcquired: 0, signatureNames: [], runTrackingComplete: true,
    killer: { name: ENEMY_NAME, hpPercent: 38 }, essenceGained: 1_240, previousBestLevel: 21,
    ...overrides,
});

test('사망 화면: 쓰러뜨린 적 · 남은 생명 · 이번 회차 최고 레벨 · 모은 계승 정수 · 거울 단추를 그린다', () => {
    const html = renderStatic(createElement(RunSummaryCard, { runSummary: summary(), essence: 2_000, onOpenMirror: () => {} }));
    assert.ok(html.includes('data-testid="run-summary-killed-by"'));
    assert.ok(html.includes(ENEMY_NAME));
    assert.ok(html.includes(MSG.RUN_SUMMARY_KILLER_HP(38)));
    assert.ok(html.includes(MSG.RUN_SUMMARY_BEST_LEVEL(21, 17)));
    assert.ok(html.includes(MSG.RUN_SUMMARY_ESSENCE_GAINED(1_240)));
    assert.ok(html.includes(MSG.RUN_SUMMARY_ESSENCE_HELD(2_000)));
    const mirror = html.match(/<button[^>]*data-testid="run-summary-open-mirror"[^>]*>/u)?.[0];
    assert.ok(mirror, '에테르 거울 단추');
    assert.match(mirror, /min-h-11/u, '터치 영역 44px');
    assert.ok(html.includes(MSG.MIRROR_CTA_LABEL));

    const record = renderStatic(createElement(RunSummaryCard, { runSummary: summary({ level: 25 }) }));
    assert.ok(record.includes(MSG.RUN_SUMMARY_BEST_LEVEL_NEW(21)), '최고 레벨을 넘은 여정');
    assert.ok(!record.includes('run-summary-open-mirror'), '거울을 열 곳이 없으면 단추를 그리지 않는다');
});

test('사망 화면: 기록이 없는 값(이전 세이브 · 전투가 아닌 종료)은 그 줄을 그리지 않는다', () => {
    const html = renderStatic(createElement(RunSummaryCard, {
        runSummary: summary({ killer: null, essenceGained: null, previousBestLevel: null }),
    }));
    for (const testId of ['run-summary-killed-by', 'run-summary-best-level', 'run-summary-essence']) {
        assert.ok(!html.includes(`data-testid="${testId}"`), testId);
    }
    const unknownHp = renderStatic(createElement(RunSummaryCard, { runSummary: summary({ killer: { name: ENEMY_NAME, hpPercent: null } }) }));
    assert.ok(unknownHp.includes('run-summary-killed-by') && !unknownHp.includes('run-summary-killer-hp'));
});

test('사망 화면은 기록 카드 전에 짧은 순간을 먼저 그린다 — 누르면 넘어가는 단추이고 쓰러뜨린 적을 말한다', () => {
    const props = {
        runSummary: summary(), storyBeat: null, player: structuredClone(INITIAL_STATE.player), mirrorOpen: false,
        onOpenMirror: () => {}, onCloseMirror: () => {}, onPurchaseMirror: () => {}, onRestart: () => {},
    };
    const html = renderStatic(createElement(DeathScreen, props));
    assert.match(html, /<button[^>]*data-testid="death-beat"/u);
    assert.ok(html.includes(MSG.DEATH_BEAT_KILLED_BY(ENEMY_NAME)));
    assert.ok(html.includes(MSG.DEATH_BEAT_SKIP));
    assert.ok(!html.includes('run-summary-card'), '짧은 순간 동안 기록 카드는 아직 없다');

    const noKiller = renderStatic(createElement(DeathScreen, { ...props, runSummary: summary({ killer: null }) }));
    assert.ok(noKiller.includes(MSG.DEATH_BEAT_TITLE));
});

// 계승 화면 — 영구 능력치 정산표(지금 · 내려놓는 몫 · 계승 보상 · 다음 여정)와 회차 규칙 카드의 위치.
const veteran = () => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '수집가', job: '전사', level: 50, hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: {
        ...structuredClone(INITIAL_STATE.player.meta),
        prestigeRank: 0, rank: 600, essence: 180, bonusAtk: 600, bonusHp: 3_000, bonusMp: 1_800,
        endgame: { lastEndgameReceiptKey: 'rk-growth' },
    },
});

test('계승 정산표: 다음 여정 값 = 지금 − 내려놓는 몫 + 계승 보상, 다음 여정 값은 계승이 실제로 만드는 meta와 같다', () => {
    const outcome = getAscensionOutcome(veteran().meta);
    const byStat = Object.fromEntries(outcome.growth.map((row) => [row.stat, row]));
    assert.deepEqual(Object.keys(byStat), ['atk', 'hp', 'mp', 'essence']);
    for (const row of outcome.growth) {
        assert.equal(row.before - row.dropped + row.reward, row.after, row.stat);
        assert.ok(row.dropped >= 0 && row.reward >= 0, row.stat);
    }
    assert.equal(byStat.atk.after, outcome.meta.bonusAtk);
    assert.equal(byStat.hp.after, outcome.meta.bonusHp);
    assert.equal(byStat.mp.after, outcome.meta.bonusMp);
    assert.equal(byStat.essence.after, outcome.meta.essence);
    assert.ok(byStat.atk.dropped > 0, '넘어가지 않는 정수 사다리는 내려놓는 몫으로 보인다');
    assert.equal(byStat.essence.dropped, 0, '계승 정수는 그대로다');
});

test('계승 화면: 정산표를 칸마다 그리고, 회차 규칙 카드는 정산표보다 먼저, 확인 단추 위에 고른 카드를 말한다', () => {
    const player = veteran();
    const html = renderStatic(createElement(AscensionScreen, { player }));
    const atkRow = getAscensionOutcome(player.meta).growth.find((row) => row.stat === 'atk');
    assert.ok(html.includes('data-testid="ascension-growth-table"'));
    assert.ok(html.includes(MSG.ASCEND_GROWTH_TITLE));
    for (const label of Object.values(MSG.ASCEND_GROWTH_COLUMNS)) assert.ok(html.includes(label), label);
    const atkHtml = html.match(/<tr[^>]*data-testid="ascension-growth-atk"[\s\S]*?<\/tr>/u)?.[0] ?? '';
    assert.ok(atkHtml.includes(`+${atkRow.before}`) && atkHtml.includes(`−${atkRow.dropped}`) && atkHtml.includes(`+${atkRow.after}`));

    const offerAt = html.indexOf('data-testid="ascension-rule-offer"');
    assert.ok(offerAt > 0, '회차 규칙 카드');
    assert.ok(offerAt < html.indexOf('data-testid="ascension-permanent-growth"'), '카드가 정산표보다 먼저');
    const selectedAt = html.indexOf('data-testid="ascension-selected-rule"');
    assert.ok(selectedAt > 0 && selectedAt < html.indexOf('data-testid="ascension-confirm"'), '확인 단추 바로 위에 고른 카드');
    const view = getAscensionRuleOfferView(player, 1);
    const defaultCard = view.cards.find((card) => card.id === view.defaultId);
    assert.ok(defaultCard && html.includes(MSG.ASCENSION_RULE_NEXT(defaultCard.name)), '처음 골라 둔 카드는 가장 가벼운 카드 그대로');
});
