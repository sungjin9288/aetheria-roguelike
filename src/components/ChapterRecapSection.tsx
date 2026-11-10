import type { ChapterRecap } from '../utils/chapterRecap.js';
import { getExpeditionChapterRecapView } from '../utils/chapterRecapView.js';
import { MSG } from '../data/messages';
import ChapterRecapCard from './ChapterRecapCard';

interface ChapterRecapSectionProps {
    /** 그 원정 중에 넘은 장의 결산(최신이 먼저). 비어 있으면 아무것도 그리지 않는다. */
    recaps: readonly ChapterRecap[];
    className?: string;
}

/**
 * 2026-11 B1 장 결산 — 원정 정리 시트 맨 위 칸(소유자 결정 Q1 (a)). 새 단추가 없고 확인 기록도 쓰지 않는다.
 * 줄은 `getExpeditionChapterRecapView`가 만들고 여기서는 그리기만 한다.
 */
const ChapterRecapSection = ({ recaps, className = '' }: ChapterRecapSectionProps) => {
    if (recaps.length === 0) return null;
    const view = getExpeditionChapterRecapView(recaps);
    return (
        <div data-testid="debrief-chapter-recap" className={`space-y-2 ${className}`}>
            {view.cards.map((card) => (
                <ChapterRecapCard key={card.chapter} card={card} testIdPrefix="debrief-chapter-recap" />
            ))}
            {view.more > 0 && (
                <div data-testid="debrief-chapter-recap-more" className="px-1 font-readable text-[12px] text-ae-ink-3">
                    {MSG.CHAPTER_RECAP_MORE(view.more)}
                </div>
            )}
        </div>
    );
};

export default ChapterRecapSection;
