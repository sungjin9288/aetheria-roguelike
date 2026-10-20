// 2026-10 통합 수용 4차(원장 §138) — 게시판 추천 줄은 제목이 대상을 말하지 않는 임무의 목표를 숨기지 않는다.
//
// 2026-08 모바일 압축은 기본 토벌(종류 없이 몬스터 대상 · 횟수)의 진행도를 제목에 합치고("슬라임 소탕 (0/3)") 목표 줄을 숨겼다.
// 제목이 대상을 말한다는 전제였는데 기본 토벌 113개 중 49개는 그렇지 않았다 — "호수의 수호자 (0/5)"(물의 정령) ·
// "[이야기] 불꽃의 시험 (0/5)"(화염 정령). 추천 줄을 펼친 안내도 목표를 그리지 않아 수락 전 게시판 어디에도 무엇을 하는
// 임무인지가 없었다. Wave 128 뒤 이야기 칸의 추천 줄이 바로 그런 임무(본편 장 · 이야기를 여는 임무 5 · 17 · 205)다.
//
// 판정은 `isSelfDescribingHuntQuest`(utils/questOperations.ts) 하나이고 추천 줄이 그것을 읽는다 — 데이터 전수 + 실제 렌더.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { QUESTS } from '../src/data/quests.ts';
import { EVENT_CHAINS, getChainQuestStart } from '../src/data/eventChains.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getQuestBoardRecommendations, isBasicHuntQuest, isSelfDescribingHuntQuest } from '../src/utils/questOperations.ts';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import { renderStatic } from './helpers/render.ts';

const TOWN = '시작의 마을';
const byId = (id) => QUESTS.find((quest) => quest.id === id);
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const playerAt = (level, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '게시판 목표', job: '모험가', loc: TOWN, level,
    ...extra,
    stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [80], ...(extra.stats || {}) },
});
const render = (player) => renderStatic(createElement(QuestBoardPanel, { player, actions: {} }));
// 추천 목록 구역만 — 진행 중 · 다른 임무 칸은 원래 목표를 그린다.
const featuredSection = (html) => {
    const start = html.indexOf('data-testid="quest-featured-list"');
    assert.ok(start >= 0, '추천 목록');
    const end = html.indexOf('data-testid="quest-board-bounty"', start);
    return html.slice(start, end > start ? end : undefined);
};
const featuredRows = (html) => featuredSection(html).split('data-testid="quest-decision-row"').slice(1);

test('[판정] 제목이 대상을 말하는 기본 토벌만 목표 줄을 생략한다 — 그 밖의 기본 토벌은 모두 목표를 그린다', () => {
    const basic = QUESTS.filter(isBasicHuntQuest);
    const hidden = basic.filter(isSelfDescribingHuntQuest);
    const shown = basic.filter((quest) => !isSelfDescribingHuntQuest(quest));
    assert.ok(basic.length > 100, `기본 토벌 ${basic.length}`);
    for (const quest of hidden) assert.ok(quest.title.includes(quest.target), `${quest.id} ${quest.title}`);
    for (const quest of shown) {
        assert.equal(quest.title.includes(quest.target), false, `${quest.id} ${quest.title}`);
        // 그리는 목표는 대상을 말한다 — 무엇을 하는 임무인지가 보인다.
        assert.ok(String(quest.desc || '').includes(quest.target), `${quest.id} 목표 "${quest.desc}"에 ${quest.target}`);
    }
    // 기본 토벌이 아닌 임무(레벨 · 누적 · 제작 …)는 원래 목표를 그린다.
    for (const quest of QUESTS.filter((entry) => !isBasicHuntQuest(entry))) assert.equal(isSelfDescribingHuntQuest(quest), false, String(quest.id));
    // 대표 사례: 슬라임 소탕은 제목이 곧 목표, 호수의 수호자는 아니다.
    assert.equal(isSelfDescribingHuntQuest(byId(1)), true);
    assert.equal(isSelfDescribingHuntQuest(byId(5)), false);
});

