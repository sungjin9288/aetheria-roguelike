import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getCompletedStoryChapters } from '../utils/storyJournal';
import type { Quest } from '../types/quest';

const StoryJournal = ({ claimedQuestIds }: { claimedQuestIds?: Array<Quest['id']> }) => {
    const chapters = getCompletedStoryChapters(claimedQuestIds);
    const latest = chapters.at(-1);
    if (!latest) return null;
    const currentQuest = DB.QUESTS.find((quest) => quest.id === latest.questId);
    const nextQuest = DB.QUESTS.find((quest) => quest.prerequisiteQuestId === latest.questId);

    return (
        <section data-testid="story-journal" aria-label={MSG.STORY_JOURNAL_TITLE} className="mb-4 border-y border-[#d5b180]/25 py-4 font-readable">
            <p className="text-xs font-semibold text-[#d5b180]">{MSG.STORY_JOURNAL_TITLE}</p>
            <h3 className="mt-1 text-base font-bold text-white">{currentQuest?.title}</h3>
            <p data-testid="story-journal-latest" className="mt-3 text-sm leading-7 text-slate-200">{latest.body}</p>
            {nextQuest && (
                <p className="mt-3 text-sm leading-6 text-[#b9f1ec]">
                    {MSG.STORY_JOURNAL_NEXT(nextQuest.title, nextQuest.minLv)}
                </p>
            )}
            {chapters.length > 1 && (
                <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-3 text-sm text-slate-300">{MSG.STORY_JOURNAL_PREVIOUS}</summary>
                    {chapters.slice(0, -1).map((chapter) => (
                        <article key={chapter.questId} className="border-t border-white/10 py-3">
                            <h4 className="text-sm font-bold text-[#f6e7c8]">{DB.QUESTS.find((quest) => quest.id === chapter.questId)?.title}</h4>
                            <p className="mt-2 text-sm leading-7 text-slate-300">{chapter.body}</p>
                        </article>
                    ))}
                </details>
            )}
        </section>
    );
};

export default StoryJournal;
