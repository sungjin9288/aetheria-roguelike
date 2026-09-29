import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { MSG } from '../src/data/messages.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 32 (소유자 결정 "현상수배 제한 완화").
 *
 * 카탈로그 임무는 계정당 1회라(Q8 유지) 계승 뒤 런의 게시판 수입이 17 → 1 → 1 → 0이었다(원장 §31.2). 남는 반복
 * 콘텐츠는 현상수배 하나였는데 그마저 하루 1회였다. 이제 규칙은 "진행 중인 현상수배는 하나, 완료하면 바로 다음"이다.
 * 보상은 여전히 레벨 × 처치 수 비례이고 고정 보상 재지급은 없다.
 */

const REQUESTED_AT = Date.UTC(2026, 8, 29, 3, 0, 0);

const townState = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '현상금 사냥꾼',
        level: 12,
        loc: '시작의 마을',
        quests: [],
        ...overrides,
    },
});

const request = (state, seed = 0.25, requestedAt = REQUESTED_AT) => gameReducer(state, {
    type: AT.REQUEST_BOUNTY,
    payload: { requestedAt, seed },
});

const completeActiveBounty = (state) => {
    const bounty = state.player.quests.find((quest) => quest.isBounty);
    const done = { ...state, player: { ...state.player, quests: state.player.quests.map((quest) => (quest.isBounty ? { ...quest, progress: quest.goal } : quest)) } };
    return gameReducer(done, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: bounty.id } });
};

test('[연속] 같은 날 현상수배를 완료하면 바로 다음 현상수배를 받을 수 있다', () => {
    const first = request(townState());
    const firstBounty = first.player.quests.find((quest) => quest.isBounty);
    assert.ok(firstBounty, '비공허: 첫 현상수배가 발급됐다');

    const claimed = completeActiveBounty(first);
    assert.equal(claimed.player.quests.some((quest) => quest.isBounty), false, '비공허: 완료로 진행 중 현상수배가 비었다');
    assert.ok(claimed.player.gold > first.player.gold, '비공허: 보상이 지급됐다');

    const second = request(claimed, 0.75, REQUESTED_AT + 60_000);
    const secondBounty = second.player.quests.find((quest) => quest.isBounty);
    assert.ok(secondBounty, '같은 날 두 번째 현상수배가 발급된다');
    assert.notEqual(secondBounty.id, firstBounty.id);
    assert.equal(second.logs.slice(claimed.logs.length).some((log) => log.type === 'error'), false, '거부 로그가 없다');
});

test('[하나씩] 진행 중인 현상수배가 있으면 새로 발급하지 않는다(동일 참조)', () => {
    const first = request(townState());
    assert.strictEqual(request(first, 0.9, REQUESTED_AT + 60_000), first);
});

test('[마을] 현상수배는 여전히 안전지대에서만 발급된다', () => {
    const field = request(townState({ loc: '고요한 숲' }));
    assert.equal(field.player.quests.some((quest) => quest.isBounty), false);
    assert.equal(field.logs.at(-1)?.text, MSG.BOUNTY_TOWN_ONLY);
});

test('[표시] 오늘 이미 하나를 끝낸 게시판도 발급 버튼이 열려 있다', () => {
    const today = getProtocolDayKey(new Date());
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '현상금 사냥꾼',
        level: 12,
        loc: '시작의 마을',
        quests: [],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), bountyDate: today, bountyIssued: true },
    };
    const html = renderStatic(createElement(QuestBoardPanel, {
        player,
        actions: new Proxy({}, { get: () => () => {} }),
        setGameState: () => {},
        onOpenArchiveConsole: () => {},
    }));
    const section = html.slice(html.indexOf('data-testid="quest-board-bounty"'));
    const button = section.slice(section.indexOf('<button'), section.indexOf('</button>'));
    assert.ok(button.length > 0, '비공허: 발급 버튼을 찾았다');
    assert.equal(/\sdisabled(=|\s|>)/.test(button), false, '발급 버튼이 비활성이 아니다');
    assert.equal(section.includes('오늘 발급 완료'), false);
});
