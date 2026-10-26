import { ChevronDown } from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getCompletedStoryChapters } from '../utils/storyJournal';
import type { Quest } from '../types/quest';

/**
 * 지금까지의 이야기 — 임무 탭의 장식 패널(화면당 하나). 마지막 장은 바로 읽히고,
 * 앞선 장은 접힌 연대기(금빛 마름모 + 세로선)로 다시 읽는다.
 */
const StoryJournal = ({ claimedQuestIds }: { claimedQuestIds?: Array<Quest['id']> }) => {
    const chapters = getCompletedStoryChapters(claimedQuestIds);
    const latest = chapters.at(-1);
    if (!latest) return null;
    const currentQuest = DB.QUESTS.find((quest) => quest.id === latest.questId);
    const nextQuest = DB.QUESTS.find((quest) => quest.prerequisiteQuestId === latest.questId);

    return (
        <section data-testid="story-journal" aria-label={MSG.STORY_JOURNAL_TITLE} className="ae-ornate px-5 py-4 font-readable">
            <p className="ae-eyebrow !text-ae-gold-text">{MSG.STORY_JOURNAL_TITLE}</p>
            <h3 className="mt-1 aether-type-heading text-ae-ink">{currentQuest?.title}</h3>
            <p data-testid="story-journal-latest" className="mt-3 aether-type-body leading-7 text-ae-ink-2">{latest.body}</p>
            {nextQuest && (
                <p className="mt-3 aether-type-body leading-6 text-ae-ether-hi">
                    {MSG.STORY_JOURNAL_NEXT(nextQuest.title, nextQuest.minLv)}
                </p>
            )}
            {chapters.length > 1 && (
                <details className="mt-2 border-t border-ae-gold/20">
                    <summary className="ab-summary min-h-11">
                        <span className="min-w-0 flex-1 aether-type-body font-bold text-ae-ink-2">{MSG.STORY_JOURNAL_PREVIOUS}</span>
                        <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                    </summary>
                    <ol className="ab-chronicle">
                        {chapters.slice(0, -1).map((chapter) => (
                            <li key={chapter.questId} className="relative py-2.5">
                                <span className="ab-chronicle-dot is-past" aria-hidden="true" />
                                <h4 className="aether-type-body font-bold text-ae-gold-text">{DB.QUESTS.find((quest) => quest.id === chapter.questId)?.title}</h4>
                                <p className="mt-1.5 aether-type-body leading-7 text-ae-ink-2">{chapter.body}</p>
                            </li>
                        ))}
                    </ol>
                </details>
            )}
        </section>
    );
};

export default StoryJournal;
