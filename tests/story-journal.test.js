import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { DB } from '../src/data/db.ts';
import { STORY_CHAPTERS } from '../src/data/storyChapters.ts';
import { getCompletedStoryChapters, getQuestCompletionStory } from '../src/utils/storyJournal.ts';
import StoryJournal from '../src/components/StoryJournal.tsx';
import { renderStatic } from './helpers/render.ts';

test('모든 이야기 임무는 실제 선행 순서와 고유한 완료 서사를 가진다', () => {
    const catalog = DB.QUESTS.filter((quest) => quest.title?.startsWith('[스토리]'));
    assert.deepEqual(STORY_CHAPTERS.map((chapter) => chapter.questId), [80, 81, 82, 207, 208, 209, 84, 83, 210, 211, 212, 213, 214, 85, 86, 87]);
    assert.deepEqual([...STORY_CHAPTERS.map((chapter) => chapter.questId)].sort(), catalog.map((quest) => quest.id).sort());
    assert.equal(new Set(STORY_CHAPTERS.map((chapter) => chapter.body)).size, catalog.length);
    STORY_CHAPTERS.forEach((chapter, index) => {
        const quest = catalog.find((entry) => entry.id === chapter.questId);
        assert.equal(quest.prerequisiteQuestId, STORY_CHAPTERS[index - 1]?.questId);
        assert.ok(chapter.body.length > 40);
        assert.equal(getQuestCompletionStory(chapter.questId), chapter.body);
    });
    assert.equal(getQuestCompletionStory(1), null);
    assert.equal(getQuestCompletionStory('bounty'), null);
});

test('기록은 수령한 임무만 공개하고 저장 원장을 변경하지 않는다', () => {
    const claimed = [80, 1, 82, 81, 80];
    const before = structuredClone(claimed);
    assert.deepEqual(getCompletedStoryChapters(claimed).map((chapter) => chapter.questId), [80, 81, 82]);
    assert.deepEqual(claimed, before);
    assert.deepEqual(getCompletedStoryChapters(undefined), []);
    const html = renderStatic(createElement(StoryJournal, { claimedQuestIds: [80] }));
    assert.ok(html.includes(STORY_CHAPTERS[0].body));
    assert.ok(!html.includes(STORY_CHAPTERS[1].body), '아직 수령하지 않은 진실은 공개하지 않는다');
    assert.ok(html.includes('고요한 숲'));
    assert.equal(renderStatic(createElement(StoryJournal, {})), '');
});
