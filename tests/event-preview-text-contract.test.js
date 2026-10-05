import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.js';
import { findStructuredFallbackHiddenEvent } from '../src/data/structuredFallbackEvents.js';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { buildEventPackage } from '../src/utils/aiEventUtils.js';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { buildBoundedEncounterEvent } from '../src/utils/boundedEncounterEvent.js';
import { formatEventText, getEventChoicePreview } from '../src/utils/eventPresentation.js';
import { applyPostCombatChoice, getPostCombatChoiceOptions } from '../src/utils/postCombatChoice.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 — 엔진은 맞는데 플레이어가 읽는 문구 · 미리보기가 틀리던 결함(B 묶음)의 행동 계약.
 *
 * E5  체인 `combat_bonus`의 버프 이름 · 로그는 그 체인의 것이다(셋 모두 '최후의 영웅 · 기사의 혼령'이었다).
 * E6  체인을 닫는 선택(`chain_advance_fail`)은 미리보기에서 이야기가 끝난다고 말한다.
 * E13 생명을 잃는 일반 사건 결과는 정예 · 상태이상 · 유물 · 버프 줄에서도 생명 손실을 말한다.
 * E18 "밀어붙인다" 설명은 모닥불 차단을 늘 말하고, 보스 게이지는 실제로 오를 때만 말한다.
 * U5  회복이 실효 최대치에서 멈추면 로그는 실제로 오른 양을 말한다.
 *
 * 전부 실제 모듈(데이터 · 액션 · 리듀서 · 미리보기 · 카드 렌더)을 호출해 결과를 단언한다 — 소스 정규식 없음.
 */

const clone = (value) => structuredClone(value);
const HP_LOSS_TEXT = '생명 손실 위험';

const basePlayer = (overrides = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '문구 검증',
    job: '모험가',
    level: 12,
    loc: '고요한 숲',
    ...overrides,
});

