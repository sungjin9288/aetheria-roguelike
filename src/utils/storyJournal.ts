import { STORY_CHAPTERS } from '../data/storyChapters';
import type { Quest } from '../types/quest';

export const getQuestCompletionStory = (questId: Quest['id']): string | null => (
    STORY_CHAPTERS.find((chapter) => chapter.questId === questId)?.body ?? null
);

export const getCompletedStoryChapters = (claimedQuestIds?: Array<Quest['id']>) => (
    STORY_CHAPTERS.filter((chapter) => claimedQuestIds?.includes(chapter.questId))
);
