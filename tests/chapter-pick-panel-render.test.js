// 2026-11 H3 장 경계 3택 — 화면 계약(실행 스케치 §3.3 커밋 2).
// 화면은 `getChapterPickOffer`를 그리기만 한다: 카드 셋(유물 · 접두어 · 무료 강화) · 칸이 찬 유물의 교체 안내 · 넘기기,
// 고르기 전에는 확정 단추가 잠겨 있다. 다른 화면 위에 뜨지 않도록 GameRoot 조건은 리듀서 조건과 같다(대기 상태 · 유물 제안 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS } from '../src/data/relics.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import { createCurrentRunProgress } from '../src/utils/runProgress.ts';
import { getChapterPickOffer } from '../src/utils/chapterPick.ts';
import ChapterPickPanel from '../src/components/ChapterPickPanel.tsx';
import { renderStatic, sliceElementByTestId } from './helpers/render.ts';

const FLOOR_PX = 11;
const clone = (value) => structuredClone(value);

const playerAt = ({ reached = 7, picks, equip, relics = [] } = {}) => {
    const base = clone(INITIAL_STATE.player);
    const currentRun = createCurrentRunProgress({ explores: 40, kills: 12 }, { startedAt: 0 });
    return {
        ...base,
        name: '장의 선물',
        level: 42,
        loc: '시작의 마을',
        relics,
        equip: equip ?? {
            weapon: { ...clone(DB.ITEMS.weapons[2]), id: 'w-2' },
            armor: { ...clone(DB.ITEMS.armors[2]), id: 'a-2' },
            offhand: null,
        },
        stats: {
            ...base.stats,
            explores: 70,
            currentRun: {
                ...currentRun,
                chapters: { ...currentRun.chapters, reached },
                ...(picks ? { chapterPicks: picks } : {}),
            },
        },
    };
};

/** `data-testid` 요소의 여는 태그(속성 확인용 — 자르기 도우미는 안쪽만 돌려준다). */
const openTagOf = (html, testId) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`, 'u'))?.[0] ?? '';

const render = (player) => renderStatic(React.createElement(ChapterPickPanel, { player, dispatch: () => {} }));

const undersizedClasses = (html) => {
    const found = [];
    for (const [, classes] of html.matchAll(/class="([^"]*)"/gu)) {
        for (const token of classes.split(/\s+/u)) {
            const match = token.match(/(?:^|:)text-\[(\d*\.?\d+)(px|rem)\]$/u);
            if (match && Number(match[1]) * (match[2] === 'rem' ? 16 : 1) < FLOOR_PX) found.push(token);
        }
    }
    return found;
};

test('받을 장이 없으면 그리지 않는다', () => {
    assert.equal(render(playerAt({ reached: 3 })), '');
    assert.equal(render(playerAt({ reached: 7, picks: [4, 5, 7] })), '');
});

test('가장 낮은 받을 장을 그리고, 패의 카드 셋을 그 순서로 그린다', () => {
    const player = playerAt({ reached: 7, picks: [4] });
    const html = render(player);
    const offer = getChapterPickOffer(player, 5);
    assert.match(html, /data-chapter="5"/u);
    assert.ok(html.includes(MSG.CHAPTER_PICK_TITLE));
    assert.deepEqual(offer.cards.map((card) => card.kind), ['relic', 'prefix', 'enhance']);
    for (const card of offer.cards) {
        const cardTag = openTagOf(html, `chapter-pick-card-${card.id}`);
        assert.ok(cardTag, `${card.id} 카드가 그려진다`);
        assert.match(cardTag, new RegExp(`data-card-kind="${card.kind}"`, 'u'));
    }
    const enhance = offer.cards.find((card) => card.kind === 'enhance');
    assert.ok(html.includes(MSG.CHAPTER_PICK_ENHANCE_TITLE(enhance.itemName, enhance.from, enhance.to)), '실제로 오르는 단계를 말한다');
    const prefix = offer.cards.find((card) => card.kind === 'prefix');
    assert.ok(html.includes(MSG.CHAPTER_PICK_PREFIX_TITLE(prefix.prefixName)));
});

test('고르기 전에는 확정 단추가 잠겨 있고, 넘기기는 늘 있다', () => {
    const html = render(playerAt({ reached: 4 }));
    assert.match(openTagOf(html, 'chapter-pick-confirm'), /disabled=""/u);
    assert.ok(sliceElementByTestId(html, 'chapter-pick-confirm').includes(MSG.CHAPTER_PICK_CONFIRM));
    assert.ok(sliceElementByTestId(html, 'chapter-pick-skip').includes(MSG.CHAPTER_PICK_SKIP));
    assert.doesNotMatch(openTagOf(html, 'chapter-pick-skip'), /disabled=""/u);
    assert.equal((html.match(/ae-btn-primary/gu) || []).length, 1, '금빛 주 행동은 하나');
});

test('칸이 찬 유물 카드는 교체 안내를 그린다', () => {
    const capacity = getPrestigeUnlocks(0).maxRelics;
    const relics = RELICS.filter((relic) => relic.rarity === 'common').slice(0, capacity);
    const html = render(playerAt({ reached: 4, relics }));
    const relicCard = sliceElementByTestId(html, 'chapter-pick-card-relic');
    assert.ok(relicCard.includes(MSG.CHAPTER_PICK_RELIC_FULL));
    const roomy = render(playerAt({ reached: 4 }));
    assert.ok(!roomy.includes(MSG.CHAPTER_PICK_RELIC_FULL));
});

test('장비가 없으면 접두어 · 강화 자리는 대체 유물이고, 11px 미만 글자 · 말줄임이 없다', () => {
    const html = render(playerAt({ reached: 4, equip: { weapon: null, armor: null, offhand: null } }));
    assert.ok(sliceElementByTestId(html, 'chapter-pick-card-relic-2'));
    assert.ok(sliceElementByTestId(html, 'chapter-pick-card-relic-3'));
    assert.ok(!html.includes('data-card-kind="prefix"'));
    for (const variant of [html, render(playerAt({ reached: 7 }))]) {
        assert.deepEqual(undersizedClasses(variant), []);
        assert.doesNotMatch(variant, /\btruncate\b|line-clamp/u);
    }
});