test('[이야기 칸] 이야기를 여는 임무와 본편 장은 제목이 대상을 말하지 않으면 추천 줄에 목표가 있다', () => {
    const openers = EVENT_CHAINS.map((chain) => getChainQuestStart(chain.steps[0])?.questId).filter((id) => id !== undefined);
    assert.equal(openers.length, EVENT_CHAINS.length);
    const silentOpeners = openers.filter((id) => !isSelfDescribingHuntQuest(byId(id)) && isBasicHuntQuest(byId(id)));
    // 제목이 대상을 말하지 않는 여는 임무 — 2026-10 데이터에서 셋 이상(5 호수의 수호자 · 17 평원 정화 · 205 혼돈 속의 생존자 …).
    for (const id of [5, 17, 205]) assert.ok(silentOpeners.includes(id), String(id));
    const storyChapters = QUESTS.filter((quest) => String(quest.title).includes('[이야기]') && isBasicHuntQuest(quest));
    assert.ok(storyChapters.some((quest) => !isSelfDescribingHuntQuest(quest)), '본편 장');
});

test('[렌더] 이야기 칸의 호수의 수호자 줄은 목표(물의 정령 5마리)와 소문을 함께 그리고, 슬라임 소탕처럼 제목이 곧 목표인 줄은 목표를 생략한다', () => {
    const player = playerAt(5, { quests: [{ id: 81, progress: 0 }] });
    const { featured } = getQuestBoardRecommendations(player);
    const lake = featured.find((entry) => entry.quest.id === 5);
    assert.ok(lake, `추천: ${featured.map((entry) => entry.quest.id).join(',')}`);
    const rows = featuredRows(render(player));
    const lakeRow = rows.find((row) => row.includes(escapeHtml(byId(5).title)));
    assert.ok(lakeRow, '호수의 수호자 줄');
    assert.ok(lakeRow.includes('data-testid="quest-featured-objective"'), '목표 줄');
    assert.ok(lakeRow.includes(escapeHtml(byId(5).desc)), byId(5).desc);
    assert.ok(lakeRow.includes('data-testid="quest-story-hook"'), '소문 줄');
    // 같은 목록의 제목이 곧 목표인 기본 토벌 줄은 목표를 생략한다(진행도는 제목에 있다).
    for (const entry of featured.filter((candidate) => isSelfDescribingHuntQuest(candidate.quest))) {
        const row = rows.find((candidate) => candidate.includes(escapeHtml(entry.quest.title)));
        assert.ok(row, entry.quest.title);
        assert.equal(row.includes('data-testid="quest-featured-objective"'), false, entry.quest.title);
    }
    // 처음 게시판(Lv1)의 슬라임 소탕도 그대로다.
    const first = featuredRows(render(playerAt(1)));
    const slimeRow = first.find((row) => row.includes(escapeHtml(byId(1).title)));
    assert.ok(slimeRow, '슬라임 소탕 줄');
    assert.equal(slimeRow.includes(escapeHtml(byId(1).desc)), false);
});

test('[렌더] 받을 본편 장(불꽃의 시험)의 추천 줄은 그 장이 무엇을 하는지(화염의 협곡에서 화염 정령 5마리)를 그린다', () => {
    const player = playerAt(15, { stats: { claimedQuestIds: [80, 81] } });
    const { featured } = getQuestBoardRecommendations(player);
    const chapter = featured.find((entry) => entry.quest.id === 82);
    assert.ok(chapter, `추천: ${featured.map((entry) => entry.quest.id).join(',')}`);
    assert.equal(isSelfDescribingHuntQuest(chapter.quest), false);
    const row = featuredRows(render(player)).find((candidate) => candidate.includes(escapeHtml(byId(82).title)));
    assert.ok(row, '본편 장 줄');
    assert.ok(row.includes(escapeHtml(byId(82).desc)), byId(82).desc);
});