/** 실제 `handleEventChoice` → 실제 리듀서. 로그는 액션이 남긴 것과 리듀서가 남긴 것을 함께 모은다. */
const runEventChoice = (player, currentEvent, choiceIndex, rng = () => 0.5) => {
    let state = { ...clone(INITIAL_STATE), player, gameState: GS.EVENT, currentEvent, logs: [] };
    const logs = [];
    createEventActions({
        player: state.player,
        currentEvent: state.currentEvent,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => calculateFullStats(player),
        rng,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(choiceIndex);
    return { state, logs };
};

const chainEventFor = (chain, stepData) => ({ ...clone(stepData.event), _chainId: chain.id, _chainStep: stepData.step });

const chainOutcomes = () => EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((stepData) => (
    stepData.event.outcomes.map((outcome, choiceIndex) => ({ chain, stepData, outcome, choiceIndex }))
)));

// ── E5 ────────────────────────────────────────────────────────────────────
test('E5: 체인 combat_bonus는 그 체인의 버프 이름과 로그 앞머리를 쓴다', () => {
    const bonuses = chainOutcomes().filter(({ outcome }) => outcome.reward?.type === 'combat_bonus');
    assert.ok(bonuses.length >= 3, '최후의 영웅 · 잊혀진 사령관 · 물의 사도');
    const names = new Set();
    for (const { chain, stepData, outcome, choiceIndex } of bonuses) {
        const reward = outcome.reward;
        assert.ok(reward.buffName && reward.buffIntro, `${chain.id}:${stepData.step} 데이터가 이름 · 앞머리를 선언한다`);
        const player = basePlayer({ loc: stepData.loc, eventChainProgress: { [chain.id]: stepData.step } });
        const { state, logs } = runEventChoice(player, chainEventFor(chain, stepData), choiceIndex);

        const pct = Math.round((reward.atkMult - 1) * 100);
        assert.equal(state.player.tempBuff.name, reward.buffName);
        assert.equal(state.player.tempBuff.turn, reward.duration);
        const bonusLog = logs.find((entry) => entry.type === 'success');
        assert.equal(bonusLog?.text, MSG.CHAIN_REWARD_COMBAT_BONUS(pct, reward.duration, reward.buffIntro));
        assert.ok(bonusLog.text.startsWith(reward.buffIntro));
        if (chain.id !== 'last_hero') {
            assert.doesNotMatch(bonusLog.text, /최후의 영웅/, `${chain.id}는 최후의 영웅을 말하지 않는다`);
            assert.notEqual(state.player.tempBuff.name, '기사의 혼령');
        }
        names.add(state.player.tempBuff.name);
    }
    assert.equal(names.size, bonuses.length, '체인마다 버프 이름이 다르다');

    // 최후의 영웅의 문장은 그대로다.
    const lastHero = bonuses.find(({ chain }) => chain.id === 'last_hero');
    const { logs } = runEventChoice(
        basePlayer({ loc: lastHero.stepData.loc, eventChainProgress: { last_hero: lastHero.stepData.step } }),
        chainEventFor(lastHero.chain, lastHero.stepData),
        lastHero.choiceIndex,
    );
    assert.equal(logs.find((entry) => entry.type === 'success').text, '최후의 영웅이 합류해 5턴 동안 공격력이 30% 오릅니다.');
});

test('E5: 이름 · 앞머리가 없는 combat_bonus는 특정 체인이 아니라 일반 문구를 쓴다', () => {
    const event = {
        _chainId: 'last_hero',
        _chainStep: 2,
        title: '검증',
        desc: '검증용 체인 이벤트',
        choices: ['받는다', '거절한다'],
        outcomes: [
            { type: 'chain_advance', log: '힘이 깃듭니다.', reward: { type: 'combat_bonus', atkMult: 1.2, duration: 4 } },
            { type: 'nothing', log: '거절했습니다.', reward: null },
        ],
    };
    const { state, logs } = runEventChoice(basePlayer({ eventChainProgress: { last_hero: 2 } }), event, 0);
    assert.equal(state.player.tempBuff.name, MSG.CHAIN_REWARD_COMBAT_BONUS_NAME);
    assert.notEqual(MSG.CHAIN_REWARD_COMBAT_BONUS_NAME, '기사의 혼령');
    const text = logs.find((entry) => entry.type === 'success').text;
    assert.equal(text, MSG.CHAIN_REWARD_COMBAT_BONUS(20, 4));
    assert.doesNotMatch(text, /최후의 영웅/);
});

// ── E6 ────────────────────────────────────────────────────────────────────
test('E6: 체인을 닫는 모든 선택은 미리보기에서 이야기가 끝난다고 말하고, 남는 보상만 덧붙인다', () => {
    const failures = chainOutcomes().filter(({ outcome }) => outcome.type === 'chain_advance_fail');
    assert.ok(failures.length > 0);
    let rewarded = 0;
    for (const { chain, stepData, outcome, choiceIndex } of failures) {
        const label = `${chain.id}:${stepData.step}:${choiceIndex}`;
        const preview = getEventChoicePreview(chainEventFor(chain, stepData), choiceIndex);
        assert.equal(preview.tone, 'danger', label);
        assert.ok(preview.text.startsWith(MSG.CHAIN_PREVIEW_ENDS), `${label}: ${preview.text}`);
        assert.ok(!preview.text.includes(MSG.CHAIN_PREVIEW_PROGRESS), `${label}는 "이야기 진행"이 아니다`);
        if (outcome.reward?.type === 'gold') {
            rewarded += 1;
            assert.equal(preview.text, `${MSG.CHAIN_PREVIEW_ENDS} · 골드 보상`, label);
        } else {
            assert.equal(preview.text, MSG.CHAIN_PREVIEW_ENDS, label);
        }

        // 미리보기가 말한 대로 실제 선택이 체인을 닫는다.
        const player = basePlayer({ loc: stepData.loc, gold: 10_000, eventChainProgress: { [chain.id]: stepData.step } });
        const { state } = runEventChoice(player, chainEventFor(chain, stepData), choiceIndex);
        assert.equal(state.player.eventChainProgress[chain.id], 'failed', label);
    }
    assert.ok(rewarded > 0, '골드를 주는 실패 선택도 표본에 있다');

    // 대조: 체인을 이어 가는 선택은 끝맺음을 말하지 않는다.
    for (const { chain, stepData, outcome, choiceIndex } of chainOutcomes()) {
        if (outcome.type === 'chain_advance_fail') continue;
        const preview = getEventChoicePreview(chainEventFor(chain, stepData), choiceIndex);
        assert.ok(!preview.text.includes(MSG.CHAIN_PREVIEW_ENDS), `${chain.id}:${stepData.step}:${choiceIndex}`);
    }
});

// ── E13 ───────────────────────────────────────────────────────────────────
test('E13: 생명을 잃는 폴백 풀 결과는 어느 줄로 미리보든 생명 손실을 말한다', () => {
    const locations = Object.keys(DB.MAPS);
    const snapshots = [
        { level: 12, maxHp: 300, maxMp: 120, hp: 280 },
        { level: 30, maxHp: 900, maxMp: 300, hp: 120 },
    ];
    let lossCount = 0;
    let specialLossCount = 0;
    let checked = 0;
    for (const entries of Object.values(FALLBACK_EVENT_POOL)) {
        for (const entry of entries) {
            for (const location of locations) {
                for (const playerSnapshot of snapshots) {
                    const pkg = buildEventPackage(
                        { ...entry, source: 'fallback' },
                        { location, source: 'fallback', playerSnapshot },
                    );
                    assert.ok(pkg, entry.desc);
                    const event = { ...pkg, fallbackTransactionId: entry.fallbackTransactionId };
                    // 2026-10 Wave 62 C18: 결과를 숨기는 폴백 이벤트(카드 · 크리스탈 · 암호 상자)는 선택지마다 결과를 읽지 않는다 —
                    //   어느 칸이든 생명을 잃을 수 있으면 **모든** 선택지가 생명 손실을 말한다(어느 선택지인지는 말하지 않는다).
                    const hidden = findStructuredFallbackHiddenEvent(event);
                    if (hidden) {
                        const anyLoss = hidden.event.outcomes.some((slot) => slot.hp < 0);
                        for (const outcome of pkg.outcomes) {
                            checked += 1;
                            if (outcome.hp < 0) lossCount += 1;
                            const preview = getEventChoicePreview(event, outcome.choiceIndex);
                            assert.equal(preview.text.includes(HP_LOSS_TEXT), anyLoss, `${entry.desc} #${outcome.choiceIndex} → ${preview.text}`);
                            if (anyLoss) assert.equal(preview.tone, 'danger');
                        }
                        continue;
                    }
                    for (const outcome of pkg.outcomes) {
                        checked += 1;
                        const preview = getEventChoicePreview(event, outcome.choiceIndex);
                        if (outcome.hp < 0) {
                            lossCount += 1;
                            if (outcome.elite || outcome.status || outcome.relic || outcome.buff) specialLossCount += 1;
                            assert.ok(preview.text.includes(HP_LOSS_TEXT), `${entry.desc} #${outcome.choiceIndex} → ${preview.text}`);
                            assert.equal(preview.tone, 'danger');
                        } else {
                            assert.ok(!preview.text.includes(HP_LOSS_TEXT), `${entry.desc} #${outcome.choiceIndex} → ${preview.text}`);
                        }
                    }
                }
            }
        }
    }
    assert.ok(checked > 1000);
    assert.ok(lossCount > 0);
    assert.ok(specialLossCount > 0, '정예 · 상태이상 · 유물 · 버프와 생명 손실이 겹치는 결과가 표본에 있다');
});

test('E13: 기력만 잃는 결과는 생명 손실이 아니라 기력 손실을 말한다', () => {
    const event = { choices: ['a', 'b'], outcomes: [{ choiceIndex: 0, mp: -10 }, { choiceIndex: 1, mp: -10, gold: 30 }] };
    assert.deepEqual(getEventChoicePreview(event, 0), { text: MSG.EVENT_PREVIEW_MP_LOSS, tone: 'danger' });
    assert.ok(!getEventChoicePreview(event, 1).text.includes(HP_LOSS_TEXT));
});

// ── E18 ───────────────────────────────────────────────────────────────────
test('E18: "밀어붙인다" 설명은 모닥불 차단을 늘 말하고, 게이지는 실제로 오를 때만 말한다', () => {
    const pct = Math.round(BALANCE.POST_COMBAT_PUSH_ATK_BONUS * 100);
    const turns = BALANCE.POST_COMBAT_PUSH_TURNS;
    const withGauge = MSG.POST_COMBAT_PUSH_DETAIL(pct, turns, true);
    const withoutGauge = MSG.POST_COMBAT_PUSH_DETAIL(pct, turns, false);
    assert.notEqual(withGauge, withoutGauge);
    assert.match(withGauge, /보스/);
    assert.doesNotMatch(withoutGauge, /보스/);
    assert.match(withoutGauge, /모닥불/);

    let undefeatedCases = 0;
    let defeatedCases = 0;
    for (const [loc, map] of Object.entries(DB.MAPS)) {
        const variants = [{}];
        if (typeof map.boss === 'string') variants.push({ areaBossDefeated: { [map.boss]: true } });
        for (const statsOverride of variants) {
            const player = basePlayer({ loc, stats: { ...clone(INITIAL_STATE.player.stats), ...statsOverride } });
            const detail = getPostCombatChoiceOptions(player).find((option) => option.id === 'push').detail;
            const applied = applyPostCombatChoice(player, 'push', map, 100);
            const gaugeAdvanced = applied.logs.some((log) => log.text === MSG.POST_COMBAT_PUSH_GAUGE_LOG);
            assert.equal(detail, gaugeAdvanced ? withGauge : withoutGauge, `${loc} ${JSON.stringify(statsOverride)}`);
            assert.equal(applied.player.stats.nextExploreCampfireBlocked, true, '모닥불 차단은 늘 일어난다');
            if (typeof map.boss === 'string') {
                if (statsOverride.areaBossDefeated) defeatedCases += 1;
                else undefeatedCases += 1;
            }
        }
    }
    assert.ok(undefeatedCases > 0 && defeatedCases > 0);
    // 플레이어를 모르면 게이지를 약속하지 않는다.
    assert.equal(getPostCombatChoiceOptions().find((option) => option.id === 'push').detail, withoutGauge);
});

test('E18: 카드는 현재 플레이어 기준 설명을 그린다', () => {
    const result = { enemy: '하수도 쥐', enemyTier: 'NORMAL', isBoss: false, exp: 10, gold: 5, items: [], playerHp: 60, playerMaxHp: 100 };
    const render = (player) => renderStatic(createElement(PostCombatCard, { result, player, onResolveChoice: () => {} }));
    const pct = Math.round(BALANCE.POST_COMBAT_PUSH_ATK_BONUS * 100);
    const turns = BALANCE.POST_COMBAT_PUSH_TURNS;
    const undefeated = basePlayer({ loc: '고대 하수도' });
    const defeated = basePlayer({
        loc: '고대 하수도',
        stats: { ...clone(INITIAL_STATE.player.stats), areaBossDefeated: { [DB.MAPS['고대 하수도'].boss]: true } },
    });
    assert.ok(render(undefeated).includes(MSG.POST_COMBAT_PUSH_DETAIL(pct, turns, true)));
    const defeatedHtml = render(defeated);
    assert.ok(defeatedHtml.includes(MSG.POST_COMBAT_PUSH_DETAIL(pct, turns, false)));
    assert.ok(!defeatedHtml.includes(MSG.POST_COMBAT_PUSH_DETAIL(pct, turns, true)));
});

// ── U5 ────────────────────────────────────────────────────────────────────
test('U5: 모닥불 휴식이 상한에 걸리면 로그는 실제로 오른 양을 말한다', () => {
    const player = basePlayer();
    const full = calculateFullStats(player);
    const event = buildCampfireEvent(full);
    const rest = event.outcomes[0];
    assert.ok(rest.hp > 7 && rest.mp > 3, '표본은 회복량이 남은 생명보다 크다');

    const capped = runEventChoice({ ...player, hp: full.maxHp - 7, mp: full.maxMp - 3 }, event, 0);
    assert.equal(capped.state.player.hp, full.maxHp);
    assert.equal(capped.state.player.mp, full.maxMp);
    assert.deepEqual(capped.logs.filter((entry) => entry.type === 'event').map((entry) => entry.text), [MSG.CAMPFIRE_REST_LOG(7, 3)]);

    // 상한에 닿지 않으면 문구는 그대로다.
    const open = runEventChoice({ ...player, hp: 1, mp: 0 }, event, 0);
    assert.deepEqual(open.logs.filter((entry) => entry.type === 'event').map((entry) => entry.text), [rest.log]);
});

test('U5: 회복 수치를 적은 폴백 사건 결과는 상한에 걸리면 실제 회복량을 적는다', () => {
    const player = basePlayer();
    const full = calculateFullStats(player);
    const healers = Object.values(FALLBACK_EVENT_POOL).flat().flatMap((entry) => (entry.outcomes || [])
        .filter((outcome) => (outcome.hp > 0 || outcome.mp > 0)
            && ((outcome.hp > 0 && formatEventText(outcome.log).includes(`생명 +${outcome.hp}`))
                || (outcome.mp > 0 && formatEventText(outcome.log).includes(`기력 +${outcome.mp}`))))
        .map((outcome) => ({ entry, outcome })));
    assert.ok(healers.length > 0, '회복량을 문구에 적은 폴백 결과가 있다');

    for (const { entry, outcome } of healers) {
        const pkg = buildEventPackage({ ...entry, source: 'fallback' }, { location: player.loc, source: 'fallback' });
        const missing = { hp: 7, mp: 3 };
        // Wave 62 C18: 숨김 이벤트(크리스탈)는 판마다 칸을 섞는다 — 난수 0은 배치 0(칸 i = 선택지 i)이라 이 결과 칸이 나온다.
        const capped = runEventChoice({ ...player, hp: full.maxHp - missing.hp, mp: full.maxMp - missing.mp }, pkg, outcome.choiceIndex, () => 0);
        const text = capped.logs.find((entry) => entry.type === 'event').text;
        for (const [key, label] of [['hp', '생명'], ['mp', '기력']]) {
            if (!(outcome[key] > 0)) continue;
            assert.ok(text.includes(`${label} +${missing[key]}`), `${entry.desc}: ${text}`);
            assert.ok(!text.includes(`${label} +${outcome[key]}`), `${entry.desc}: ${text}`);
        }
        assert.equal(capped.state.player.history.at(-1).outcome, text, '기록도 같은 문장이다');
    }
});

test('U5: 한정 조우의 회복이 상한에 걸리면 결과 줄이 실제 회복량을 말한다 (리듀서 경로)', () => {
    const healChoices = BOUNDED_ENCOUNTERS.flatMap((encounter) => encounter.choices
        .filter((choice) => choice.outcome.hp > 0)
        .map((choice) => ({ encounter, choice })));
    assert.ok(healChoices.length > 0);

    for (const { encounter, choice } of healChoices) {
        const resolveWith = (hp) => {
            const player = basePlayer({
                loc: encounter.region,
                mp: 999,
                maxMp: 999,
                stats: { ...clone(INITIAL_STATE.player.stats), explores: 1 },
                activeExpedition: { id: 'expedition-u5', explores: 0 },
            });
            const full = calculateFullStats(player);
            const withHp = { ...player, hp: hp(full.maxHp) };
            const state = {
                ...clone(INITIAL_STATE),
                player: withHp,
                gameState: GS.EVENT,
                currentEvent: buildBoundedEncounterEvent(encounter, withHp.stats.explores),
                logs: [],
            };
            const next = gameReducer(state, {
                type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
                payload: {
                    encounterId: state.currentEvent.boundedEncounterId,
                    choiceId: choice.id,
                    expeditionId: withHp.activeExpedition.id,
                    occurrenceSequence: state.currentEvent.boundedOccurrenceSequence,
                },
            });
            return { full, before: withHp, next };
        };

        const capped = resolveWith((maxHp) => maxHp - 5);
        assert.equal(capped.next.player.hp, capped.full.maxHp, encounter.id);
        assert.equal(capped.next.logs.at(-1).text, MSG.EVENT_RECOVERY_CAPPED({ hp: 5 }), encounter.id);
        assert.ok(!capped.next.logs.at(-1).text.includes(String(choice.outcome.hp)), encounter.id);

        const open = resolveWith(() => 1);
        assert.equal(open.next.player.hp, 1 - (choice.cost?.hp || 0) + choice.outcome.hp, encounter.id);
        assert.equal(open.next.logs.at(-1).text, choice.outcome.result, '상한에 닿지 않으면 데이터 문구 그대로');
    }
});
