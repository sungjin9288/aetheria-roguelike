import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { formatRewardParts, getTitleLabel } from '../src/utils/gameUtils.ts';
import { getCumulativeQuestProgress, isLifetimeCounterQuest } from '../src/utils/cumulativeQuestProgress.ts';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import QuestTab from '../src/components/tabs/QuestTab.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 임무 문구 감사 ("B" — 엔진은 맞고 플레이어에게 보이는 문구가 틀렸다).
 *
 * ① 칭호 보상은 수령 때 지급되는데(rewardHandlers) 보상 줄(`formatRewardParts`)에 없었다 — 152·153·154·201·202가
 *    "골드 40000"만 보였다. ② 현상수배 포기 문구가 Wave 32에 없어진 하루 1회 제한을 말했다. ③ 임무 3은 정확한 종
 *    '코볼트'(평원 · 고원)인데 제목이 광산을 가리켰다(광산에는 '코볼트 광부'만 있고 정확 일치라 세지 않는다).
 *    ④ 임무 130은 3마리인데 "다시 한번". ⑤ 평생 누적 기록으로 진행도를 읽는 임무 28개(설계 그대로)가 수락 뒤부터
 *    세는 일처럼 읽혔다 — 판정 하나(`isLifetimeCounterQuest`, 진행도와 같은 표)에서 '누적' 표시를 파생한다.
 *    ⑥ 임무 202 설명의 영어 "signature" → 화면 용어 "전설 각인".
 */

const QUESTS = DB.QUESTS;
const questById = (id) => QUESTS.find((quest) => quest.id === id);
const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} });
const CHIP_TEST_ID = 'data-testid="quest-lifetime-counter-chip"';
const countChips = (html) => html.split(CHIP_TEST_ID).length - 1;

/** 지정한 임무만 보드에 남도록 나머지 카탈로그 임무를 전부 수령 처리한 마을 플레이어. */
const townPlayer = ({ level, active = [], open = [] }) => {
    const shown = new Set([...active, ...open]);
    return makePlayerFixture({
        name: '임무 문구 검증',
        level,
        loc: '시작의 마을',
        quests: active.map((id) => ({ id, progress: 0 })),
        stats: {
            ...structuredClone(INITIAL_STATE.player.stats),
            claimedQuestIds: QUESTS.map((quest) => quest.id).filter((id) => !shown.has(id)),
        },
    });
};

const renderBoard = (player) => renderStatic(createElement(QuestBoardPanel, {
    player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
}));
const renderTab = (player) => renderStatic(createElement(QuestTab, { player, actions: NOOP_ACTIONS, isInSafeZone: true }));

const townState = (player) => ({ ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [], player });

// ── ① 칭호 보상 ─────────────────────────────────────────────────────────────

const TITLE_REWARD_QUESTS = QUESTS.filter((quest) => quest.reward?.title);

test('[칭호 보상] 칭호를 주는 임무는 보상 줄에 그 칭호의 표시 이름을 보인다', () => {
    assert.deepEqual(TITLE_REWARD_QUESTS.map((quest) => quest.id).sort((a, b) => a - b), [152, 153, 154, 201, 202], '비공허 — 감사가 센 5개');
    for (const quest of TITLE_REWARD_QUESTS) {
        assert.ok(
            formatRewardParts(quest.reward).includes(MSG.QUEST_REWARD_TITLE(getTitleLabel(quest.reward.title))),
            `quest ${quest.id}: ${formatRewardParts(quest.reward).join(' · ')}`,
        );
    }
});

test('[칭호 보상] 표시 이름은 칭호 정의에서 찾고(영문 id 포함), 정의가 없으면 원래 값을 쓴다', () => {
    assert.deepEqual(formatRewardParts({ title: 'cartographer' }), [MSG.QUEST_REWARD_TITLE('지도 제작자')]);
    assert.deepEqual(formatRewardParts({ title: '정의 없는 칭호' }), [MSG.QUEST_REWARD_TITLE('정의 없는 칭호')]);
    assert.deepEqual(formatRewardParts({}), [], '칭호가 없으면 줄도 없다');
});

