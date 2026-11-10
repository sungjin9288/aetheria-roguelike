import { useMemo } from 'react';
import { ChevronDown, Flag } from 'lucide-react';
import type { Player } from '../../types/index.js';
import { getChapterRecaps } from '../../utils/chapterRecap.js';
import { getJourneyChapterRecapView } from '../../utils/chapterRecapView.js';
import { MSG } from '../../data/messages';
import ChapterRecapCard from '../ChapterRecapCard';

interface StatsChapterRecapsProps {
    player?: Player | null;
}

/**
 * 2026-11 B1 P1 능력치 탭 '이번 여정의 장'(명세 §1.6): 이번 여정의 결산 전부, 최신이 먼저.
 * 원정 밖에서 넘은 결산(`expeditionId: null`)의 유일한 표시처다. 결산이 없으면 묶음을 그리지 않는다.
 */
const StatsChapterRecaps = ({ player }: StatsChapterRecapsProps) => {
    const cards = useMemo(() => getJourneyChapterRecapView(getChapterRecaps(player)), [player]);
    if (cards.length === 0) return null;
    return (
        <details data-testid="stats-chapter-recaps" className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                <Flag size={14} aria-hidden="true" className="text-ae-gold" />
                <span className="flex-1 text-[13px] font-bold text-ae-ink">{MSG.STATS_CHAPTER_RECAPS_HEADING}</span>
                <span className="font-fira text-[12px] tabular-nums text-ae-ink-3">{MSG.STATS_CHAPTER_RECAPS_COUNT(cards.length)}</span>
                <ChevronDown size={16} aria-hidden="true" className="text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="space-y-2 pb-3">
                {cards.map((card) => (
                    <ChapterRecapCard key={card.chapter} card={card} testIdPrefix="stats-chapter-recap" />
                ))}
            </div>
        </details>
    );
};

export default StatsChapterRecaps;
