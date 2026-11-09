/**
 * 2026-11 디자인 고도화 A6 — 선택 화면 하나의 문법(`src/components/ui/ChoiceCard.tsx`).
 *
 * 유물 선택 · 이벤트 선택지(정찰 포함) · 회차 규칙 카드 · 기술 분기가 같은 카드를 그린다:
 *   아이콘 · 계열 빛 · 이름 · 효과 한 줄 · 덧붙는 줄 · 대가 한 줄. 줄 카드(`row`)는 세로 목록, 칸 카드(`tile`)는 2 ~ 3열이다.
 *
 * 이벤트 영향 점(소유자 결정 Q3)은 무엇이 걸렸는지만 말한다 — 방향 · 크기 · 색은 말하지 않고,
 * 결과를 숨기는 폴백 이벤트에서는 점도 숨긴다(이기는 칸만 골드 점을 들면 숨긴 결과가 드러난다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { RELICS } from '../src/data/relics.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { STRUCTURED_FALLBACK_HIDDEN_EVENTS } from '../src/data/structuredFallbackEvents.ts';
import { getAscensionRuleOfferView } from '../src/utils/ascensionRuleView.ts';
import { EVENT_STAKE_ORDER, getEventChoiceStakes } from '../src/utils/eventPresentation.ts';
import { buildScoutEvent } from '../src/utils/scoutEvents.ts';
import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import EventPanel from '../src/components/EventPanel.tsx';
import ChallengeModifierPicker from '../src/components/ChallengeModifierPicker.tsx';
import SkillTreePreview from '../src/components/SkillTreePreview.tsx';
import { makePlayerFixture, renderStatic, sliceElementByTestId } from './helpers/render.ts';

const ACTIONS = { handleEventChoice: () => {}, dismissEvent: () => {} };
const openTag = (html, testId) => {
    const match = html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`, 'u'));
    assert.ok(match, `${testId} 렌더`);
    return match[0];
};
const renderEvent = (currentEvent) => renderStatic(createElement(EventPanel, { currentEvent, actions: ACTIONS, location: '고요한 숲' }));

test('네 화면의 선택지가 모두 선택 카드이고, 목록 화면은 줄 카드 · 격자 화면은 칸 카드다', () => {
    const relicHtml = renderStatic(createElement(RelicChoicePanel, {
        pendingRelics: RELICS.slice(0, 3), dispatch: () => {}, player: makePlayerFixture({ relics: [] }), stats: null,
    }));
    for (const index of [0, 1, 2]) {
        const tag = openTag(relicHtml, `relic-choice-${index}`);
        assert.match(tag, /\bae-choice-card\b/u);
        assert.match(tag, /data-choice-layout="row"/u);
        assert.match(tag, /data-choice-stack="lg"/u, '세 열 배치에서는 아이콘을 위로 쌓는다');
    }
    assert.equal((relicHtml.match(/data-choice-emphasis="recommended"/gu) || []).length, 1, '추천 강조는 한 장');

    const eventHtml = renderEvent({ desc: '갈림길', choices: ['왼쪽', '오른쪽'], outcomes: [{ choiceIndex: 0, hp: 10 }, { choiceIndex: 1, gold: 5 }] });
    for (const index of [0, 1]) assert.match(openTag(eventHtml, `event-choice-${index}`), /data-choice-layout="row"/u);

    const scoutHtml = renderEvent(buildScoutEvent(makePlayerFixture(), DB.MAPS['고요한 숲'], () => 0.99));
    assert.match(openTag(scoutHtml, 'event-choice-0'), /\bae-choice-card\b/u, '정찰 3택도 같은 카드');

    const base = makePlayerFixture();
    const veteran = makePlayerFixture({ level: 50, meta: { ...base.meta, prestigeRank: 0, endgame: { lastEndgameReceiptKey: 'a6-probe' } } });
    const offer = getAscensionRuleOfferView(veteran, 1);
    assert.ok(offer.cards.length > 1, '패가 여러 장');
    {
        const ruleHtml = renderStatic(createElement(ChallengeModifierPicker, {
            testIdPrefix: 'probe', selected: [], slots: 3, onToggle: () => {}, rule: offer.cards[0], ruleOffer: offer.cards, onSelectRule: () => {},
        }));
        for (const card of offer.cards) {
            const tag = openTag(ruleHtml, `probe-rule-card-${card.id}`);
            assert.match(tag, /data-choice-layout="tile"/u);
            assert.match(tag, card.id === offer.cards[0].id ? /data-choice-emphasis="selected"/u : /^(?![\s\S]*data-choice-emphasis)/u);
        }
    }

    const entry = Object.entries(DB.CLASSES).find(([, cls]) => Object.keys(cls.skillBranches || {}).length >= 1);
    const skillHtml = renderStatic(createElement(SkillTreePreview, {
        player: makePlayerFixture({ job: entry[0], level: 60, skillChoices: {} }), actions: { chooseSkillBranch: () => {} },
    }));
    const branchButtons = skillHtml.match(/<button[^>]*data-testid="skill-branch-choice-[^"]+"[^>]*>/gu) || [];
    assert.ok(branchButtons.length >= 2, '기술 분기 카드');
    for (const tag of branchButtons) assert.match(tag, /\bae-choice-card\b[\s\S]*data-choice-layout="tile"|data-choice-layout="tile"[\s\S]*\bae-choice-card\b/u);
});

test('영향 점은 방향 · 크기를 말하지 않는다 — 회복과 손실이 같은 점이고 순서는 하나다', () => {
    const heal = { desc: 'a', choices: ['x'], outcomes: [{ choiceIndex: 0, hp: 40 }] };
    const hurt = { desc: 'a', choices: ['x'], outcomes: [{ choiceIndex: 0, hp: -3 }] };
    assert.deepEqual(getEventChoiceStakes(heal, 0), ['hp']);
    assert.deepEqual(getEventChoiceStakes(hurt, 0), getEventChoiceStakes(heal, 0));

    const mixed = { desc: 'a', choices: ['x'], outcomes: [{ choiceIndex: 0, status: { id: 'poison' }, gold: 30, elite: true, hp: -5, relic: {} }] };
    const stakes = getEventChoiceStakes(mixed, 0);
    assert.deepEqual(stakes, EVENT_STAKE_ORDER.filter((stake) => stakes.includes(stake)), '정해진 순서');
    assert.deepEqual(stakes, ['combat', 'hp', 'gold', 'relic', 'status']);

    const chain = { _chainId: 'c', desc: 'a', choices: ['x', 'y'], outcomes: [{ reward: { type: 'combat_bonus' } }, { reward: null, type: 'nothing' }] };
    assert.deepEqual(getEventChoiceStakes(chain, 0), ['buff']);
    assert.deepEqual(getEventChoiceStakes(chain, 1), [], '걸린 것이 없으면 점도 없다');

    const html = renderEvent({ desc: 'b', choices: ['x', 'y'], outcomes: [{ choiceIndex: 0, hp: 40, gold: 120 }, { choiceIndex: 1 }] });
    const dots = sliceElementByTestId(html, 'event-choice-stakes-0');
    assert.ok(dots.includes(MSG.EVENT_STAKE_LABELS.hp) && dots.includes(MSG.EVENT_STAKE_LABELS.gold));
    assert.ok(!/\d/u.test(dots.replace(/<[^>]+>/gu, '')), '점에는 숫자(크기)가 없다');
    assert.ok(!/text-ae-(good|threat|gold)/u.test(dots), '점은 득실 색을 쓰지 않는다');
    assert.ok(!html.includes('event-choice-stakes-1'), '걸린 것이 없는 선택지는 점 줄이 없다');
});

test('결과를 숨기는 폴백 이벤트는 점도 숨긴다 — 모든 선택지가 같은 모양이다', () => {
    assert.ok(STRUCTURED_FALLBACK_HIDDEN_EVENTS.length > 0);
    for (const hidden of STRUCTURED_FALLBACK_HIDDEN_EVENTS) {
        const event = { ...hidden.event, source: 'fallback', choices: [...hidden.event.choices], outcomes: [...hidden.event.outcomes] };
        hidden.event.choices.forEach((_choice, index) => {
            assert.deepEqual(getEventChoiceStakes(event, index), [], `${hidden.id}: 선택 ${index}`);
        });
        assert.ok(!renderEvent(event).includes('event-choice-stakes-'), `${hidden.id}: 점 줄이 그려지지 않는다`);
    }
});