test('[칭호 보상] 광고 = 지급 — 5개 임무를 실제로 수령하면 보상 줄이 말한 그 칭호를 얻는다', () => {
    for (const quest of TITLE_REWARD_QUESTS) {
        const player = townPlayer({ level: Math.max(quest.minLv || 1, 75), active: [quest.id] });
        player.quests = [{ id: quest.id, progress: quest.goal }];
        const after = gameReducer(townState(player), { type: AT.CLAIM_QUEST_REWARD, payload: { questId: quest.id } });
        assert.equal((player.titles || []).includes(quest.reward.title), false, `quest ${quest.id}: 수령 전에는 없다`);
        assert.ok((after.player.titles || []).includes(quest.reward.title), `quest ${quest.id}: 수령으로 칭호가 지급된다`);
        assert.ok(formatRewardParts(quest.reward).includes(MSG.QUEST_REWARD_TITLE(getTitleLabel(quest.reward.title))), `quest ${quest.id}`);
    }
});

test('[칭호 보상] 게시판과 임무 탭이 진행 중인 152의 칭호 보상을 그린다', () => {
    const player = townPlayer({ level: 70, active: [152] });
    const label = MSG.QUEST_REWARD_TITLE(getTitleLabel(questById(152).reward.title));
    assert.ok(renderBoard(player).includes(label), '게시판');
    assert.ok(renderTab(player).includes(label), '임무 탭');
});

// ── ② 현상수배 포기 ─────────────────────────────────────────────────────────

test('[현상수배 포기] 포기 문구는 하루 제한을 말하지 않고, 실제로 포기 직후 새 현상수배가 발급된다', () => {
    for (const text of [MSG.BOUNTY_ABANDONED, MSG.BOUNTY_ABANDON_WARNING]) {
        assert.ok(!text.includes('오늘은'), text);
        assert.ok(!text.includes('받을 수 없'), text);
    }

    const requestedAt = Date.now();
    const issued = gameReducer(townState(townPlayer({ level: 12 })), {
        type: AT.REQUEST_BOUNTY, payload: { requestedAt, seed: 0.25 },
    });
    const bounty = issued.player.quests.find((quest) => quest.isBounty);
    assert.ok(bounty, '비공허: 첫 현상수배');

    const abandoned = gameReducer(issued, { type: AT.ABANDON_QUEST, payload: { questId: bounty.id } });
    assert.equal(abandoned.player.quests.some((quest) => quest.isBounty), false);
    assert.equal(abandoned.logs.at(-1)?.text, MSG.BOUNTY_ABANDONED);

    const reissued = gameReducer(abandoned, {
        type: AT.REQUEST_BOUNTY, payload: { requestedAt: requestedAt + 1_000, seed: 0.75 },
    });
    const next = reissued.player.quests.find((quest) => quest.isBounty);
    assert.ok(next, '같은 날 포기 직후 새 현상수배가 발급된다 — 문구가 약속한 그대로');
    assert.notEqual(next.id, bounty.id);
});

// ── ③④⑥ 임무 데이터 문구 ────────────────────────────────────────────────────

test('[임무 3] 제목은 목표 종이 실제로 사는 곳을 가리키고 광산을 가리키지 않는다', () => {
    const quest = questById(3);
    const habitats = Object.entries(DB.MAPS)
        .filter(([, map]) => (map.monsters || []).includes(quest.target))
        .map(([name]) => name);
    assert.deepEqual(habitats.sort(), ['바람의 고원', '서쪽 평원'], '비공허 — 정확한 종 코볼트의 서식지');
    assert.ok(!quest.title.includes('광산'), quest.title);
    assert.ok(habitats.some((name) => name.includes('평원')) && quest.title.includes('평원'), quest.title);
});

test('[임무 130] 설명이 목표 처치 수를 말한다', () => {
    const quest = questById(130);
    assert.equal(quest.goal, 3);
    assert.ok(quest.desc.includes(`${quest.goal}번`), quest.desc);
    assert.ok(!quest.desc.includes('한번'), quest.desc);
});

test('[임무 202 · 전수] 임무 문구에 영어 "signature"가 없다 — 화면 용어는 전설 각인', () => {
    assert.ok(questById(202).desc.includes('전설 각인'), questById(202).desc);
    const leaks = QUESTS.filter((quest) => [quest.title, quest.desc, quest.objective].some((text) => /signature/i.test(text || '')));
    assert.deepEqual(leaks.map((quest) => quest.id), []);
});

// ── ⑤ 평생 누적 임무 표시 ───────────────────────────────────────────────────

const LIFETIME_IDS = QUESTS.filter(isLifetimeCounterQuest).map((quest) => quest.id);

test('[누적 판정] 판정은 진행도가 누적 기록에서 오는 임무와 정확히 같다(전 임무 대조)', () => {
    const player = makePlayerFixture({ stats: { ...structuredClone(INITIAL_STATE.player.stats), kills: 7, explores: 7 } });
    for (const quest of QUESTS) {
        assert.equal(
            isLifetimeCounterQuest(quest),
            getCumulativeQuestProgress(quest, player) !== null,
            `quest ${quest.id} (${quest.type ?? 'kill'}/${quest.target})`,
        );
    }
    assert.equal(LIFETIME_IDS.length, 28, '비공허 — 감사의 23개 + 이미 누적/총이라 쓴 5개');
    for (const id of [60, 61, 66, 68, 72, 75, 90, 93, 94, 200, 201, 202, 203, 204, 206]) {
        assert.ok(LIFETIME_IDS.includes(id), `quest ${id}는 누적 임무`);
    }
    // 처치 임무 · 지역 탐험(수락 뒤부터 센다) · 레벨 임무는 누적이 아니다.
    for (const id of [1, 3, 80, 81, 152, 153, 10]) {
        assert.equal(isLifetimeCounterQuest(questById(id)), false, `quest ${id}`);
    }
    assert.equal(isLifetimeCounterQuest({ id: 'bounty_x', target: '슬라임', goal: 5, isBounty: true }), false, '현상수배');
});

test('[누적 판정] 표시가 말하는 그대로 — 누적 임무는 수락 순간 이전 기록으로 채워지고, 처치 임무는 0부터다', () => {
    const player = townPlayer({ level: 10, open: [61, 1] });
    player.stats = { ...player.stats, explores: 25, kills: 999 };
    const accepted = [61, 1].reduce(
        (state, questId) => gameReducer(state, { type: AT.ACCEPT_QUEST, payload: { questId } }),
        townState(player),
    );
    const progressOf = (id) => accepted.player.quests.find((quest) => quest.id === id)?.progress;
    assert.equal(progressOf(61), questById(61).goal, '61(20번 탐색)은 수락하자마자 완료');
    assert.equal(progressOf(1), 0, '1(슬라임 3마리)은 수락 뒤부터');
});

test('[누적 표시] 진행 중 행: 누적 임무에만 칩이 붙는다 — 게시판 · 임무 탭', () => {
    const lifetime = townPlayer({ level: 70, active: [61] });
    const others = townPlayer({ level: 70, active: [1, 80, 152] });
    for (const [surface, render] of [['게시판', renderBoard], ['임무 탭', renderTab]]) {
        const html = render(lifetime);
        assert.equal(countChips(html), 1, `${surface}: 61에 칩 하나`);
        assert.ok(html.includes(MSG.QUEST_LIFETIME_COUNTER_CHIP) && html.includes(MSG.QUEST_LIFETIME_COUNTER_HINT), surface);
        assert.equal(countChips(render(others)), 0, `${surface}: 처치 · 지역 탐험 임무에는 칩이 없다`);
    }
});

test('[누적 표시] 수락 전 행(추천 · 다른 임무 · 잠금)도 누적 임무 수만큼 칩을 그린다', () => {
    const open = [61, 1, 74, 131, 2, 4, 64, 73];
    const html = renderBoard(townPlayer({ level: 10, open }));
    for (const section of ['quest-featured-list', 'quest-board-backlog', 'quest-board-locked']) {
        assert.ok(html.includes(`data-testid="${section}"`), `비공허 — ${section}가 그려졌다`);
    }
    for (const id of open) {
        assert.ok(html.includes(questById(id).title), `quest ${id} 행이 그려졌다`);
    }
    for (const id of open.filter((questId) => LIFETIME_IDS.includes(questId))) {
        assert.equal(html.split(`>${questById(id).title}<`).length - 1, 1, `누적 임무 ${id} 행은 한 번`);
    }
    assert.equal(countChips(html), open.filter((id) => LIFETIME_IDS.includes(id)).length);
    assert.equal(countChips(html), 4, '61 · 74 · 64 · 73');
});
